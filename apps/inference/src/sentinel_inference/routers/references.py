"""Reference Image Analysis API Router."""
from typing import Optional
from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from pydantic import BaseModel
from sentinel_inference.reference_worker import ReferenceWorker, DEFAULT_QUALITY_GATES

router = APIRouter(prefix="/references", tags=["References"])
worker = ReferenceWorker()


class QualityGatesResponse(BaseModel):
    version: str
    min_face_size_px: int
    preferred_face_size_px: int
    extreme_blur_threshold: float
    min_face_quality_score: float
    min_pairwise_similarity: float
    near_duplicate_cosine_threshold: float


@router.get("/quality-gates", response_model=QualityGatesResponse)
async def get_quality_gates():
    cfg = worker.config
    return QualityGatesResponse(
        version=cfg.version,
        min_face_size_px=cfg.min_face_size_px,
        preferred_face_size_px=cfg.preferred_face_size_px,
        extreme_blur_threshold=cfg.extreme_blur_threshold,
        min_face_quality_score=cfg.min_face_quality_score,
        min_pairwise_similarity=cfg.min_pairwise_similarity,
        near_duplicate_cosine_threshold=cfg.near_duplicate_cosine_threshold,
    )


@router.post("/analyze")
async def analyze_reference(
    file: UploadFile = File(...),
    reference_id: str = Form("ref_test"),
    case_id: str = Form("case_test"),
    person_id: str = Form(""),
    expected_type: str = Form("face_front"),
    photo_taken_at: Optional[str] = Form(None),
):
    try:
        content = await file.read()
        res = worker.process_image_pipeline(
            image_input=content,
            reference_id=reference_id,
            case_id=case_id,
            person_id=person_id,
            expected_type=expected_type,
            photo_taken_at=photo_taken_at,
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image processing failed: {str(e)}")
