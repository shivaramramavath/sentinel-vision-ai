"""
Sentinel Vision AI — Stream Recorder & Archival Daemon (Phase C3).

Manages per-camera FFmpeg stream copy segmentation (6-10s chunks),
enforces recording policies (continuous | motion-triggered | event-only | off),
moves completed segments to MinIO with local spool queue resilience,
and drains buffered back-fills after storage recovery.
"""

import asyncio
import logging
import os
import signal
import time
from typing import Dict, Set, Tuple
import httpx

from recorder import CameraSegmentRecorder
from uploader import ResilientSegmentUploader

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("sentinel.recorder")

MEDIAMTX_API_URL = os.getenv("MEDIAMTX_API_URL", "http://localhost:9997")
MEDIAMTX_RTSP_BASE = os.getenv("MEDIAMTX_RTSP_BASE", "rtsp://localhost:8554")
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ROOT_USER", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_ROOT_PASSWORD", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_RECORDINGS_BUCKET", "camera-recordings")
SEGMENT_SECONDS = int(os.getenv("SEGMENT_SECONDS", "8"))
SPOOL_BASE_DIR = os.getenv("SPOOL_BASE_DIR", "data/spool_recordings")


async def monitor_and_upload_segments(
    camera_id: str,
    spool_cam_dir: str,
    recorder: CameraSegmentRecorder,
    uploader: ResilientSegmentUploader,
    stop_event: asyncio.Event,
) -> None:
    """Watches local camera spool directory for completed segments, applies policy, and uploads."""
    uploaded_files: Set[str] = set()

    while not stop_event.is_set():
        try:
            if os.path.exists(spool_cam_dir):
                files = sorted(os.listdir(spool_cam_dir))
                # Never upload the latest active segment file (currently being written by FFmpeg)
                if len(files) > 1:
                    completed = files[:-1]
                    for f in completed:
                        file_path = os.path.join(spool_cam_dir, f)
                        if file_path not in uploaded_files:
                            # Verify file write completed
                            await asyncio.sleep(0.5)

                            if recorder.is_recording_allowed():
                                now = time.time()
                                start_ts = now - recorder.segment_sec
                                await uploader.upload_and_index_segment(
                                    site_id=recorder.site_id,
                                    camera_id=camera_id,
                                    file_path=file_path,
                                    start_ts=start_ts,
                                    duration_sec=float(recorder.segment_sec),
                                    motion_score=0.45,
                                    has_gap=False,
                                )
                            else:
                                # Policy gated (e.g. static scene in motion-triggered mode)
                                try:
                                    os.remove(file_path)
                                except OSError:
                                    pass

                            uploaded_files.add(file_path)
        except Exception as e:
            logger.error(f"Error monitoring spool segments for '{camera_id}': {e}")

        await asyncio.sleep(2.0)


async def discover_active_streams(client: httpx.AsyncClient) -> list[str]:
    try:
        resp = await client.get(f"{MEDIAMTX_API_URL}/v3/paths/list", timeout=3.0)
        if resp.status_code != 200:
            return []
        items = resp.json().get("items", [])
        return [
            item["name"].split("/", 1)[1]
            for item in items
            if item.get("name", "").startswith("cam/")
            and item.get("ready", False)
            and "/" not in item.get("name", "").split("/", 1)[1]
        ]
    except Exception:
        return []


async def periodic_spool_backfill_task(
    uploader: ResilientSegmentUploader, stop_event: asyncio.Event
) -> None:
    """Periodically drains local spool queue when MinIO connection is healthy."""
    while not stop_event.is_set():
        try:
            drained = await uploader.backfill_spool_buffer()
            if drained > 0:
                logger.info(f"Drained and back-filled {drained} spool segments to MinIO")
        except Exception as e:
            logger.debug(f"Spool backfill probe: {e}")

        await asyncio.sleep(15.0)


async def main() -> None:
    logger.info("Initializing Sentinel Video Recorder & Archival Service (Phase C3)...")
    logger.info(f"MinIO Endpoint: {MINIO_ENDPOINT} | Bucket: {MINIO_BUCKET} | Segment: {SEGMENT_SECONDS}s")

    uploader = ResilientSegmentUploader(
        endpoint=MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        bucket_name=MINIO_BUCKET,
        spool_dir=SPOOL_BASE_DIR,
    )

    active_recorders: Dict[str, CameraSegmentRecorder] = {}
    active_monitors: Dict[str, Tuple[asyncio.Task, asyncio.Event]] = {}
    running = True

    stop_backfill = asyncio.Event()
    backfill_task = asyncio.create_task(
        periodic_spool_backfill_task(uploader, stop_backfill)
    )

    def handle_shutdown(*_: any) -> None:
        nonlocal running
        logger.info("Termination signal received. Flushing active recordings...")
        running = False
        for rec in active_recorders.values():
            rec.stop()
        for _, ev in active_monitors.values():
            ev.set()
        stop_backfill.set()

    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            signal.signal(sig, handle_shutdown)
        except (ValueError, AttributeError):
            pass

    async with httpx.AsyncClient() as http_client:
        while running:
            try:
                active_camera_ids = await discover_active_streams(http_client)

                # Attach recorders to newly active camera streams
                for cam_id in active_camera_ids:
                    if cam_id not in active_recorders:
                        rtsp_url = f"{MEDIAMTX_RTSP_BASE}/cam/{cam_id}"
                        cam_spool = os.path.join(SPOOL_BASE_DIR, cam_id)
                        rec = CameraSegmentRecorder(
                            camera_id=cam_id,
                            rtsp_url=rtsp_url,
                            output_spool_dir=cam_spool,
                            segment_sec=SEGMENT_SECONDS,
                            mode="continuous",
                            site_id="site_primary",
                        )
                        rec.start()
                        active_recorders[cam_id] = rec

                        stop_ev = asyncio.Event()
                        monitor_task = asyncio.create_task(
                            monitor_and_upload_segments(
                                cam_id, cam_spool, rec, uploader, stop_ev
                            )
                        )
                        active_monitors[cam_id] = (monitor_task, stop_ev)
                        logger.info(f"[+] Recording started for '{cam_id}' ({SEGMENT_SECONDS}s segments)")

                # Detach recorders when stream stops
                stopped_cameras = [cid for cid in active_recorders if cid not in active_camera_ids]
                for cam_id in stopped_cameras:
                    logger.info(f"[-] Stream '{cam_id}' inactive. Finalizing recording.")
                    active_recorders[cam_id].stop()
                    del active_recorders[cam_id]

                    task, ev = active_monitors.pop(cam_id, (None, None))
                    if ev and task:
                        ev.set()
                        await asyncio.sleep(0.5)
                        task.cancel()

            except Exception as e:
                logger.error(f"Recorder main loop error: {e}")

            await asyncio.sleep(4.0)

    backfill_task.cancel()
    logger.info("Recorder service stopped.")


if __name__ == "__main__":
    asyncio.run(main())
