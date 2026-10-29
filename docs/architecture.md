# 🛡️ Sentinel Vision AI — System Architecture

Sentinel Vision AI is an enterprise-grade AI missing-person search, person Re-ID, and cross-camera tracking platform.

> **CRITICAL CORE PRINCIPLE**:  
> Output = **POSSIBLE SIGHTINGS** for human verification. The system **never auto-confirms identity**.  
> Every similarity score is evidence for review, never mathematical proof. The UI strictly surfaces candidate sightings with the label **"Possible match"**.

---

## 1. End-to-End System Architecture

```mermaid
flowchart TD
    subgraph Client["Presentation Layer (apps/web)"]
        UI["Next.js 15 UI\n(App Router, shadcn/ui, B&W Theme)"]
        WSClient["Socket.IO Client\n(Realtime Sighting Stream)"]
    end

    subgraph API["Application & Gateway Layer (apps/api)"]
        NestAPI["NestJS Gateway / REST API\n(/api/v1/cases, /cameras, /search)"]
        WSServer["Socket.IO Gateway\n(Live Alert & Sighting Push)"]
        BullQueue["BullMQ Producer\n(Search & Ingest Jobs)"]
        KafkaProducer["KafkaJS Producer\n(Event Envelope, Key=cameraId)"]
    end

    subgraph Broker["Event & Storage Infrastructure (infra)"]
        KafkaCluster["Apache Kafka (KRaft Mode)\nTopics: video.frames.raw, detections.person,\nembeddings.generated, sightings.created, *.dlq"]
        RedisCluster["Redis 7\n(BullMQ Broker, Cache, EventId Deduplication via SETNX)"]
        MongoCluster["MongoDB 7\n(Cases, Cameras, Sighting Records, Audit Trail)"]
        MinIOStorage["MinIO S3 Object Storage\n(Reference Photos, Frame Crops, Thumbnails)"]
    end

    subgraph Workers["Inference & Computer Vision Layer (apps/inference)"]
        PyIngest["Camera Ingestion Worker\n(FFmpeg RTSP Stream -> Frame Extractor)"]
        PyYolo["YOLOv8 Person Detector\n+ ByteTrack Local Tracker"]
        PyFace["SCRFD + ArcFace (512-dim)\nFace Feature Extractor"]
        PyReid["OSNet (256-dim)\nBody Re-ID Extractor"]
        KafkaConsumer["aiokafka Consumer\n(Idempotent Consumer, Key=cameraId)"]
    end

    subgraph VectorDB["Vector Database (Pinecone Cloud)"]
        PineconeFace[("Pinecone Index:\nface-embeddings\n(512-dim, Cosine)")]
        PineconeReid[("Pinecone Index:\nreid-embeddings\n(256-dim, Cosine)")]
    end

    %% Data Flow Connections
    UI -->|REST: Create Case, Register Camera, Trigger Search| NestAPI
    NestAPI -->|Persist Case & Metadata| MongoCluster
    NestAPI -->|Store Reference Photos| MinIOStorage
    NestAPI -->|Enqueue Search/Ingest Jobs| BullQueue
    BullQueue -->|Queue State| RedisCluster
    NestAPI -->|Publish Events| KafkaProducer
    KafkaProducer -->|Partitioned by cameraId| KafkaCluster

    KafkaCluster -->|Consume Frames & Commands| KafkaConsumer
    KafkaConsumer --> PyIngest
    PyIngest -->|Raw Frames| MinIOStorage
    PyIngest --> PyYolo
    PyYolo -->|Person Crops| PyFace
    PyYolo -->|Person Crops| PyReid

    %% Vector Store separation
    PyFace -->|Upsert 512-dim Face Vector| PineconeFace
    PyReid -->|Upsert 256-dim Re-ID Vector| PineconeReid

    %% Search & Matching Fanout
    NestAPI -.->|Query 1: Face Vector| PineconeFace
    NestAPI -.->|Query 2: Re-ID Vector| PineconeReid
    NestAPI -->|Fuse Ranked Lists - RRF| NestAPI

    %% Sighting Creation & Live Notification
    NestAPI -->|Store Sighting (Pending Review)| MongoCluster
    NestAPI -->|Push Possible Sighting| WSServer
    WSServer -->|Live Sighting Push| WSClient
    WSClient --> UI
```

---

## 2. Core Architectural Invariants

### 1. Strict Feature Space Separation
* **Face embeddings** (ArcFace, 512 dimensions) and **Body Re-ID embeddings** (OSNet, 256 dimensions) inhabit mathematically distinct metric spaces.
* They are **never concatenated, averaged, or mixed** in vector storage or query logic.
* Dual-vector search is performed via **fan-out querying**:
  1. Query Pinecone `face-embeddings` index.
  2. Query Pinecone `reid-embeddings` index.
  3. Combine distinct candidate lists using **Reciprocal Rank Fusion (RRF)** at the API layer.

### 2. Camera-Partitioned Event Streaming
* All video frame and detection events use `cameraId` as the Kafka partition key.
* This guarantees that all frames and detections for a specific physical camera stream are consumed sequentially and in timestamp order by a single consumer partition, ensuring deterministic local ByteTrack tracking state.

### 3. Idempotent Processing (Effectively-Once Delivery)
* Every event utilizes the canonical `EventEnvelope` with a globally unique `eventId` (UUIDv4).
* Consumers implement Redis atomic deduplication via `SETNX event:{eventId} 1 EX 86400`.
* If `SETNX` returns `0`, the event has already been processed or is currently in flight and is safely acknowledged and skipped.
* Combined with Kafka's at-least-once delivery, this delivers **effectively-once** semantics.

### 4. Human-in-the-Loop Verification
* Sighting records default to `status: "pending_review"`.
* Confidence is surfaced to operators exclusively as **ordinal bands** (`low`, `medium`, `high`), accompanied by the UI label **"Possible match"**.
* Raw cosine similarities (`0.0` to `1.0`) are retained strictly for internal algorithmic ranking and auditing.

---

## 3. Technology Stack Reference

| Subsystem | Technology | Responsibility |
|---|---|---|
| **Frontend** | Next.js 15 App Router, React 19, shadcn/ui, Tailwind CSS, Zustand, TanStack Query | Black & white operator console, case management, real-time sighting review |
| **Backend API** | NestJS 10, TypeScript, Mongoose, Socket.IO, BullMQ, KafkaJS | REST Gateway, business logic, RRF fusion, WebSocket push notifications |
| **Inference Service** | Python 3.11, FastAPI, PyTorch, aiokafka, Pillow, Pydantic | Stream ingestion, YOLOv8 detection, SCRFD face crop, ArcFace, OSNet Re-ID |
| **Vector DB** | Pinecone (Cosine Metric, Serverless) | Separate indexes for `face-embeddings` (512d) and `reid-embeddings` (256d) |
| **Event Broker** | Apache Kafka 3.7+ (KRaft mode, no ZooKeeper) | Event streaming across 9 canonical topics + DLQs |
| **Infra & Cache** | Redis 7, MongoDB 7, MinIO S3, Prometheus, Grafana | Job scheduling, deduplication, primary datastore, object storage, observability |
