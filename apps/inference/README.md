# Sentinel Vision AI — Inference Service

FastAPI service handling:
- RTSP camera frame ingestion (FFmpeg/GStreamer)
- Person detection (YOLOv8)
- Face detection + embedding (SCRFD + ArcFace)
- Re-ID embedding (OSNet)
- ByteTrack local tracking
- Kafka event publishing

## Setup

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -e ".[dev]"

# Install torch separately (large download)
pip install -e ".[torch]"

# Run dev server
uvicorn sentinel_inference.main:app --reload --port 8000
```

## Environment Variables

Copy `../../.env.example` to `.env` and fill in values.
