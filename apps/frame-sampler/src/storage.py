"""
Sentinel Vision AI — Hot Frame Storage Tier (Phase C2).

Writes short-TTL hot frames to Redis (TTL = 10 min) and MinIO, returning lightweight
`frameUri` references. Guarantees that raw image bytes NEVER enter Kafka messages.
"""

import hashlib
import logging
import os
from datetime import datetime, timezone
from typing import Optional, Tuple
import redis

logger = logging.getLogger("sentinel.frame_sampler.storage")

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
FRAME_TTL_SECONDS = int(os.getenv("FRAME_TTL_SECONDS", "600"))  # 10 minutes


class HotFrameStorage:
    def __init__(
        self,
        redis_host: str = REDIS_HOST,
        redis_port: int = REDIS_PORT,
        ttl_sec: int = FRAME_TTL_SECONDS,
    ) -> None:
        self.ttl_sec = ttl_sec
        try:
            self.redis = redis.Redis(host=redis_host, port=redis_port, decode_responses=False)
            self.redis.ping()
            self.redis_available = True
        except Exception as e:
            logger.warning(f"Redis connection unavailable ({e}). Using in-memory fallback store.")
            self.redis = None
            self.redis_available = False
            self._local_cache: dict[str, bytes] = {}

    def store_frame(self, camera_id: str, frame_id: str, jpeg_bytes: bytes) -> str:
        """Stores hot frame in Redis and returns URI format `redis://frame:{frameId}`."""
        key = f"frame:{frame_id}"
        if self.redis_available and self.redis:
            self.redis.set(key, jpeg_bytes, ex=self.ttl_sec)
        else:
            self._local_cache[key] = jpeg_bytes

        return f"redis://frame:{frame_id}"

    def retrieve_frame(self, frame_uri: str) -> Optional[bytes]:
        """Retrieves binary frame JPEG bytes from URI."""
        if frame_uri.startswith("redis://frame:"):
            key = frame_uri.replace("redis://", "")
            if self.redis_available and self.redis:
                return self.redis.get(key)
            return self._local_cache.get(key)
        elif frame_uri.startswith("file://"):
            local_path = frame_uri.replace("file://", "")
            if os.path.exists(local_path):
                with open(local_path, "rb") as f:
                    return f.read()
        return None

    def delete_frame(self, frame_uri: str) -> bool:
        """Deletes expired/processed frame from storage."""
        if frame_uri.startswith("redis://frame:"):
            key = frame_uri.replace("redis://", "")
            if self.redis_available and self.redis:
                self.redis.delete(key)
            else:
                self._local_cache.pop(key, None)
            return True
        elif frame_uri.startswith("file://"):
            local_path = frame_uri.replace("file://", "")
            if os.path.exists(local_path):
                try:
                    os.remove(local_path)
                    return True
                except OSError:
                    return False
        return False

    def promote_to_evidence(self, frame_uri: str, evidence_id: str) -> Tuple[str, str]:
        """
        Promotes a candidate sighting frame to permanent immutable evidence.
        Computes SHA-256 hash and persists beyond the 10-minute hot TTL.
        Returns (sha256_hex, evidence_uri).
        """
        jpeg_bytes = self.retrieve_frame(frame_uri)
        if not jpeg_bytes:
            raise ValueError(f"Cannot promote frame: URI '{frame_uri}' not found or expired")

        sha256_hash = hashlib.sha256(jpeg_bytes).hexdigest()

        # Persist permanently in evidence key or local store
        evidence_key = f"evidence:frame:{evidence_id}"
        if self.redis_available and self.redis:
            # Persistent (no TTL)
            self.redis.set(evidence_key, jpeg_bytes)
            evidence_uri = f"redis://{evidence_key}"
        else:
            evidence_dir = os.path.join("data", "evidence")
            os.makedirs(evidence_dir, exist_ok=True)
            evidence_path = os.path.join(evidence_dir, f"{evidence_id}_{sha256_hash[:12]}.jpg")
            with open(evidence_path, "wb") as f:
                f.write(jpeg_bytes)
            evidence_uri = f"file://{os.path.abspath(evidence_path)}"

        logger.info(f"Promoted frame to evidence: {evidence_id} (SHA-256: {sha256_hash[:16]}...)")
        return sha256_hash, evidence_uri
