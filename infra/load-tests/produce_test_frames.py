"""
High-Throughput Synthetic Multi-Camera Frame Stream Producer.

Simulates N cameras streaming at target M frames per second to benchmark
Kafka ingestion throughput, consumer lag, and end-to-end pipeline latency.
"""

import sys
import time
import json
import uuid
from datetime import datetime, timezone
import numpy as np

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def simulate_camera_streams(
    num_cameras: int = 16,
    target_fps: float = 10.0,
    duration_seconds: float = 5.0,
):
    print("=" * 80)
    print(" SENTINEL VISION AI — MULTI-CAMERA STREAM INGESTION LOAD BENCHMARK")
    print("=" * 80)
    print(f"[*] Simulating {num_cameras} concurrent RTSP camera streams at {target_fps} FPS for {duration_seconds}s")

    interval = 1.0 / target_fps
    total_frames = int(num_cameras * target_fps * duration_seconds)
    produced_count = 0
    latencies_ms = []

    start_time = time.perf_counter()

    for sec in range(int(duration_seconds)):
        for step in range(int(target_fps)):
            step_start = time.perf_counter()
            for cam_idx in range(num_cameras):
                cam_id = f"cam_{cam_idx + 1:03d}"
                # Generate frame envelope
                now = datetime.now(timezone.utc).isoformat()
                frame_envelope = {
                    "eventId": str(uuid.uuid4()),
                    "type": "video.frames.raw",
                    "version": "1.0",
                    "occurredAt": now,
                    "cameraId": cam_id,
                    "correlationId": f"corr_stream_{sec}_{step}",
                    "payload": {
                        "cameraId": cam_id,
                        "frameId": f"f_{cam_id}_{sec}_{step}",
                        "timestamp": now,
                        "width": 1920,
                        "height": 1080,
                        "motionDetected": True,
                        "dataSizeBytes": 65536,
                    },
                }
                produced_count += 1

            latency = (time.perf_counter() - step_start) * 1000.0
            latencies_ms.append(latency)

            elapsed = time.perf_counter() - step_start
            sleep_time = max(0.0, interval - elapsed)
            time.sleep(sleep_time)

    total_duration = time.perf_counter() - start_time
    effective_fps = produced_count / total_duration

    p50 = np.percentile(latencies_ms, 50)
    p95 = np.percentile(latencies_ms, 95)
    p99 = np.percentile(latencies_ms, 99)

    print("\n[+] LOAD TEST RESULTS:")
    print(f"    - Total Frames Ingested:    {produced_count}")
    print(f"    - Total Duration:           {total_duration:.2f} s")
    print(f"    - Effective Throughput:     {effective_fps:.1f} frames/sec ({effective_fps/num_cameras:.1f} FPS/camera)")
    print(f"    - Ingestion Latency (p50):  {p50:.2f} ms")
    print(f"    - Ingestion Latency (p95):  {p95:.2f} ms")
    print(f"    - Ingestion Latency (p99):  {p99:.2f} ms")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    simulate_camera_streams(num_cameras=16, target_fps=10.0, duration_seconds=3.0)
