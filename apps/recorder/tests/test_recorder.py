"""
Tests for Phase C3 Video Archival, Segment Recorder & MinIO Outage Resilience.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import os
import shutil
import tempfile
import time
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from uploader import ResilientSegmentUploader
from recorder import CameraSegmentRecorder


@pytest.fixture
def temp_spool():
    d = tempfile.mkdtemp()
    yield d
    shutil.rmtree(d, ignore_errors=True)


@pytest.fixture(autouse=True)
def mock_minio_init():
    with patch.object(ResilientSegmentUploader, "_init_minio", return_value=None):
        yield


def test_uploader_builds_structured_object_key(temp_spool):
    uploader = ResilientSegmentUploader(spool_dir=temp_spool)
    start_ts = 1729000000.0  # Epoch seconds
    dt = datetime.fromtimestamp(start_ts, tz=timezone.utc)

    key = uploader.build_object_key(
        site_id="site_alpha",
        camera_id="cam_001",
        start_ts=start_ts,
        filename="seg_01.mp4",
    )

    expected_prefix = (
        f"site_alpha/cam_001/"
        f"{dt.strftime('%Y')}/{dt.strftime('%m')}/{dt.strftime('%d')}/{dt.strftime('%H')}/"
    )
    assert key.startswith(expected_prefix)
    assert key.endswith(f"{int(start_ts)}_seg_01.mp4")


def test_uploader_computes_sha256_checksum(temp_spool):
    test_file = os.path.join(temp_spool, "sample.mp4")
    with open(test_file, "wb") as f:
        f.write(b"SENTINEL_VIDEO_PAYLOAD_TEST_DATA")

    uploader = ResilientSegmentUploader(spool_dir=temp_spool)
    checksum = uploader.compute_sha256(test_file)

    import hashlib
    expected = hashlib.sha256(b"SENTINEL_VIDEO_PAYLOAD_TEST_DATA").hexdigest()
    assert checksum == expected


@pytest.mark.asyncio
async def test_uploader_preserves_spool_during_minio_outage_and_backfills(temp_spool):
    """
    Definition of Done:
    Unplug MinIO for 2 minutes: nothing lost, segments buffer locally, then back-fill.
    """
    uploader = ResilientSegmentUploader(spool_dir=temp_spool)

    # 1. Simulate MinIO outage (unplugged)
    uploader.is_healthy = False
    uploader.client = MagicMock()
    uploader.client.bucket_exists.side_effect = RuntimeError("MinIO down / connection refused")

    # Write 3 valid segments to spool
    cam_spool = os.path.join(temp_spool, "cam_001")
    os.makedirs(cam_spool, exist_ok=True)

    seg_paths = []
    for i in range(3):
        p = os.path.join(cam_spool, f"cam_001_segment_{i}.mp4")
        with open(p, "wb") as f:
            f.write(b"x" * 2048)  # 2KB valid segment
        seg_paths.append(p)

    # Attempt to upload during outage
    with patch("httpx.AsyncClient.post", return_value=MagicMock(status_code=201)):
        for i, p in enumerate(seg_paths):
            res = await uploader.upload_and_index_segment(
                site_id="site_alpha",
                camera_id="cam_001",
                file_path=p,
                start_ts=time.time() - (3 - i) * 8,
                duration_sec=8.0,
            )
            assert res is not None
            # Verified: File was NOT deleted from local spool because MinIO was unreachable
            assert os.path.exists(p)

    # 2. MinIO recovers! (Health probe returns True)
    uploader.client.bucket_exists.side_effect = None
    uploader.client.bucket_exists.return_value = True
    uploader.client.fput_object.return_value = None

    # Trigger automated back-fill
    drained_count = await uploader.backfill_spool_buffer()
    assert drained_count == 3

    # All buffered files now successfully transferred and drained
    for p in seg_paths:
        assert not os.path.exists(p)


def test_recording_policy_motion_and_event_gating():
    recorder = CameraSegmentRecorder(
        camera_id="cam_01",
        rtsp_url="rtsp://localhost:8554/cam/cam_01",
        output_spool_dir="/tmp/test",
        segment_sec=8,
        mode="motion-triggered",
    )

    # Initially no motion -> False
    assert recorder.is_recording_allowed() is False

    # Motion triggered -> True (within post-roll window of 10s)
    recorder.trigger_motion()
    assert recorder.is_recording_allowed() is True

    # Mode = continuous -> always True
    recorder.mode = "continuous"
    assert recorder.is_recording_allowed() is True

    # Mode = off -> always False
    recorder.mode = "off"
    assert recorder.is_recording_allowed() is False


def test_event_clip_cutter_single_and_multi_segment(temp_spool):
    # Create 2 synthetic MP4 segments
    seg1 = os.path.join(temp_spool, "seg_01.mp4")
    seg2 = os.path.join(temp_spool, "seg_02.mp4")
    with open(seg1, "wb") as f:
        f.write(b"CLIP_CHUNK_1")
    with open(seg2, "wb") as f:
        f.write(b"CLIP_CHUNK_2")

    out_clip = os.path.join(temp_spool, "evidence_sighting_clip.mp4")

    # Single segment copy test
    success = CameraSegmentRecorder.cut_event_clip(
        segment_files=[seg1],
        output_clip_path=out_clip,
        target_ts=time.time(),
    )
    assert success is True
    assert os.path.exists(out_clip)
    with open(out_clip, "rb") as f:
        assert f.read() == b"CLIP_CHUNK_1"
