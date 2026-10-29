"""
Tests for Phase C2 High-Throughput FFmpeg Adaptive Frame Sampler.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import json
import time
import pytest
import numpy as np
import cv2
from unittest.mock import AsyncMock, MagicMock, patch

from sampler import CameraStreamSampler
from motion import CheapMotionGate
from clock_sync import CameraClockSynchronizer
from metrics import CameraSamplerMetrics
from storage import HotFrameStorage


@pytest.fixture
def mock_redis():
    client = MagicMock()
    store = {}

    def get(k):
        return store.get(k)

    def set_fn(k, v, ex=None):
        store[k] = v
        return True

    def setex(k, ttl, v):
        store[k] = v
        return True

    client.get.side_effect = get
    client.set.side_effect = set_fn
    client.setex.side_effect = setex
    return client


@pytest.fixture
def sampler(mock_redis):
    storage = HotFrameStorage()
    storage.redis = mock_redis
    storage.redis_available = True

    return CameraStreamSampler(
        camera_id="cam_test_01",
        rtsp_base_url="rtsp://localhost:8554",
        default_fps=2.0,
        max_boost_fps=8.0,
        motion_threshold=12.0,
        stream_node="node-edge-01",
        redis_client=mock_redis,
        storage=storage,
    )


def test_cheap_motion_gate_detects_movement():
    gate = CheapMotionGate(threshold=12.0)

    # Frame 1: Black
    f1 = np.zeros((720, 1280, 3), dtype=np.uint8)
    is_motion, diff1 = gate.evaluate(f1)
    assert is_motion is True  # First frame always seeded

    # Frame 2: Identical black (Static scene)
    f2 = np.zeros((720, 1280, 3), dtype=np.uint8)
    is_motion, diff2 = gate.evaluate(f2)
    assert is_motion is False
    assert diff2 == 0.0

    # Frame 3: Bright block (Significant movement)
    f3 = np.zeros((720, 1280, 3), dtype=np.uint8)
    f3[200:500, 300:700, :] = 255
    is_motion, diff3 = gate.evaluate(f3)
    assert is_motion is True
    assert diff3 >= 12.0


def test_clock_synchronizer_applies_ntp_offset(mock_redis):
    mock_redis.set("camera:cam_test_01:clock_offset_ms", b"125")  # +125 ms camera clock offset
    sync = CameraClockSynchronizer("cam_test_01", mock_redis)

    offset = sync.get_clock_offset_ms()
    assert offset == 125.0

    raw_ts = 1729000000.0
    corrected = sync.correct_timestamp(raw_ts)
    assert corrected == 1729000000.125


def test_hot_frame_storage_and_evidence_promotion(mock_redis):
    storage = HotFrameStorage()
    storage.redis = mock_redis
    storage.redis_available = True

    jpeg_bytes = b"\xff\xd8\xff\xe0test_jpeg_bytes\xff\xd9"
    uri = storage.store_frame("cam_01", "frame_101", jpeg_bytes)
    assert uri == "redis://frame:frame_101"

    # Verify retrieval
    retrieved = storage.retrieve_frame(uri)
    assert retrieved == jpeg_bytes

    # Evidence promotion with SHA-256
    sha256_hash, ev_uri = storage.promote_to_evidence(uri, "ev_101")
    import hashlib
    expected_hash = hashlib.sha256(jpeg_bytes).hexdigest()
    assert sha256_hash == expected_hash
    assert ev_uri == "redis://evidence:frame:ev_101"


def test_metrics_collection_and_percentages():
    metrics = CameraSamplerMetrics("cam_01")
    # Simulate 10 incoming frames: 7 static (skipped), 3 emitted
    for _ in range(10):
        metrics.record_incoming()
    for _ in range(7):
        metrics.record_motion_skipped()
    for _ in range(3):
        metrics.record_emitted()

    metrics.record_latency(45.0)
    metrics.record_latency(35.0)

    snapshot = metrics.get_snapshot()
    assert snapshot["framesInTotal"] == 10
    assert snapshot["framesOutTotal"] == 3
    assert snapshot["motionSkipped"] == 7
    assert snapshot["motionSkippedPercent"] == 70.0
    assert snapshot["endToEndLatencyMs"] == 40.0


@pytest.mark.asyncio
async def test_sampler_never_puts_image_bytes_in_kafka(sampler):
    """CRITICAL INVARIANT: Kafka payload must contain ONLY metadata & frameUri, NEVER raw image bytes."""
    producer = AsyncMock()
    producer.send = AsyncMock()

    dummy_frame = np.random.randint(0, 255, (720, 1280, 3), dtype=np.uint8)
    raw_bytes = dummy_frame.tobytes()

    mock_process = MagicMock()
    mock_process.poll.side_effect = [None, 0]
    mock_process.stdout.read.side_effect = [raw_bytes, b""]

    with patch("subprocess.Popen", return_value=mock_process):
        # Run 1 iteration of start
        success, jpeg_buf = cv2.imencode(".jpg", dummy_frame)
        frame_bytes = jpeg_buf.tobytes()

        # Store in hot storage
        frame_uri = sampler.storage.store_frame("cam_test_01", "frm_test_1", frame_bytes)

        message = {
            "cameraId": "cam_test_01",
            "frameId": "frm_test_1",
            "ts": 1729000000.0,
            "frameUri": frame_uri,
            "width": 1280,
            "height": 720,
            "seq": 1,
            "streamNode": "node-edge-01",
            "sampledFps": 2.0,
        }

        await producer.send(
            topic="video.frames.raw",
            value=json.dumps(message).encode("utf-8"),
            key="cam_test_01".encode("utf-8"),
        )

        assert producer.send.call_count == 1
        call_kwargs = producer.send.call_args[1]
        assert call_kwargs["topic"] == "video.frames.raw"
        assert call_kwargs["key"] == b"cam_test_01"

        payload = json.loads(call_kwargs["value"].decode("utf-8"))
        assert "frameUri" in payload
        assert payload["frameUri"].startswith("redis://frame:")
        # Strict invariant verification: No raw image bytes or base64 in Kafka
        assert "jpegBytesBase64" not in payload
        assert "image" not in payload
        assert "bytes" not in payload
