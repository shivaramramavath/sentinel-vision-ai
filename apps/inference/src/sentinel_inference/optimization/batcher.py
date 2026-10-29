"""
Dynamic Crop Batcher for High-Throughput Model Inference.

Collects person or face crops from asynchronous video decoding streams,
batches them up to max_batch_size (e.g. 16) or until timeout_ms (e.g. 20 ms),
and feeds contiguous batched tensors to PyTorch / ONNX Runtime.
"""

import asyncio
import time
from typing import Any, Callable, Dict, List, Optional, Tuple
import numpy as np


class DynamicCropBatcher:
    """
    Dynamic batching accumulator for person crops.
    """

    def __init__(
        self,
        max_batch_size: int = 16,
        timeout_ms: float = 20.0,
        target_shape: Tuple[int, int] = (256, 128),  # H, W
    ):
        self.max_batch_size = max_batch_size
        self.timeout_sec = timeout_ms / 1000.0
        self.target_shape = target_shape

        self._queue: List[Tuple[np.ndarray, Any]] = []
        self._lock = asyncio.Lock()

    async def add_item(self, crop: np.ndarray, metadata: Any) -> None:
        """Add a crop to the pending batch."""
        async with self._lock:
            self._queue.append((crop, metadata))

    async def get_batch(self) -> Tuple[Optional[np.ndarray], List[Any]]:
        """
        Wait until batch is full or timeout expires, then return batched tensor.
        """
        start = time.perf_counter()

        while True:
            async with self._lock:
                if len(self._queue) >= self.max_batch_size:
                    batch_items = self._queue[: self.max_batch_size]
                    self._queue = self._queue[self.max_batch_size :]
                    return self._collate(batch_items)

                if len(self._queue) > 0 and (time.perf_counter() - start) >= self.timeout_sec:
                    batch_items = self._queue
                    self._queue = []
                    return self._collate(batch_items)

            await asyncio.sleep(0.002)

    def _collate(self, items: List[Tuple[np.ndarray, Any]]) -> Tuple[np.ndarray, List[Any]]:
        if not items:
            return None, []

        crops = [c for c, _ in items]
        metas = [m for _, m in items]

        # Stack into batch (B, H, W, C)
        stacked = np.stack(crops, axis=0)
        return stacked, metas
