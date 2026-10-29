"""
Quality Gates and Configuration for Reference Image Worker.
Versioned, configurable thresholds for reject, warn, and analysis gates.
"""
from dataclasses import dataclass, field
from typing import List, Dict


@dataclass
class QualityGatesConfig:
    version: str = "v1.2.0"

    # Face thresholds
    min_face_size_px: int = 40          # Below 40 px: REJECT
    preferred_face_size_px: int = 80    # 40-80 px: WARN
    extreme_blur_threshold: float = 20.0 # Laplacian variance < 20: REJECT
    moderate_blur_threshold: float = 50.0# Laplacian variance 20-50: WARN
    fft_energy_min_ratio: float = 0.015  # High-frequency ratio check
    min_face_quality_score: float = 0.60 # Overall face quality < 0.60: unusable
    max_yaw_angle_warn: float = 45.0     # Yaw > 45 deg: WARN (strong side pose)
    max_pitch_angle_warn: float = 35.0   # Pitch > 35 deg: WARN

    # Illumination checks
    min_illumination_mean: float = 0.22 # Underexposed / low-light: WARN
    max_illumination_mean: float = 0.88 # Overexposed: WARN

    # Body thresholds
    min_body_height_px: int = 250       # Below 250 px: REJECT
    min_body_completeness: float = 0.50 # Completeness < 0.50: WARN / upper_body

    # Set-level consistency
    min_pairwise_similarity: float = 0.62 # Face cosine < 0.62: "needs_review" (probable different person)
    near_duplicate_cosine_threshold: float = 0.985 # Cosine > 0.985: near duplicate skip
    age_gap_warn_years: float = 5.0     # Photos spanning > 5 years: WARN

    # Pinecone
    pinecone_face_index: str = "face-embeddings"
    pinecone_reid_index: str = "reid-embeddings"

    # Model versions
    arcface_model_version: str = "arcface-r100-v2"
    osnet_model_version: str = "osnet-ain-x1.0-v2"
    yolo_model_version: str = "yolov8-person-v2"
    scrfd_model_version: str = "scrfd-10g-v2"


DEFAULT_QUALITY_GATES = QualityGatesConfig()
