"""
Reference Image Registration Service.

Processes reference images uploaded for a missing person case:
- Quality validation
- Face embedding extraction (if usable via quality gate) -> stored in sentinel-face under case-{caseId}
- Person Re-ID embedding extraction (if usable full-body) -> stored in sentinel-reid under case-{caseId}
- Cache by (referenceId, modelVersion) to avoid redundant compute
"""
from dataclasses import dataclass
from typing import Dict, Optional, Tuple
import numpy as np

from sentinel_inference.vision.face_pipeline import FacePipelineBase
from sentinel_inference.vision.reid_extractor import ReidExtractorBase
from sentinel_inference.vision.vector_store import VectorRecord, VectorStoreBase


@dataclass
class RegistrationSummary:
    reference_id: str
    case_id: str
    face_indexed: bool
    reid_indexed: bool
    cached: bool
    model_version: str


class ReferenceRegistrationService:
    def __init__(
        self,
        face_pipeline: FacePipelineBase,
        reid_extractor: ReidExtractorBase,
        vector_store: VectorStoreBase,
        model_version: str = "v1.0",
    ) -> None:
        self.face_pipeline = face_pipeline
        self.reid_extractor = reid_extractor
        self.vector_store = vector_store
        self.model_version = model_version
        # Cache by (referenceId, modelVersion)
        self._cache: Dict[Tuple[str, str], RegistrationSummary] = {}

    def register_reference(
        self,
        reference_id: str,
        case_id: str,
        image: np.ndarray,
        is_full_body: bool = True,
    ) -> RegistrationSummary:
        cache_key = (reference_id, self.model_version)
        if cache_key in self._cache:
            cached_res = self._cache[cache_key]
            return RegistrationSummary(
                reference_id=cached_res.reference_id,
                case_id=cached_res.case_id,
                face_indexed=cached_res.face_indexed,
                reid_indexed=cached_res.reid_indexed,
                cached=True,
                model_version=self.model_version,
            )

        namespace = f"case-{case_id}"
        face_indexed = False
        reid_indexed = False

        # 1. Attempt Face Embedding extraction
        face_res = self.face_pipeline.extract_face_embedding(image)
        if face_res is not None:
            face_record = VectorRecord(
                id=f"ref_face_{reference_id}",
                values=face_res.embedding,
                metadata={
                    "caseId": case_id,
                    "referenceId": reference_id,
                    "kind": "face",
                    "modelVersion": face_res.model_version,
                    "qualityScore": face_res.quality.score,
                },
            )
            self.vector_store.upsert("sentinel-face", [face_record], namespace=namespace)
            face_indexed = True

        # 2. Extract Re-ID Embedding if full-body aspect ratio is appropriate
        h, w = image.shape[:2]
        if is_full_body or (h / max(1, w) >= 1.2):
            reid_res = self.reid_extractor.extract_reid_embedding(image, apply_tta=True)
            reid_record = VectorRecord(
                id=f"ref_reid_{reference_id}",
                values=reid_res.embedding,
                metadata={
                    "caseId": case_id,
                    "referenceId": reference_id,
                    "kind": "reid",
                    "modelVersion": reid_res.model_version,
                },
            )
            self.vector_store.upsert("sentinel-reid", [reid_record], namespace=namespace)
            reid_indexed = True

        summary = RegistrationSummary(
            reference_id=reference_id,
            case_id=case_id,
            face_indexed=face_indexed,
            reid_indexed=reid_indexed,
            cached=False,
            model_version=self.model_version,
        )

        self._cache[cache_key] = summary
        return summary
