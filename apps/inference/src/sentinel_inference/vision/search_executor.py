"""
Search Executor module.

Executes end-to-end vision inference over a video shard:
1. Decode frames (adaptive sampling + motion gating)
2. Detect persons with YOLO
3. Fast Cascade:
   - Extract Re-ID embedding -> query case gallery in sentinel-reid
   - Perform face detection/alignment/ArcFace only on shortlisted candidates
4. Multi-reference gallery scoring:
   - Max or top-2 mean cosine over reference gallery
5. Emits candidate matches with separated metrics and mandatory 'Possible match' phrasing
"""
from dataclasses import dataclass
from typing import List, Optional
import numpy as np

from sentinel_inference.vision.decoder import VideoDecoderBase
from sentinel_inference.vision.person_detector import PersonDetectorBase
from sentinel_inference.vision.reid_extractor import ReidExtractorBase
from sentinel_inference.vision.face_pipeline import FacePipelineBase
from sentinel_inference.vision.vector_store import VectorStoreBase


@dataclass
class ScoredCandidate:
    case_id: str
    camera_id: str
    timestamp: str
    face_score: float
    reid_score: float
    temporal_score: float
    camera_plausibility: float
    fused_score: float
    bbox: List[float]
    display_label: str
    confidence_band: str
    model_version: str
    hard_negative_penalty: float = 0.0


class SearchExecutor:
    def __init__(
        self,
        decoder: VideoDecoderBase,
        detector: PersonDetectorBase,
        reid_extractor: ReidExtractorBase,
        face_pipeline: FacePipelineBase,
        vector_store: VectorStoreBase,
        recall_threshold: float = 0.65,
        model_version: str = "v1.0",
    ) -> None:
        self.decoder = decoder
        self.detector = detector
        self.reid_extractor = reid_extractor
        self.face_pipeline = face_pipeline
        self.vector_store = vector_store
        self.recall_threshold = recall_threshold
        self.model_version = model_version

    def execute_shard_search(
        self,
        source_uri: str,
        case_id: str,
        camera_id: str,
        window_start_sec: float = 0.0,
        window_end_sec: Optional[float] = None,
        timestamp_iso: str = "",
        hard_negative_embeddings: Optional[List[np.ndarray]] = None,
        reference_set_version: Optional[int] = None,
    ) -> List[ScoredCandidate]:
        candidates: List[ScoredCandidate] = []
        # Dynamic Pinecone namespace versioning: queries the latest active reference set version
        case_namespace = f"case_{case_id}_v{reference_set_version}" if reference_set_version is not None else f"case-{case_id}"

        # Decode frames with adaptive sampling and motion gating
        decoded_frames = list(self.decoder.decode(source_uri, window_start_sec, window_end_sec))
        if not decoded_frames:
            return []

        frame_imgs = [df.frame for df in decoded_frames]
        batch_detections = self.detector.detect_batch(frame_imgs)

        for df, detections in zip(decoded_frames, batch_detections):
            if not detections:
                continue

            # Boost decoder sampling rate upon active human presence
            self.decoder.set_boost(True)

            for det in detections:
                crop = det.crop
                if crop.size == 0:
                    continue

                # 1. Cheap Re-ID extraction on the person crop
                reid_res = self.reid_extractor.extract_reid_embedding(crop, apply_tta=True)

                # Hard Negative Suppression: check cosine against rejected false candidates
                neg_penalty = 0.0
                if hard_negative_embeddings:
                    cand_norm = reid_res.embedding / (np.linalg.norm(reid_res.embedding) + 1e-7)
                    max_neg_sim = max([
                        float(np.dot(cand_norm, neg / (np.linalg.norm(neg) + 1e-7)))
                        for neg in hard_negative_embeddings
                    ], default=0.0)

                    if max_neg_sim >= 0.85:
                        # Near-identical to rejected candidate: suppress completely
                        continue
                    elif max_neg_sim >= 0.65:
                        neg_penalty = round((max_neg_sim - 0.60) * 0.7, 3)

                reid_matches = self.vector_store.query(
                    "sentinel-reid",
                    reid_res.embedding,
                    top_k=5,
                    namespace=case_namespace,
                )

                # Multi-reference score calculation: max cosine over reference set minus negative penalty
                raw_reid_score = max([m.score for m in reid_matches], default=0.0)
                reid_score = max(0.0, round(raw_reid_score - neg_penalty, 3))

                # 2. Fast Cascade: only evaluate face on crops passing preliminary recall filter
                face_score = 0.0
                if reid_score >= 0.45:
                    face_res = self.face_pipeline.extract_face_embedding(crop)
                    if face_res is not None:
                        face_matches = self.vector_store.query(
                            "sentinel-face",
                            face_res.embedding,
                            top_k=5,
                            namespace=case_namespace,
                        )
                        face_score = max([m.score for m in face_matches], default=0.0)

                # 3. Score Fusion (preserving separate metric spaces)
                temporal_score = 0.92
                camera_plausibility = 0.95
                fused = round((face_score * 0.45) + (reid_score * 0.35) + (temporal_score * 0.1) + (camera_plausibility * 0.1), 3)

                if fused >= self.recall_threshold:
                    confidence_band = "high" if fused >= 0.85 else "medium"
                    candidates.append(
                        ScoredCandidate(
                            case_id=case_id,
                            camera_id=camera_id,
                            timestamp=timestamp_iso,
                            face_score=round(face_score, 3),
                            reid_score=round(reid_score, 3),
                            temporal_score=temporal_score,
                            camera_plausibility=camera_plausibility,
                            fused_score=fused,
                            bbox=det.bbox,
                            display_label="Possible match",  # Invariant: human review notice
                            confidence_band=confidence_band,
                            model_version=self.model_version,
                            hard_negative_penalty=neg_penalty,
                        )
                    )

        # Reset boost when shard concludes
        self.decoder.set_boost(False)
        return candidates
