"""
Set-Level Quality and Biometric Consistency Checker:
- Computes pairwise cosine similarity matrix across gallery face embeddings
- Outlier detection: flags images with mean similarity < threshold as "probable different person"
- 8-bin pose coverage analysis with gap recommendations
- Age span gap detection across timestamps
- Near-duplicate removal (cosine > 0.985) to avoid gallery bias
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Any, Optional
import numpy as np
from .config import QualityGatesConfig, DEFAULT_QUALITY_GATES


@dataclass
class SetCheckResult:
    consistency_passed: bool = True
    outlier_reference_ids: List[str] = field(default_factory=list)
    near_duplicate_ids: List[str] = field(default_factory=list)
    pose_coverage: Dict[str, int] = field(default_factory=dict)
    missing_poses: List[str] = field(default_factory=list)
    age_span_years: float = 0.0
    warnings: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    a = np.array(v1, dtype=np.float32)
    b = np.array(v2, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


class ReferenceSetChecker:
    def __init__(self, config: QualityGatesConfig = DEFAULT_QUALITY_GATES) -> None:
        self.config = config

    def evaluate_set(
        self,
        reference_records: List[Dict[str, Any]],
    ) -> SetCheckResult:
        """
        Runs comprehensive set-level consistency and gallery diversity checks:
        reference_records: List of dicts containing:
          - referenceId: str
          - embedding: Optional[List[float]] (face embedding)
          - poseBin: str
          - photoTakenAt: Optional[str]
          - quality: float
        """
        res = SetCheckResult()

        face_items = [r for r in reference_records if r.get("embedding") is not None and len(r.get("embedding", [])) == 512]

        # 1. Pairwise Cosine Consistency & Outlier Detection
        if len(face_items) >= 2:
            n = len(face_items)
            sim_matrix = np.zeros((n, n), dtype=float)

            for i in range(n):
                for j in range(i, n):
                    if i == j:
                        sim_matrix[i, j] = 1.0
                    else:
                        sim = cosine_similarity(face_items[i]["embedding"], face_items[j]["embedding"])
                        sim_matrix[i, j] = sim
                        sim_matrix[j, i] = sim

                        # Near-duplicate check
                        if sim >= self.config.near_duplicate_cosine_threshold:
                            res.near_duplicate_ids.append(face_items[j]["referenceId"])
                            res.warnings.append(
                                f"Reference {face_items[j]['referenceId']} is a near-duplicate of {face_items[i]['referenceId']} (cosine {sim:.3f})."
                            )

            # Mean similarity per item (excluding self)
            for idx, item in enumerate(face_items):
                other_sims = [sim_matrix[idx, k] for k in range(n) if k != idx]
                mean_sim = float(np.mean(other_sims)) if other_sims else 1.0

                if mean_sim < self.config.min_pairwise_similarity:
                    res.outlier_reference_ids.append(item["referenceId"])
                    res.consistency_passed = False
                    res.warnings.append(
                        f"Photo {item['referenceId']} exhibits low biometric similarity (mean {mean_sim:.2f} < {self.config.min_pairwise_similarity}) and may show a different person."
                    )

        # 2. Pose Coverage Map across 8 directional bins
        all_bins = ["front", "front_left", "left", "back_left", "back", "back_right", "right", "front_right"]
        coverage: Dict[str, int] = {b: 0 for b in all_bins}

        for r in reference_records:
            bin_name = r.get("poseBin", "front")
            if bin_name in coverage:
                coverage[bin_name] += 1

        res.pose_coverage = coverage
        missing = [b for b in ["front", "front_left", "front_right", "left", "right"] if coverage[b] == 0]
        res.missing_poses = missing

        if coverage["front"] == 0:
            res.recommendations.append("Enrolled set lacks a direct frontal photograph.")
        if coverage["left"] == 0 and coverage["front_left"] == 0:
            res.recommendations.append("Add a left-side or left three-quarter angle photograph to improve off-angle Re-ID.")
        if coverage["right"] == 0 and coverage["front_right"] == 0:
            res.recommendations.append("Add a right-side or right three-quarter angle photograph.")

        # 3. Age Span Gap Warning
        dates: List[float] = []
        for r in reference_records:
            taken_at = r.get("photoTakenAt")
            if taken_at:
                try:
                    dt = datetime.fromisoformat(taken_at.replace("Z", "+00:00"))
                    dates.append(dt.timestamp())
                except Exception:
                    pass

        if len(dates) >= 2:
            span_years = (max(dates) - min(dates)) / (3600 * 24 * 365.25)
            res.age_span_years = round(span_years, 1)
            if span_years > self.config.age_gap_warn_years:
                res.warnings.append(
                    f"Reference photos span {span_years:.1f} years. Biometric aging reduces matching accuracy; prioritize newer photos."
                )

        return res
