"""
Camera Domain Normalizer.

Standardizes similarity scores per camera using empirical background statistics
(z-score normalization mapped through sigmoid), reducing domain shifts caused
by camera angle, optical resolution, color temperature, and ambient lighting.
"""

from typing import Dict, Tuple
import math
import numpy as np


class CameraDomainNormalizer:
    """
    Maintains empirical distribution parameters (mean, std) per camera
    to z-score similarity scores and eliminate inter-camera domain bias.
    """

    def __init__(self, default_mean: float = 0.35, default_std: float = 0.12):
        self.default_mean = default_mean
        self.default_std = default_std
        # Dict mapping camera_id -> (mean, std)
        self.camera_stats: Dict[str, Tuple[float, float]] = {}

    def set_camera_stats(self, camera_id: str, mean: float, std: float) -> None:
        self.camera_stats[camera_id] = (float(mean), max(0.01, float(std)))

    def normalize(self, score: float, camera_id: str) -> float:
        """
        Z-score a raw cosine similarity score against the camera background distribution,
        then map via standard logistic sigmoid to [0.0, 1.0].

        z = (score - mean) / std
        norm_score = 1 / (1 + exp(-z))
        """
        mean, std = self.camera_stats.get(camera_id, (self.default_mean, self.default_std))

        z = (score - mean) / std
        # Sigmoid transform into [0, 1]
        try:
            val = 1.0 / (1.0 + math.exp(-z))
        except OverflowError:
            val = 1.0 if z > 0 else 0.0

        return float(np.clip(val, 0.0, 1.0))
