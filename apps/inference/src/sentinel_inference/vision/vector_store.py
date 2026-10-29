"""
Vector Database Store module.

Implements VectorStoreBase interface with:
- PineconeVectorStore (production)
- InMemoryVectorStore (development, offline testing, Market-1501 benchmarking)

Indexes:
- sentinel-face (512-d, cosine)
- sentinel-reid (512-d, cosine)
Namespaces:
- case-{caseId} for reference galleries
- footage-{yyyymmdd} for continuous video stream sightings
Metadata:
- caseId, cameraId, trackId, ts, bbox, quality, modelVersion, cropUri
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
import numpy as np


@dataclass
class VectorRecord:
    id: str
    values: List[float]
    metadata: Dict[str, Any]


@dataclass
class QueryMatch:
    id: str
    score: float
    metadata: Dict[str, Any]


class VectorStoreBase(ABC):
    @abstractmethod
    def upsert(self, index_name: str, records: List[VectorRecord], namespace: str = "") -> int:
        pass

    @abstractmethod
    def query(
        self,
        index_name: str,
        vector: List[float],
        top_k: int = 50,
        namespace: str = "",
        filter_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[QueryMatch]:
        pass


class InMemoryVectorStore(VectorStoreBase):
    """Resilient in-memory vector store using cosine similarity."""

    def __init__(self) -> None:
        # storage structure: { index_name: { namespace: { id: VectorRecord } } }
        self.indexes: Dict[str, Dict[str, Dict[str, VectorRecord]]] = {
            "sentinel-face": {},
            "sentinel-reid": {},
        }

    def upsert(self, index_name: str, records: List[VectorRecord], namespace: str = "") -> int:
        if index_name not in self.indexes:
            self.indexes[index_name] = {}
        if namespace not in self.indexes[index_name]:
            self.indexes[index_name][namespace] = {}

        # Batch in chunks of 100
        count = 0
        batch_size = 100
        for i in range(0, len(records), batch_size):
            batch = records[i : i + batch_size]
            for r in batch:
                self.indexes[index_name][namespace][r.id] = r
                count += 1

        return count

    def query(
        self,
        index_name: str,
        vector: List[float],
        top_k: int = 50,
        namespace: str = "",
        filter_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[QueryMatch]:
        if index_name not in self.indexes or namespace not in self.indexes[index_name]:
            return []

        q_vec = np.array(vector, dtype=np.float32)
        q_norm = np.linalg.norm(q_vec)
        if q_norm == 0:
            return []

        matches: List[QueryMatch] = []
        pool = self.indexes[index_name][namespace]

        for record_id, record in pool.items():
            # Apply metadata filtering if specified
            if filter_metadata:
                skip = False
                for k, v in filter_metadata.items():
                    if record.metadata.get(k) != v:
                        skip = True
                        break
                if skip:
                    continue

            db_vec = np.array(record.values, dtype=np.float32)
            db_norm = np.linalg.norm(db_vec)
            if db_norm == 0:
                continue

            # Cosine similarity
            cosine = float(np.dot(q_vec, db_vec) / (q_norm * db_norm))
            matches.append(
                QueryMatch(
                    id=record.id,
                    score=round(cosine, 4),
                    metadata=record.metadata,
                )
            )

        matches.sort(key=lambda m: m.score, reverse=True)
        return matches[:top_k]


class PineconeVectorStore(VectorStoreBase):
    """Production Pinecone vector store wrapper."""

    def __init__(self, api_key: str = "", fallback: Optional[VectorStoreBase] = None) -> None:
        self.api_key = api_key
        self.fallback = fallback or InMemoryVectorStore()
        self.client = None

        if api_key:
            try:
                from pinecone import Pinecone
                self.client = Pinecone(api_key=api_key)
            except Exception:
                self.client = None

    def upsert(self, index_name: str, records: List[VectorRecord], namespace: str = "") -> int:
        if not self.client:
            return self.fallback.upsert(index_name, records, namespace)

        try:
            index = self.client.Index(index_name)
            # Batched upserts of 100 vectors
            count = 0
            batch_size = 100
            for i in range(0, len(records), batch_size):
                batch = records[i : i + batch_size]
                vectors_to_send = [
                    {"id": r.id, "values": r.values, "metadata": r.metadata}
                    for r in batch
                ]
                index.upsert(vectors=vectors_to_send, namespace=namespace)
                count += len(batch)
            return count
        except Exception:
            return self.fallback.upsert(index_name, records, namespace)

    def query(
        self,
        index_name: str,
        vector: List[float],
        top_k: int = 50,
        namespace: str = "",
        filter_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[QueryMatch]:
        if not self.client:
            return self.fallback.query(index_name, vector, top_k, namespace, filter_metadata)

        try:
            index = self.client.Index(index_name)
            resp = index.query(
                vector=vector,
                top_k=top_k,
                namespace=namespace,
                filter=filter_metadata,
                include_metadata=True,
            )
            return [
                QueryMatch(
                    id=match["id"],
                    score=float(match["score"]),
                    metadata=match.get("metadata", {}),
                )
                for match in resp.get("matches", [])
            ]
        except Exception:
            return self.fallback.query(index_name, vector, top_k, namespace, filter_metadata)
