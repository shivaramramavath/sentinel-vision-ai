"""
Redis track state persistence layer for fault-tolerant worker restarts.
"""

import json
import logging
from typing import Dict, List, Optional
import redis

from .track import STrack

logger = logging.getLogger("sentinel.tracking.state_store")


class TrackRedisStateStore:
    """
    Persists track state per camera in Redis so worker restarts
    do not lose track IDs, kinematic Kalman states, or EMA embeddings.
    Falls back gracefully to an in-memory dictionary if Redis is unreachable.
    """

    def __init__(self, redis_url: str = "redis://localhost:6379/0", ttl_seconds: int = 300):
        self.redis_url = redis_url
        self.ttl = ttl_seconds
        self._redis_client: Optional[redis.Redis] = None
        self._in_memory_store: Dict[str, Dict[int, str]] = {}
        self._is_redis_available = False

        self._init_redis()

    def _init_redis(self) -> None:
        try:
            client = redis.from_url(self.redis_url, decode_responses=True, socket_timeout=1.0)
            client.ping()
            self._redis_client = client
            self._is_redis_available = True
            logger.info("Connected to Redis track state store at %s", self.redis_url)
        except Exception as e:
            self._is_redis_available = False
            self._redis_client = None
            logger.warning("Redis unavailable (%s), using in-memory state store fallback.", e)

    def _key(self, camera_id: str) -> str:
        return f"sentinel:tracking:{camera_id}"

    def save_tracks(self, camera_id: str, tracks: List[STrack]) -> None:
        """Save active tracks for a camera."""
        if not tracks:
            return

        serialized = {str(t.track_id): json.dumps(t.to_dict()) for t in tracks}

        if self._is_redis_available and self._redis_client is not None:
            try:
                key = self._key(camera_id)
                pipeline = self._redis_client.pipeline()
                pipeline.delete(key)
                pipeline.hset(key, mapping=serialized)
                pipeline.expire(key, self.ttl)
                pipeline.execute()
                return
            except Exception as e:
                logger.warning("Failed saving tracks to Redis: %s. Falling back to in-memory.", e)
                self._is_redis_available = False

        # In-memory fallback
        self._in_memory_store[camera_id] = {t.track_id: json.dumps(t.to_dict()) for t in tracks}

    def load_tracks(self, camera_id: str) -> List[STrack]:
        """Load persisted tracks for a camera to resume tracking seamlessly."""
        tracks: List[STrack] = []

        if self._is_redis_available and self._redis_client is not None:
            try:
                key = self._key(camera_id)
                raw_dict = self._redis_client.hgetall(key)
                for _, json_val in raw_dict.items():
                    data = json.loads(json_val)
                    tracks.append(STrack.from_dict(data))
                return tracks
            except Exception as e:
                logger.warning("Failed loading tracks from Redis: %s", e)
                self._is_redis_available = False

        # In-memory fallback
        if camera_id in self._in_memory_store:
            for _, json_val in self._in_memory_store[camera_id].items():
                data = json.loads(json_val)
                tracks.append(STrack.from_dict(data))

        return tracks

    def clear(self, camera_id: str) -> None:
        """Clear state for a camera."""
        if self._is_redis_available and self._redis_client is not None:
            try:
                self._redis_client.delete(self._key(camera_id))
            except Exception:
                pass
        self._in_memory_store.pop(camera_id, None)
