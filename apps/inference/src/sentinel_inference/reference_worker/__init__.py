"""Reference Image Analysis and Embedding Worker module."""
from .config import QualityGatesConfig, DEFAULT_QUALITY_GATES
from .normalizer import normalize_image
from .face_analyzer import FaceAnalyzer, FaceAnalysisResult
from .body_analyzer import BodyAnalyzer, BodyAnalysisResult
from .set_checker import ReferenceSetChecker, SetCheckResult
from .vector_storage import ReferenceVectorStorage
from .worker import ReferenceWorker

__all__ = [
    "QualityGatesConfig",
    "DEFAULT_QUALITY_GATES",
    "normalize_image",
    "FaceAnalyzer",
    "FaceAnalysisResult",
    "BodyAnalyzer",
    "BodyAnalysisResult",
    "ReferenceSetChecker",
    "SetCheckResult",
    "ReferenceVectorStorage",
    "ReferenceWorker",
]
