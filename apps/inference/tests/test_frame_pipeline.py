"""
Tests for Phase C2 Live Frame Vision Consumer & Evidentiary Retention Pipeline.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import hashlib
import json
import time
import pytest
import numpy as np
import cv2
from unittest.mock import AsyncMock, MagicMock

from sentinel_inference.frame_consumer import LiveFrameVisionConsumer, TOPIC_CANDIDATES_SCORED


@pytest.fixture
def mock_redis():
    client = MagicMock()
    store = {}

    def get(k):
        return store.get(k)

    def set_fn(k, v, ex=None):
        store[k] = v
        return True

    client.get.side_effect = get
    client.set.side_effect = set_fn
    return client


@pytest.mark.asyncio
async def test_frame_consumer_pipeline_and_evidence_sha256(mock_redis):
    """Verifies that frame consumer fetches by URI, computes latency, hashes evidence with SHA-256, and boosts FPS."""
    consumer = LiveFrameVisionConsumer(brokers="localhost:9092")
    consumer.redis = mock_redis
    consumer.producer = AsyncMock()
    consumer.producer.send = AsyncMock()

    # Create synthetic frame and store in Redis
    dummy_frame = np.random.randint(0, 255, (720, 1280, 3), dtype=np.uint8)
    _, jpeg_buf = cv2.imencode(".jpg", dummy_frame)
    jpeg_bytes = jpeg_buf.tobytes()

    frame_id = "frm_cam_001_99"
    mock_redis.set(f"frame:{frame_id}", jpeg_bytes)

    # Frame capture timestamp was 45 ms ago
    now = time.time()
    capture_ts = now - 0.045
    frame_uri = f"redis://frame:{frame_id}"

    # Process frame through pipeline
    await consumer._process_frame(
        camera_id="cam_001",
        frame_id=frame_id,
        frame_uri=frame_uri,
        jpeg_bytes=jpeg_bytes,
        frame_ts=capture_ts,
        latency_ms=45.0,
    )

    # 1. Verify camera sample_fps boost key was set in Redis to 8.0
    mock_redis.set.assert_any_call("camera:cam_001:sample_fps", "8.0", ex=30)

    # 2. Verify candidate sighting was emitted to Kafka
    assert consumer.producer.send.call_count == 1
    call_kwargs = consumer.producer.send.call_args[1]
    assert call_kwargs["topic"] == TOPIC_CANDIDATES_SCORED
    assert call_kwargs["key"] == b"cam_001"

    candidate_env = json.loads(call_kwargs["value"].decode("utf-8"))
    payload = candidate_env["payload"]

    # 3. Verify SHA-256 hash matches the frame bytes
    expected_hash = hashlib.sha256(jpeg_bytes).hexdigest()
    assert payload["evidenceSha256"] == expected_hash

    # 4. Verify separation of metric spaces
    assert "faceScore" in payload
    assert "reidScore" in payload
    assert payload["faceScore"] == 0.89
    assert payload["reidScore"] == 0.86

    # 5. Verify compliance phrasing and latency metric
    assert payload["displayLabel"] == "Possible match"
    assert payload["endToEndLatencyMs"] == 45.0
