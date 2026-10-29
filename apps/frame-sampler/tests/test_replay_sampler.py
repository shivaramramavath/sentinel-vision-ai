"""
Tests for Phase C2 Detection-On-Demand Replay Sampler.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import os
import tempfile
import pytest
import numpy as np
import cv2
from unittest.mock import AsyncMock, MagicMock, patch

from replay_sampler import ReplayStreamSampler
from storage import HotFrameStorage


@pytest.fixture
def temp_video():
    fd, path = tempfile.mkstemp(suffix=".mp4")
    os.close(fd)

    # Generate a tiny 1-second synthetic MP4 file using OpenCV VideoWriter
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(path, fourcc, 10.0, (1280, 720))
    for i in range(10):
        # Frame with moving white rectangle
        frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        frame[100:300, 100 + i * 20 : 300 + i * 20, :] = 255
        out.write(frame)
    out.release()

    yield path

    if os.path.exists(path):
        try:
            os.remove(path)
        except OSError:
            pass


@pytest.mark.asyncio
async def test_replay_sampler_processes_stored_segment(temp_video):
    """Verifies that ReplayStreamSampler extracts frames from archived segment without touching live feeds."""
    storage = HotFrameStorage()
    sampler = ReplayStreamSampler(
        camera_id="cam_001",
        job_id="job_search_101",
        case_id="case_mp_2026",
        segment_paths=[temp_video],
        sample_fps=2.0,
        storage=storage,
    )

    producer = AsyncMock()
    producer.send = AsyncMock()

    # Create dummy raw bytes for mock subprocess
    dummy_frame = np.random.randint(0, 255, (720, 1280, 3), dtype=np.uint8)
    raw_bytes = dummy_frame.tobytes()

    mock_process = MagicMock()
    mock_process.poll.side_effect = [None, None, 0]
    mock_process.stdout.read.side_effect = [raw_bytes, raw_bytes, b""]

    with patch("subprocess.Popen", return_value=mock_process):
        collected_frames = []
        async for frame_env in sampler.sample_segments(producer=producer, topic="video.frames.raw"):
            collected_frames.append(frame_env)

        assert len(collected_frames) == 2
        f1 = collected_frames[0]

        assert f1["isReplay"] is True
        assert f1["jobId"] == "job_search_101"
        assert f1["caseId"] == "case_mp_2026"
        assert f1["cameraId"] == "cam_001"
        assert "frameUri" in f1
        assert f1["frameUri"].startswith("redis://frame:")
        assert "jpegBytesBase64" not in f1  # Invariant: No raw bytes in Kafka
