"""
Sentinel Vision AI — Detection-On-Demand Replay Sampler (Phase C2).

Extracts frames from archived video segments (MinIO/local MP4s) for historical forensic search jobs,
operating independently from live stream ingestion.
"""

import asyncio
import io
import json
import logging
import os
import subprocess
import time
import uuid
from typing import AsyncIterator, List, Optional
import cv2
import numpy as np
from aiokafka import AIOKafkaProducer

from motion import CheapMotionGate
from storage import HotFrameStorage

logger = logging.getLogger("sentinel.frame_sampler.replay")


class ReplayStreamSampler:
    """Samples archived MP4 video segments for offline historical search jobs."""

    def __init__(
        self,
        camera_id: str,
        job_id: str,
        case_id: str,
        segment_paths: List[str],
        sample_fps: float = 2.0,
        motion_threshold: float = 12.0,
        storage: Optional[HotFrameStorage] = None,
    ) -> None:
        self.camera_id = camera_id
        self.job_id = job_id
        self.case_id = case_id
        self.segment_paths = segment_paths
        self.sample_fps = sample_fps
        self.motion_gate = CheapMotionGate(threshold=motion_threshold)
        self.storage = storage or HotFrameStorage()
        self.cancelled = False

    async def sample_segments(
        self,
        producer: Optional[AIOKafkaProducer] = None,
        topic: str = "video.frames.raw",
    ) -> AsyncIterator[dict]:
        """Iterates through archived MP4 segments, extracting frames at sample_fps."""
        width, height = 1280, 720
        frame_size = width * height * 3
        seq = 0

        for seg_path in self.segment_paths:
            if self.cancelled:
                break

            if not os.path.exists(seg_path):
                logger.warning(f"Archived segment not found: {seg_path}")
                continue

            logger.info(f"Replay-sampling segment '{os.path.basename(seg_path)}' @ {self.sample_fps} FPS for job {self.job_id}")

            cmd = [
                "ffmpeg",
                "-loglevel", "warning",
                "-i", seg_path,
                "-vf", f"fps={self.sample_fps},scale={width}:{height}",
                "-pix_fmt", "bgr24",
                "-f", "rawvideo",
                "pipe:1",
            ]

            process = None
            try:
                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                    bufsize=frame_size * 2,
                )

                loop = asyncio.get_running_loop()

                while not self.cancelled and process.poll() is None:
                    raw_bytes = await loop.run_in_executor(
                        None, process.stdout.read, frame_size
                    )

                    if not raw_bytes or len(raw_bytes) < frame_size:
                        break

                    seq += 1
                    now = time.time()
                    frame_array = np.frombuffer(raw_bytes, dtype=np.uint8).reshape((height, width, 3))

                    # 1. Cheap motion gating check
                    is_motion, mean_diff = self.motion_gate.evaluate(frame_array)

                    # 2. Encode to JPEG
                    success, jpeg_buf = cv2.imencode(".jpg", frame_array, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    if not success:
                        continue

                    frame_id = f"rpl_{self.camera_id}_{uuid.uuid4().hex[:12]}"

                    # 3. Store frame in hot store
                    frame_uri = self.storage.store_frame(
                        camera_id=self.camera_id,
                        frame_id=frame_id,
                        jpeg_bytes=jpeg_buf.tobytes(),
                    )

                    frame_envelope = {
                        "cameraId": self.camera_id,
                        "frameId": frame_id,
                        "ts": now,
                        "frameUri": frame_uri,
                        "width": width,
                        "height": height,
                        "seq": seq,
                        "isReplay": True,
                        "jobId": self.job_id,
                        "caseId": self.case_id,
                        "segmentPath": seg_path,
                        "sampledFps": self.sample_fps,
                        "isMotion": is_motion,
                        "meanDiff": mean_diff,
                    }

                    if producer is not None:
                        await producer.send(
                            topic=topic,
                            value=json.dumps(frame_envelope).encode("utf-8"),
                            key=self.camera_id.encode("utf-8"),
                        )

                    yield frame_envelope

            except Exception as e:
                logger.error(f"Error replay-sampling {seg_path}: {e}")
            finally:
                if process:
                    try:
                        process.kill()
                    except Exception:
                        pass

    def cancel(self) -> None:
        self.cancelled = True
