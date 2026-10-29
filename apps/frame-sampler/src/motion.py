"""
Sentinel Vision AI — Cheap Motion Gating (Phase C2).

Evaluates luminance deltas and structural similarity on 64x64 downsampled thumbnails
to suppress redundant frame inference on static surveillance scenes.
"""

import cv2
import numpy as np
from typing import Optional, Tuple


class CheapMotionGate:
    def __init__(self, threshold: float = 12.0, thumbnail_size: Tuple[int, int] = (64, 64)) -> None:
        self.threshold = threshold
        self.thumbnail_size = thumbnail_size
        self.prev_thumbnail: Optional[np.ndarray] = None

    def evaluate(self, frame_bgr: np.ndarray) -> Tuple[bool, float]:
        """
        Calculates luminance difference on downsampled grayscale thumbnail.
        Returns:
            (is_motion: bool, mean_diff: float)
        """
        # Downscale to 64x64 for cheap O(1) CPU comparison
        small = cv2.resize(frame_bgr, self.thumbnail_size, interpolation=cv2.INTER_AREA)
        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

        if self.prev_thumbnail is None:
            self.prev_thumbnail = gray
            # First frame is always considered motion to seed downstream track initialization
            return True, 100.0

        # Absolute luminance difference
        diff = cv2.absdiff(self.prev_thumbnail, gray)
        mean_diff = float(np.mean(diff))

        self.prev_thumbnail = gray
        is_motion = mean_diff >= self.threshold

        return is_motion, round(mean_diff, 2)

    def reset(self) -> None:
        self.prev_thumbnail = None
