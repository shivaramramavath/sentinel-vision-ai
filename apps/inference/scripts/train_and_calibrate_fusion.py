"""
Offline Evidence Fusion Training & Probability Calibration Tooling.

Trains Logistic Regression baseline and Gradient-Boosted Trees (XGBoost/LightGBM)
on verified sighting labels, fits Platt/Isotonic calibration, produces reliability
diagrams, evaluates Expected Calibration Error (ECE), and outputs target False
Match Rate (FMR) operating thresholds.

Strict Compliance Invariants:
- All display labels strictly "Possible match".
- High-dimensional Face and Re-ID embeddings are never concatenated.
"""

import sys
import json
from typing import Dict, List, Tuple
import numpy as np

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from sentinel_inference.fusion.features import FEATURE_NAMES
from sentinel_inference.fusion.fusion_model import (
    EvidenceFusionModel,
    compute_ece,
    compute_fmr_operating_points,
    CalibrationMetrics,
)


def generate_benchmark_dataset(
    n_samples: int = 2500,
    pos_ratio: float = 0.20,
    random_seed: int = 42,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Synthesize realistic multi-camera evidence feature data representing
    true positive matches and negative distractor pedestrian sightings.
    """
    np.random.seed(random_seed)
    n_pos = int(n_samples * pos_ratio)
    n_neg = n_samples - n_pos

    # Feature columns:
    # 0: s_face (0.0 to 1.0)
    # 1: s_reid (0.0 to 1.0)
    # 2: s_temporal (0.0 to 1.0)
    # 3: s_camera (0.0 to 1.0)
    # 4: face_quality (0.0 to 1.0)
    # 5: blur_score (0.0 to 1.0)
    # 6: occlusion_conf (0.0 to 1.0)
    # 7: resolution_ratio (0.0 to 1.0)
    # 8: lighting_mean (0.0 to 1.0)
    # 9: face_available (0.0 or 1.0)

    # Positive distribution (true target observations)
    pos_reid = np.random.beta(a=7.0, b=2.0, size=n_pos)
    pos_face_avail = (np.random.rand(n_pos) > 0.35).astype(np.float32)  # 65% have face
    pos_face = np.where(
        pos_face_avail > 0.5,
        np.random.beta(a=8.0, b=2.0, size=n_pos),
        0.0,
    )
    pos_temporal = np.random.beta(a=6.0, b=2.0, size=n_pos)
    pos_camera = np.random.beta(a=9.0, b=1.5, size=n_pos)
    pos_quality = np.random.beta(a=6.0, b=2.5, size=(n_pos, 5))

    pos_X = np.column_stack(
        [
            pos_face,
            pos_reid,
            pos_temporal,
            pos_camera,
            pos_quality,
            pos_face_avail,
        ]
    ).astype(np.float32)
    pos_y = np.ones(n_pos, dtype=int)

    # Negative distribution (background / distractor pedestrians)
    neg_reid = np.random.beta(a=2.0, b=6.0, size=n_neg)
    neg_face_avail = (np.random.rand(n_neg) > 0.40).astype(np.float32)
    neg_face = np.where(
        neg_face_avail > 0.5,
        np.random.beta(a=2.0, b=7.0, size=n_neg),
        0.0,
    )
    neg_temporal = np.random.beta(a=3.0, b=4.0, size=n_neg)
    neg_camera = np.random.beta(a=2.5, b=4.5, size=n_neg)
    neg_quality = np.random.beta(a=4.0, b=4.0, size=(n_neg, 5))

    neg_X = np.column_stack(
        [
            neg_face,
            neg_reid,
            neg_temporal,
            neg_camera,
            neg_quality,
            neg_face_avail,
        ]
    ).astype(np.float32)
    neg_y = np.zeros(n_neg, dtype=int)

    # Combine & Shuffle
    X = np.vstack([pos_X, neg_X])
    y = np.concatenate([pos_y, neg_y])
    indices = np.arange(len(y))
    np.random.shuffle(indices)
    X, y = X[indices], y[indices]

    # Split 70% train, 30% validation
    split = int(0.70 * len(y))
    return X[:split], y[:split], X[split:], y[split:]


def print_reliability_diagram(bins_data: List[Dict[str, float]]) -> None:
    print("\n[+] Reliability Diagram (Calibration Analysis):")
    print(f"{'Bin Range':<15} | {'Samples':<8} | {'Avg Confidence':<15} | {'Empirical Accuracy':<18} | {'Gap (|Acc-Conf|)'}")
    print("-" * 75)
    for b in bins_data:
        gap = abs(b["accuracy"] - b["confidence"]) if b["samples"] > 0 else 0.0
        r_str = f"[{b['bin_start']:.1f} - {b['bin_end']:.1f}]"
        print(
            f"{r_str:<15} | {b['samples']:<8} | {b['confidence']:<15.3f} | {b['accuracy']:<18.3f} | {gap:<10.3f}"
        )


def main():
    print("=" * 80)
    print(" SENTINEL VISION AI - EVIDENCE FUSION & CALIBRATION TOOLING")
    print("=" * 80)

    x_train, y_train, x_val, y_val = generate_benchmark_dataset()
    print(f"[*] Loaded dataset: {len(y_train)} train samples, {len(y_val)} validation samples.")
    print(f"[*] Feature dimensions: {x_train.shape[1]} ({', '.join(FEATURE_NAMES)})\n")

    models_to_test = [
        ("logistic", "Logistic Regression Baseline"),
        ("xgboost", "XGBoost Gradient-Boosted Trees"),
    ]

    best_model = None
    best_ece = float("inf")

    for mtype, title in models_to_test:
        print(f"\n[*] Training & Calibrating: {title} ({mtype})")
        model = EvidenceFusionModel(model_type=mtype, calibration_method="sigmoid")
        metrics = model.train_and_calibrate(x_train, y_train, x_val, y_val)

        print(f"    - ROC-AUC:                     {metrics.roc_auc:.4f}")
        print(f"    - Brier Score (MSE):           {metrics.brier_score:.4f}")
        print(f"    - Expected Calibration Error:  {metrics.expected_calibration_error:.4f} (Goal: < 0.05)")

        print("\n    Target False Match Rate (FMR) Operating Thresholds:")
        for target, threshold in metrics.fmr_thresholds.items():
            print(f"      * FMR <= {target:>6} -> Decision Score Threshold >= {threshold:.4f}")

        print_reliability_diagram(metrics.reliability_bins)

        if metrics.expected_calibration_error < best_ece:
            best_ece = metrics.expected_calibration_error
            best_model = model

    print("\n" + "=" * 80)
    print(f"[+] BEST CALIBRATED MODEL: {best_model.model_type.upper()} with ECE = {best_ece:.4f}")
    print("=" * 80)


if __name__ == "__main__":
    main()
