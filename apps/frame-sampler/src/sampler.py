"""
Sentinel Vision AI — High-Throughput Hardware-Accelerated FFmpeg Frame Sampler (Phase C2).

Extracts frames from MediaMTX substreams (`rtsp://mediamtx:8554/cam/{cameraId}/sub`)
with adaptive dynamic sampling rates (default 2 FPS, up to 8 FPS via Redis key `camera:{id}:sample_fps`),
cheap motion gating, NTP clock synchronization, and dual-tier hot frame storage (Redis/MinIO).

CRITICAL RULE: Emits small metadata envelopes to Kafka topic `video.frames.raw`.
NEVER puts raw image bytes into Kafka.
"""

import asyncio
import json
import logging
import os
import shutil
import subprocess
import time
import uuid
from typing import Optional, Tuple
import cv2
import numpy as np
import redis
from aiokafka import AIOKafkaProducer

from clock_sync import CameraClockSynchronizer
from metrics import CameraSamplerMetrics
from motion import CheapMotionGate
from storage import HotFrameStorage

logger = logging.getLogger("sentinel.frame_sampler")


def detect_ffmpeg_hwaccel() -> str:
    """Detects available hardware video decoding capabilities."""
    if not shutil.which("ffmpeg"):
        return "none"

    try:
        proc = subprocess.run(
            ["ffmpeg", "-hwaccels"],
            capture_output=True,
            text=True,
            timeout=2.0,
        )
        output = proc.stdout.lower()
        if "cuda" in output or "nvdec" in output:
            return "cuda"
        if "vaapi" in output:
            return "vaapi"
        if "d3d11va" in output:
            return "d3d11va"
    except Exception:
        pass
    return "none"


