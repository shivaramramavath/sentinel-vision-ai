"""
BoT-SORT Tracker: Robust Association Combining Geometric IoU and Re-ID Appearance.

Reference:
Aharon et al., "BoT-SORT: Robust Associations Multi-Pedestrian Tracker", arXiv:2206.14651, 2022.
"""

from typing import List, Optional
import numpy as np

from .bytetrack import ByteTracker
from .matching import iou_distance, embedding_cosine_distance, linear_assignment
from .state_store import TrackRedisStateStore
from .track import STrack


class BoTSORTTracker(ByteTracker):
    """
    BoT-SORT tracker variant. Extends ByteTrack by fusing visual Re-ID cosine distance
    with bounding box IoU for dense and crowded multi-person scenarios.
    """

    def __init__(
        self,
        camera_id: str = "camera-1",
        track_thresh: float = 0.5,
        match_thresh: float = 0.8,
        low_thresh: float = 0.1,
        max_time_lost: int = 30,
        appearance_thresh: float = 0.35,
        proximity_weight: float = 0.5,
        state_store: Optional[TrackRedisStateStore] = None,
    ):
        super().__init__(
            camera_id=camera_id,
            track_thresh=track_thresh,
            match_thresh=match_thresh,
            low_thresh=low_thresh,
            max_time_lost=max_time_lost,
            state_store=state_store,
        )
        self.appearance_thresh = appearance_thresh
        self.proximity_weight = proximity_weight  # weight between IoU (1-w) and Re-ID (w)

    def compute_fused_cost(
        self,
        tracks: List[STrack],
        detections: List[STrack],
        weight: Optional[float] = None,
    ) -> np.ndarray:
        """
        Fuse IoU spatial distance and Re-ID appearance cosine distance:
        cost = (1 - w) * iou_dist + w * reid_dist
        """
        w = weight if weight is not None else self.proximity_weight

        d_iou = iou_distance(tracks, detections)
        d_emb = embedding_cosine_distance(tracks, detections)

        if d_emb.size == 0 or np.all(np.isnan(d_emb)):
            return d_iou

        # Replace missing embeddings with max distance (1.0)
        d_emb = np.nan_to_num(d_emb, nan=1.0)

        fused = (1.0 - w) * d_iou + w * d_emb
        return fused
