"""
Evidence Fusion Models: Logistic Regression Baseline & Calibrated Gradient Boosted Trees.

Enforces:
- Strict compliance: Output displayLabel is strictly "Possible match".
- Decoupled feature spaces: Combines normalized scalar similarities and quality signals,
  never concatenates or averages high-dimensional vector embeddings.
- Calibrated probability outputs with Expected Calibration Error (ECE) monitoring.
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import roc_auc_score, brier_score_loss
import xgboost as xgb
import lightgbm as lgb

from .features import FEATURE_NAMES, EvidenceFeatures


@dataclass
class CalibrationMetrics:
    brier_score: float
    expected_calibration_error: float
    roc_auc: float
    reliability_bins: List[Dict[str, float]]
    fmr_thresholds: Dict[str, float]


def compute_ece(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    n_bins: int = 10,
) -> Tuple[float, List[Dict[str, float]]]:
    """
    Computes Expected Calibration Error (ECE) and binning statistics for reliability diagrams.

    ECE = sum_{m=1}^M (|B_m| / N) * |acc(B_m) - conf(B_m)|
    """
    bin_limits = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0
    total_samples = len(y_true)
    bins_data: List[Dict[str, float]] = []

    for i in range(n_bins):
        low, high = bin_limits[i], bin_limits[i + 1]
        mask = (y_prob >= low) & (y_prob <= high if i == n_bins - 1 else y_prob < high)
        bin_size = int(np.sum(mask))

        if bin_size > 0:
            bin_acc = float(np.mean(y_true[mask]))
            bin_conf = float(np.mean(y_prob[mask]))
            ece += (bin_size / total_samples) * abs(bin_acc - bin_conf)
            bins_data.append(
                {
                    "bin_start": float(low),
                    "bin_end": float(high),
                    "samples": bin_size,
                    "accuracy": bin_acc,
                    "confidence": bin_conf,
                }
            )
        else:
            bins_data.append(
                {
                    "bin_start": float(low),
                    "bin_end": float(high),
                    "samples": 0,
                    "accuracy": 0.0,
                    "confidence": (low + high) / 2.0,
                }
            )

    return float(ece), bins_data


def compute_fmr_operating_points(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    target_fmrs: Optional[List[float]] = None,
) -> Dict[str, float]:
    """
    Computes score thresholds corresponding to specific False Match Rates (FMR).
    Targets: e.g. 5% (0.05), 1% (0.01), 0.1% (0.001).
    """
    if target_fmrs is None:
        target_fmrs = [0.05, 0.01, 0.001]

    neg_scores = y_prob[y_true == 0]
    if len(neg_scores) == 0:
        return {f"{fmr*100:.1f}%": 0.5 for fmr in target_fmrs}

    thresholds: Dict[str, float] = {}
    for target in target_fmrs:
        # Threshold such that False Positive Rate <= target
        # Percentile of negative scores corresponding to 1 - target
        tau = float(np.percentile(neg_scores, (1.0 - target) * 100))
        thresholds[f"{target*100:.2f}%"] = round(tau, 4)

    return thresholds


class EvidenceFusionModel:
    """
    Multi-modal evidence fusion engine combining Face, Re-ID, Temporal,
    and Camera Topology evidence into a calibrated probability score.
    """

    def __init__(
        self,
        model_type: str = "xgboost",  # "logistic" or "xgboost" or "lightgbm"
        calibration_method: str = "sigmoid",  # "sigmoid" (Platt scaling) or "isotonic"
        model_version: str = "sentinel-fusion-v1.0.0",
    ):
        self.model_type = model_type
        self.calibration_method = calibration_method
        self.model_version = model_version

        self.base_model: Any = None
        self.calibrated_model: Any = None
        self.is_trained = False

        self._init_models()

    def _init_models(self) -> None:
        if self.model_type == "logistic":
            self.base_model = LogisticRegression(
                C=1.0,
                class_weight="balanced",
                max_iter=1000,
                random_state=42,
            )
        elif self.model_type == "xgboost":
            self.base_model = xgb.XGBClassifier(
                n_estimators=100,
                max_depth=4,
                learning_rate=0.05,
                subsample=0.8,
                colsample_bytree=0.8,
                objective="binary:logistic",
                eval_metric="logloss",
                random_state=42,
            )
        elif self.model_type == "lightgbm":
            self.base_model = lgb.LGBMClassifier(
                n_estimators=100,
                max_depth=4,
                learning_rate=0.05,
                subsample=0.8,
                random_state=42,
                verbose=-1,
            )
        else:
            raise ValueError(f"Unknown model_type: {self.model_type}")

    def train_and_calibrate(
        self,
        x_train: np.ndarray,
        y_train: np.ndarray,
        x_val: np.ndarray,
        y_val: np.ndarray,
    ) -> CalibrationMetrics:
        """
        Train model and fit probability calibration (Platt scaling / Isotonic).
        """
        # Calibrated model wrapper with cross-validation
        self.calibrated_model = CalibratedClassifierCV(
            estimator=self.base_model,
            method=self.calibration_method,
            cv=3,
        )
        self.calibrated_model.fit(x_train, y_train)
        self.is_trained = True

        # Validation evaluation
        y_prob = self.calibrated_model.predict_proba(x_val)[:, 1]
        brier = float(brier_score_loss(y_val, y_prob))
        auc = float(roc_auc_score(y_val, y_prob))
        ece, bins_data = compute_ece(y_val, y_prob)
        fmr_thresholds = compute_fmr_operating_points(y_val, y_prob)

        return CalibrationMetrics(
            brier_score=brier,
            expected_calibration_error=ece,
            roc_auc=auc,
            reliability_bins=bins_data,
            fmr_thresholds=fmr_thresholds,
        )

    def predict_score(self, features: Union[EvidenceFeatures, np.ndarray]) -> Dict[str, Any]:
        """
        Predict calibrated fusion score for human verification review.

        Strict Compliance Rule:
        Output displayLabel is ALWAYS "Possible match".
        """
        if isinstance(features, EvidenceFeatures):
            feat_arr = features.to_array().reshape(1, -1)
            f_face = features.s_face
            f_reid = features.s_reid
            f_camera = features.s_camera
            f_temporal = features.s_temporal
        else:
            feat_arr = np.asarray(features, dtype=np.float32)
            if feat_arr.ndim == 1:
                feat_arr = feat_arr.reshape(1, -1)
            f_face = float(feat_arr[0, 0])
            f_reid = float(feat_arr[0, 1])
            f_temporal = float(feat_arr[0, 2])
            f_camera = float(feat_arr[0, 3])

        if self.is_trained and self.calibrated_model is not None:
            calibrated_prob = float(self.calibrated_model.predict_proba(feat_arr)[0, 1])
        else:
            # Fallback heuristic weighted scoring before offline training
            # S_face (0.35 if available), S_reid (0.35), S_camera (0.20), S_temporal (0.10)
            face_avail = feat_arr[0, 9] if feat_arr.shape[1] > 9 else 0.0
            if face_avail > 0.5:
                calibrated_prob = 0.35 * f_face + 0.35 * f_reid + 0.20 * f_camera + 0.10 * f_temporal
            else:
                # Re-ID only path (rescales Re-ID and topology without unfair penalty)
                calibrated_prob = 0.60 * f_reid + 0.25 * f_camera + 0.15 * f_temporal

        calibrated_prob = float(np.clip(calibrated_prob, 0.0, 1.0))

        # Assign confidence band
        if calibrated_prob >= 0.80:
            band = "high"
        elif calibrated_prob >= 0.50:
            band = "medium"
        else:
            band = "low"

        return {
            "fusion_score": calibrated_prob,
            "confidence_band": band,
            # Mandatory UI wording for human-in-the-loop compliance
            "display_label": "Possible match",
            "model_version": self.model_version,
            "explanation": {
                "s_face": f_face,
                "s_reid": f_reid,
                "s_camera": f_camera,
                "s_temporal": f_temporal,
            },
        }
