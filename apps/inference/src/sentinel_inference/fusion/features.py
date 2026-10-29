"""
Evidence Fusion Feature Vector Representation.

Constructs feature vectors from multi-modal candidate evidence:
[S_face, S_reid, S_temporal, S_camera, face_quality, blur, occlusion, resolution, lighting, face_available]

Strict Invariants:
- Face and Re-ID embeddings are kept in strictly decoupled feature spaces.
- S_face is 0.0 when no face is available, and face_available flag prevents penalizing Re-ID-only observations.
"""

from dataclasses import dataclass
from typing import List, Optional, Tuple
import numpy as np

from .normalizer import CameraDomainNormalizer
from .topology import CameraTopologyGraph


FEATURE_NAMES = [
    "s_face",
    "s_reid",
    "s_temporal",
    "s_camera",
    "face_quality",
    "blur_score",
    "occlusion_conf",
    "resolution_ratio",
    "lighting_mean",
    "face_available",
]


@dataclass
class EvidenceFeatures:
    s_face: float
    s_reid: float
    s_temporal: float
    s_camera: float
    face_quality: float
    blur_score: float
    occlusion_conf: float
    resolution_ratio: float
    lighting_mean: float
    face_available: float

    def to_array(self) -> np.ndarray:
        return np.array(
            [
                self.s_face,
                self.s_reid,
                self.s_temporal,
                self.s_camera,
                self.face_quality,
                self.blur_score,
                self.occlusion_conf,
                self.resolution_ratio,
                self.lighting_mean,
                self.face_available,
            ],
            dtype=np.float32,
        )


class FeatureExtractor:
    """
    Extracts multi-modal feature vectors from tracks, reference galleries,
    camera topology, and image quality attributes.
    """

    def __init__(
        self,
        domain_normalizer: Optional[CameraDomainNormalizer] = None,
        topology_graph: Optional[CameraTopologyGraph] = None,
    ):
        self.normalizer = domain_normalizer or CameraDomainNormalizer()
        self.topology = topology_graph or CameraTopologyGraph()

    def compute_temporal_consistency(
        self,
        track_scores: List[float],
        track_embeddings: List[np.ndarray],
        similarity_thresh: float = 0.5,
    ) -> float:
        """
        Computes temporal consistency across consecutive track frames:
        Fraction of frames with detection confidence >= thresh, combined with
        embedding stability (low cosine variance).
        """
        if not track_scores:
            return 0.5

        # Fraction of frames above threshold
        above_ratio = float(np.mean([1.0 if s >= similarity_thresh else 0.0 for s in track_scores]))

        # Embedding stability
        if len(track_embeddings) >= 2:
            embs = np.stack(track_embeddings, axis=0)
            norm = np.linalg.norm(embs, axis=1, keepdims=True)
            norm[norm == 0] = 1e-6
            normalized_embs = embs / norm
            # Pairwise cosine similarities along consecutive frames
            consecutive_sims = np.sum(normalized_embs[:-1] * normalized_embs[1:], axis=1)
            mean_sim = float(np.clip(np.mean(consecutive_sims), 0.0, 1.0))
        else:
            mean_sim = 1.0

        # Fused temporal score
        temporal_score = 0.5 * above_ratio + 0.5 * mean_sim
        return float(np.clip(temporal_score, 0.0, 1.0))

    def extract(
        self,
        camera_id: str,
        t_sec: float,
        # Re-ID features
        raw_reid_score: float,
        # Face features
        raw_face_score: Optional[float] = None,
        face_quality: float = 0.0,
        # Temporal track metrics
        track_scores: Optional[List[float]] = None,
        track_embeddings: Optional[List[np.ndarray]] = None,
        # Spatial-temporal context
        prev_camera_id: Optional[str] = None,
        prev_t_sec: Optional[float] = None,
        # Quality indicators
        blur_laplacian_var: float = 80.0,
        detection_conf: float = 0.85,
        crop_area_ratio: float = 0.05,
        mean_luminance: float = 128.0,
    ) -> EvidenceFeatures:
        """
        Extract normalized features for evidence fusion.
        """
        # 1. Re-ID Score with camera domain normalization
        s_reid = self.normalizer.normalize(raw_reid_score, camera_id)

        # 2. Face Score handling (fair Re-ID-only support)
        if raw_face_score is not None and raw_face_score > 0.0:
            s_face = self.normalizer.normalize(raw_face_score, camera_id)
            face_avail = 1.0
        else:
            s_face = 0.0
            face_avail = 0.0
            face_quality = 0.0

        # 3. Temporal Consistency
        s_temporal = self.compute_temporal_consistency(
            track_scores or [detection_conf],
            track_embeddings or [],
        )

        # 4. Spatio-temporal Camera Topology Plausibility
        if prev_camera_id is not None and prev_t_sec is not None:
            s_camera = self.topology.calculate_plausibility(
                prev_camera_id, camera_id, prev_t_sec, t_sec
            )
        else:
            # Baseline anchor / initial observation
            s_camera = 1.0

        # 5. Normalized Quality Features
        # Blur normalized (Laplacian variance 0 to 200 mapped to 0..1)
        norm_blur = float(np.clip(blur_laplacian_var / 200.0, 0.0, 1.0))
        # Occlusion / detection confidence
        norm_conf = float(np.clip(detection_conf, 0.0, 1.0))
        # Resolution ratio (0 to 0.15 of frame mapped to 0..1)
        norm_res = float(np.clip(crop_area_ratio / 0.15, 0.0, 1.0))
        # Lighting normalized (distance from optimal luminance 128)
        norm_light = float(1.0 - np.clip(abs(mean_luminance - 128.0) / 128.0, 0.0, 1.0))

        return EvidenceFeatures(
            s_face=s_face,
            s_reid=s_reid,
            s_temporal=s_temporal,
            s_camera=s_camera,
            face_quality=float(np.clip(face_quality, 0.0, 1.0)),
            blur_score=norm_blur,
            occlusion_conf=norm_conf,
            resolution_ratio=norm_res,
            lighting_mean=norm_light,
            face_available=face_avail,
        )
