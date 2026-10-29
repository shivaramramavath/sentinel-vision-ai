"""
Sentinel Vision AI - Evidence Fusion & Cross-Camera Tracking Module.
"""

from .topology import CameraTopologyGraph, TopologyEdge
from .normalizer import CameraDomainNormalizer
from .features import EvidenceFeatures, FeatureExtractor, FEATURE_NAMES
from .fusion_model import (
    EvidenceFusionModel,
    compute_ece,
    compute_fmr_operating_points,
    CalibrationMetrics,
)
from .journey_reconstruction import (
    CandidateSightingNode,
    JourneyHop,
    ReconstructedJourney,
    CrossCameraJourneyReconstructor,
)

__all__ = [
    "CameraTopologyGraph",
    "TopologyEdge",
    "CameraDomainNormalizer",
    "EvidenceFeatures",
    "FeatureExtractor",
    "FEATURE_NAMES",
    "EvidenceFusionModel",
    "compute_ece",
    "compute_fmr_operating_points",
    "CalibrationMetrics",
    "CandidateSightingNode",
    "JourneyHop",
    "ReconstructedJourney",
    "CrossCameraJourneyReconstructor",
]