class CameraStreamSampler:
    """Manages an individual camera stream sampling worker with hardware acceleration & backpressure."""

    def __init__(
        self,
        camera_id: str = "",
        rtsp_base_url: str = "rtsp://localhost:8554",
        default_fps: float = 2.0,
        max_boost_fps: float = 8.0,
        motion_threshold: float = 12.0,
        stream_node: str = "node-edge-01",
        redis_client: Optional[redis.Redis] = None,
        storage: Optional[HotFrameStorage] = None,
    ) -> None:
        self.camera_id = camera_id
        self.rtsp_base_url = rtsp_base_url
        self.default_fps = default_fps
        self.max_boost_fps = max_boost_fps
        self.stream_node = stream_node

        self.redis = redis_client
        self.storage = storage or HotFrameStorage()
        self.clock_sync = CameraClockSynchronizer(camera_id, redis_client)
        self.motion_gate = CheapMotionGate(threshold=motion_threshold)
        self.metrics = CameraSamplerMetrics(camera_id, redis_client)

        self.running = False
        self.process: Optional[subprocess.Popen] = None
        self.hwaccel = detect_ffmpeg_hwaccel()

        # Dynamic sample rate state
        self.current_target_fps = default_fps
        self.last_fps_check: float = 0.0

        # Backpressure guard
        self.consecutive_slow_sends: int = 0
        self.last_send_latency_ms: float = 0.0

    def get_rtsp_url(self) -> str:
        """Prefers substream /sub if available, falls back to main stream."""
        return f"{self.rtsp_base_url}/cam/{self.camera_id}/sub"

    def refresh_dynamic_fps(self) -> float:
        """Queries Redis control key `camera:{id}:sample_fps` for active track boosts."""
        now = time.time()
        if now - self.last_fps_check < 2.0:
            return self.current_target_fps

        self.last_fps_check = now
        if not self.redis:
            return self.default_fps

        try:
            val = self.redis.get(f"camera:{self.camera_id}:sample_fps")
            if val is not None:
                val_str = val.decode("utf-8") if isinstance(val, bytes) else str(val)
                target = float(val_str)
                self.current_target_fps = max(1.0, min(target, self.max_boost_fps))
            else:
                self.current_target_fps = self.default_fps
        except Exception:
            self.current_target_fps = self.default_fps

        return self.current_target_fps

    async def start(self, producer: Optional[AIOKafkaProducer], topic: str = "video.frames.raw") -> None:
        self.running = True
        rtsp_url = self.get_rtsp_url()
        logger.info(
            f"Starting frame sampler for '{self.camera_id}' via {rtsp_url} "
            f"[hwaccel: {self.hwaccel} | default_fps: {self.default_fps} | max_boost: {self.max_boost_fps}]"
        )

        # Pipe frames at max_boost_fps (8 FPS) from FFmpeg; dynamically stride based on target FPS & motion
        pipe_fps = int(self.max_boost_fps)
        width, height = 1280, 720
        frame_size = width * height * 3

        # Assemble FFmpeg command with optional hardware decoding
        cmd = ["ffmpeg", "-loglevel", "warning"]
        if self.hwaccel == "cuda":
            cmd.extend(["-hwaccel", "cuda"])
        elif self.hwaccel == "vaapi":
            cmd.extend(["-hwaccel", "vaapi"])

        cmd.extend([
            "-rtsp_transport", "tcp",
            "-i", rtsp_url,
            "-vf", f"fps={pipe_fps},scale={width}:{height}",
            "-pix_fmt", "bgr24",
            "-f", "rawvideo",
            "pipe:1",
        ])

        raw_seq = 0
        emitted_seq = 0

        while self.running:
            try:
                self.process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                    bufsize=frame_size * 2,
                )

                loop = asyncio.get_running_loop()

                while self.running and self.process.poll() is None:
                    # Read 1 frame chunk asynchronously from stdout
                    raw_bytes = await loop.run_in_executor(
                        None, self.process.stdout.read, frame_size
                    )

                    if not raw_bytes or len(raw_bytes) < frame_size:
                        break

                    raw_seq += 1
                    self.metrics.record_incoming()
                    now = time.time()

                    # 1. Inspect dynamic target FPS from Redis
                    target_fps = self.refresh_dynamic_fps()

                    # 2. Backpressure Throttling (Kafka Consumer Lag Guard)
                    # If consecutive send latency > 200 ms, throttle down to 1 FPS
                    if self.consecutive_slow_sends >= 3:
                        target_fps = 1.0
                        self.metrics.record_dropped(1)

                    # Dynamic Stride Calculation
                    stride = max(1, int(round(pipe_fps / target_fps)))
                    if raw_seq % stride != 0:
                        continue

                    # Reshape frame numpy array
                    frame_array = np.frombuffer(raw_bytes, dtype=np.uint8).reshape((height, width, 3))

                    # 3. Cheap Motion Gating (Skip near-duplicate static frames)
                    is_motion, mean_diff = self.motion_gate.evaluate(frame_array)

                    # If scene is static (no motion) and no active boost is requested, skip frame
                    if not is_motion and target_fps <= self.default_fps:
                        self.metrics.record_motion_skipped()
                        continue

                    # 4. Resize to Model Input Max (1280 long side) & JPEG Encoding (~85 quality)
                    success, jpeg_buf = cv2.imencode(
                        ".jpg", frame_array, [cv2.IMWRITE_JPEG_QUALITY, 85]
                    )
                    if not success:
                        continue

                    frame_id = f"frm_{self.camera_id}_{uuid.uuid4().hex[:12]}"
                    jpeg_bytes = jpeg_buf.tobytes()

                    # 5. Store hot frame in Redis/MinIO (Never in Kafka!)
                    frame_uri = self.storage.store_frame(
                        camera_id=self.camera_id,
                        frame_id=frame_id,
                        jpeg_bytes=jpeg_bytes,
                    )

                    # 6. Apply NTP-corrected camera clock timestamp
                    corrected_ts = self.clock_sync.correct_timestamp(now)

                    emitted_seq += 1
                    self.metrics.record_emitted()

                    # 7. Construct SMALL Kafka message (No raw image bytes)
                    message = {
                        "cameraId": self.camera_id,
                        "frameId": frame_id,
                        "ts": corrected_ts,
                        "frameUri": frame_uri,
                        "width": width,
                        "height": height,
                        "seq": emitted_seq,
                        "streamNode": self.stream_node,
                        "sampledFps": target_fps,
                        "isMotion": is_motion,
                        "meanDiff": mean_diff,
                    }

                    # 8. Dispatch to Kafka topic video.frames.raw with key = cameraId
                    if producer is not None:
                        t_send = time.perf_counter()
                        try:
                            await producer.send(
                                topic=topic,
                                value=json.dumps(message).encode("utf-8"),
                                key=self.camera_id.encode("utf-8"),
                            )
                            send_latency_ms = (time.perf_counter() - t_send) * 1000.0
                            self.last_send_latency_ms = send_latency_ms

                            if send_latency_ms > 200.0:
                                self.consecutive_slow_sends += 1
                            else:
                                self.consecutive_slow_sends = max(0, self.consecutive_slow_sends - 1)

                            # Record end-to-end ingest transit latency
                            transit_latency_ms = (time.time() - now) * 1000.0 + send_latency_ms
                            self.metrics.record_latency(transit_latency_ms)

                        except Exception as pe:
                            logger.warning(f"[{self.camera_id}] Kafka send error: {pe}")
                            self.consecutive_slow_sends += 2
                            self.metrics.record_dropped(1)

                    # Periodically flush per-camera metrics to Redis
                    self.metrics.flush_to_redis()

            except Exception as e:
                logger.warning(f"Stream error on '{self.camera_id}': {e}. Reconnecting in 5s...")
                await asyncio.sleep(5)
            finally:
                if self.process:
                    try:
                        self.process.kill()
                    except Exception:
                        pass

    def stop(self) -> None:
        self.running = False
        if self.process:
            try:
                self.process.kill()
            except Exception:
                pass
        self.metrics.flush_to_redis()
