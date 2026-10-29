"""
Redis Vector Query Result Cache for Pinecone / Milvus.

Caches nearest neighbor similarity query results by reference vector fingerprint
and filter criteria to eliminate redundant vector DB network roundtrips.
"""

import hashlib
import json
import logging
from typing import Any, Dict, List, Optional
import numpy as np

logger = logging.getLogger("sentinel.optimization.vector_cache")


class RedisVectorCache:
    """
    Caches vector query results in Redis with TTL.
    """

    def __init__(
        self,
        redis_client: Optional[Any] = None,
        ttl_seconds: int = 300,
    ):
        self.client = redis_client
        self.ttl = ttl_seconds
        self._local_cache: Dict[str, Tuple[List[Dict[str, Any]], float]] = {}

    def _make_key(self, vector: np.ndarray, namespace: str, top_k: int, filter_dict: Optional[Dict]) -> str:
        # Compute SHA-256 fingerprint of the query vector + query parameters
        vec_bytes = vector.astype(np.float32).tobytes()
        h = hashlib.sha256(vec_bytes)
        h.update(namespace.encode("utf-8"))
        h.update(str(top_k).encode("utf-8"))
        if filter_dict:
            h.update(json.dumps(filter_dict, sort_keys=True).encode("utf-8"))
        return f"vector:cache:{h.hexdigest()[:24]}"

    def get(
        self,
        vector: np.ndarray,
        namespace: str,
        top_k: int,
        filter_dict: Optional[Dict] = None,
    ) -> Optional[List[Dict[str, Any]]]:
        key = self._make_key(vector, namespace, top_k, filter_dict)

        if self.client is not None:
            try:
                cached = self.client.get(key)
                if cached:
                    return json.loads(cached)
            except Exception as e:
                logger.debug("Redis vector cache get error: %s", e)

        # Local in-memory check
        if key in self._local_cache:
            data, exp = self._local_cache[key]
            import time

            if time.time() < exp:
                return data
            else:
                del self._local_cache[key]

        return None

    def set(
        self,
        vector: np.ndarray,
        namespace: str,
        top_k: int,
        results: List[Dict[str, Any]],
        filter_dict: Optional[Dict] = None,
    ) -> None:
        key = self._make_key(vector, namespace, top_k, filter_dict)
        serialized = json.dumps(results)

        if self.client is not None:
            try:
                self.client.set(key, serialized, ex=self.ttl)
                return
            except Exception as e:
                logger.debug("Redis vector cache set error: %s", e)

        # Local in-memory store
        import time

        self._local_cache[key] = (results, time.time() + self.ttl)
