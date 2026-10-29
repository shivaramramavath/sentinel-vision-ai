"""
Sentinel Vision AI — High-Throughput Frame Sampler Daemon (Phase C2).

Discovers active MediaMTX camera streams, manages per-camera hardware-accelerated
substream samplers, applies cheap motion gating, stores hot frames in Redis/MinIO,
and publishes lightweight metadata envelopes to Kafka topic `video.frames.raw`.
"""

import asyncio
import logging
import os
import signal
from typing import Dict
import httpx
import redis
from aiokafka import AIOKafkaProducer

from sampler import CameraStreamSampler
from storage import HotFrameStorage

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("sentinel.frame_sampler")

MEDIAMTX_API_URL = os.getenv("MEDIAMTX_API_URL", "http://localhost:9997")
MEDIAMTX_RTSP_BASE = os.getenv("MEDIAMTX_RTSP_BASE", "rtsp://localhost:8554")
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:9092")
TOPIC_FRAMES_RAW = os.getenv("TOPIC_FRAMES_RAW", "video.frames.raw")
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
STREAM_NODE = os.getenv("STREAM_NODE", "node-edge-01")

DEFAULT_FPS = float(os.getenv("DEFAULT_FPS", "2.0"))
MAX_BOOST_FPS = float(os.getenv("MAX_BOOST_FPS", "8.0"))
MOTION_THRESHOLD = float(os.getenv("MOTION_THRESHOLD", "12.0"))


async def discover_active_camera_paths(client: httpx.AsyncClient) -> list[str]:
    """Queries MediaMTX API /v3/paths/list to discover all streams with active publishers."""
    try:
        resp = await client.get(f"{MEDIAMTX_API_URL}/v3/paths/list", timeout=3.0)
        if resp.status_code != 200:
            return []

        data = resp.json()
        items = data.get("items", [])
        active_camera_ids = []

        for item in items:
            name = item.get("name", "")
            # Only track cam/{cameraId} paths that are ready / being published to
            if name.startswith("cam/") and item.get("ready", False):
                camera_id = name.split("/", 1)[1]
                # Ignore substream / preview paths from discovery list
                if "/" not in camera_id:
                    active_camera_ids.append(camera_id)

        return active_camera_ids
    except Exception as e:
        logger.debug(f"MediaMTX discovery probe: {e}")
        return []


async def main() -> None:
    logger.info("Initializing Sentinel Vision AI Frame Sampler (Phase C2)...")
    logger.info(f"MediaMTX API: {MEDIAMTX_API_URL} | RTSP Base: {MEDIAMTX_RTSP_BASE} | Kafka: {KAFKA_BROKERS}")

    # 1. Connect Redis Client
    try:
        redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=False)
        redis_client.ping()
        logger.info(f"Connected to Redis at {REDIS_HOST}:{REDIS_PORT}")
    except Exception as e:
        logger.warning(f"Could not connect to Redis ({e}). Running with local fallback store.")
        redis_client = None

    # 2. Initialize Hot Frame Storage
    storage = HotFrameStorage(redis_host=REDIS_HOST, redis_port=REDIS_PORT)

    # 3. Connect Kafka Producer
    producer = AIOKafkaProducer(bootstrap_servers=KAFKA_BROKERS)
    try:
        await producer.start()
        logger.info("Kafka Producer connected successfully.")
    except Exception as e:
        logger.warning(f"Could not connect to Kafka directly ({e}). Running in fallback mode.")
        producer = None

    active_samplers: Dict[str, CameraStreamSampler] = {}
    active_tasks: Dict[str, asyncio.Task] = {}
    running = True

    def handle_shutdown(*_: any) -> None:
        nonlocal running
        logger.info("Received termination signal. Shutting down frame samplers...")
        running = False
        for s in active_samplers.values():
            s.stop()

    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            signal.signal(sig, handle_shutdown)
        except (ValueError, AttributeError):
            pass

    async with httpx.AsyncClient() as http_client:
        while running:
            try:
                active_camera_ids = await discover_active_camera_paths(http_client)

                # Start samplers for newly active cameras
                for cam_id in active_camera_ids:
                    if cam_id not in active_samplers:
                        sampler = CameraStreamSampler(
                            camera_id=cam_id,
                            rtsp_base_url=MEDIAMTX_RTSP_BASE,
                            default_fps=DEFAULT_FPS,
                            max_boost_fps=MAX_BOOST_FPS,
                            motion_threshold=MOTION_THRESHOLD,
                            stream_node=STREAM_NODE,
                            redis_client=redis_client,
                            storage=storage,
                        )
                        active_samplers[cam_id] = sampler
                        task = asyncio.create_task(
                            sampler.start(producer=producer, topic=TOPIC_FRAMES_RAW)
                        )
                        active_tasks[cam_id] = task
                        logger.info(f"[+] Attached hardware-accelerated frame sampler to camera '{cam_id}'")

                # Stop samplers for cameras that disconnected
                stopped_cameras = [cid for cid in active_samplers if cid not in active_camera_ids]
                for cam_id in stopped_cameras:
                    logger.info(f"[-] Camera '{cam_id}' stream offline. Releasing sampler.")
                    active_samplers[cam_id].stop()
                    task = active_tasks.pop(cam_id, None)
                    if task:
                        task.cancel()
                    del active_samplers[cam_id]

            except Exception as e:
                logger.error(f"Discovery loop exception: {e}")

            await asyncio.sleep(4.0)

    if producer:
        try:
            await producer.stop()
        except Exception:
            pass
    logger.info("Frame Sampler service terminated.")


if __name__ == "__main__":
    asyncio.run(main())
