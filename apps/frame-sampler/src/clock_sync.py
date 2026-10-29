"""
Sentinel Vision AI — NTP Clock Synchronization & Temporal Alignment (Phase C2).

Applies NTP round-trip corrected clock offsets per camera to RTP/PTS timestamps,
ensuring multi-camera spatial-temporal journey reconstruction relies on synchronized time.
"""

import time
import logging
from typing import Optional
import redis

logger = logging.getLogger("sentinel.frame_sampler.clock_sync")


class CameraClockSynchronizer:
    def __init__(self, camera_id: str, redis_client: Optional[redis.Redis] = None) -> None:
        self.camera_id = camera_id
        self.redis = redis_client
        self.cached_offset_ms: float = 0.0
        self.last_sync_query: float = 0.0
        self.sync_refresh_sec: float = 10.0

    def get_clock_offset_ms(self) -> float:
        """Retrieves camera clock offset in milliseconds from Redis or local cache."""
        now = time.time()
        if now - self.last_sync_query < self.sync_refresh_sec:
            return self.cached_offset_ms

        self.last_sync_query = now
        if not self.redis:
            return self.cached_offset_ms

        try:
            val = self.redis.get(f"camera:{self.camera_id}:clock_offset_ms")
            if val is not None:
                # val can be bytes or str depending on client decode setting
                offset_str = val.decode("utf-8") if isinstance(val, bytes) else str(val)
                self.cached_offset_ms = float(offset_str)
        except Exception as e:
            logger.debug(f"[{self.camera_id}] Clock offset query warning: {e}")

        return self.cached_offset_ms

    def correct_timestamp(self, pts_or_wall_sec: float) -> float:
        """Returns clock-corrected epoch seconds for cross-camera temporal fusion."""
        offset_sec = self.get_clock_offset_ms() / 1000.0
        return round(pts_or_wall_sec + offset_sec, 3)
