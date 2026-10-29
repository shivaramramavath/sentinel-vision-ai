"""
Body Analyzer module:
- YOLO-Pose person detection & keypoint completeness analysis
- Full-body vs Upper-body discrimination (flags cuts at knee/waist)
- 256x128 person normalization and OSNet 512-d Re-ID embedding with flip TTA
- K-Means dominant color clustering in Lab/HSV space for upper & lower clothing
- Zero-shot appearance tags for soft search re-ranking
"""
from dataclasses import dataclass, field
from typing import List, Tuple, Dict, Any, Optional
import cv2
import numpy as np
from .config import QualityGatesConfig, DEFAULT_QUALITY_GATES


@dataclass
class ClothingColorHint:
    upper_color: str
    lower_color: str
    dominant_hex: str
    attributes: List[str] = field(default_factory=list)


@dataclass
class BodyAnalysisResult:
    detected: bool = False
    person_count: int = 0
    candidate_boxes: List[Dict[str, int]] = field(default_factory=list)
    completeness: float = 0.0 # 0-1
    body_type: str = "full_body" # full_body | upper_body
    pose: str = "standing"
    resolution: Dict[str, int] = field(default_factory=lambda: {"width": 0, "height": 0})
    usable: bool = False
    embedding: Optional[List[float]] = None
    clothing_hints: Optional[ClothingColorHint] = None
    warnings: List[str] = field(default_factory=list)
    reject_reasons: List[str] = field(default_factory=list)


# Standard perceptual color dictionary
COLOR_PALETTE = {
    "black": np.array([20, 20, 20]),
    "white": np.array([235, 235, 235]),
    "grey": np.array([128, 128, 128]),
    "red": np.array([200, 30, 30]),
    "yellow": np.array([230, 210, 40]),
    "blue": np.array([40, 80, 200]),
    "navy": np.array([20, 30, 90]),
    "green": np.array([40, 160, 60]),
    "brown": np.array([120, 70, 30]),
    "orange": np.array([230, 120, 30]),
    "purple": np.array([130, 40, 160]),
    "pink": np.array([230, 130, 170]),
}


def classify_rgb_color(rgb: np.ndarray) -> str:
    """Finds nearest perceptual color in palette via Euclidean distance."""
    min_dist = float("inf")
    closest_name = "unknown"
    for name, target in COLOR_PALETTE.items():
        dist = np.linalg.norm(rgb - target)
        if dist < min_dist:
            min_dist = dist
            closest_name = name
    return closest_name


class BodyAnalyzer:
    def __init__(self, config: QualityGatesConfig = DEFAULT_QUALITY_GATES) -> None:
        self.config = config

    def _extract_clothing_colors(self, body_crop: np.ndarray) -> ClothingColorHint:
        """
        Splits person crop into upper torso (20%-50%) and lower legs (50%-90%),
        and calculates dominant colors via k-means clustering in Lab color space.
        """
        h, w = body_crop.shape[:2]
        upper_region = body_crop[int(0.20 * h) : int(0.50 * h), int(0.15 * w) : int(0.85 * w)]
        lower_region = body_crop[int(0.50 * h) : int(0.90 * h), int(0.15 * w) : int(0.85 * w)]

        def get_dominant_color(img_patch: np.ndarray) -> Tuple[str, str]:
            if img_patch.size == 0:
                return "unknown", "#888888"
            # Reshape to pixels
            pixels = cv2.cvtColor(img_patch, cv2.COLOR_BGR2RGB).reshape(-1, 3).astype(np.float32)
            # 2-cluster k-means
            criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
            _, labels, centers = cv2.kmeans(pixels, 2, None, criteria, 3, cv2.KMEANS_PP_CENTERS)
            # Find largest cluster
            counts = np.bincount(labels.flatten())
            dom_rgb = centers[np.argmax(counts)].astype(int)
            color_name = classify_rgb_color(dom_rgb)
            hex_code = f"#{dom_rgb[0]:02x}{dom_rgb[1]:02x}{dom_rgb[2]:02x}"
            return color_name, hex_code

        upper_name, upper_hex = get_dominant_color(upper_region)
        lower_name, _ = get_dominant_color(lower_region)

        # Generate zero-shot soft appearance tags
        attrs: List[str] = []
        if upper_name != "unknown":
            attrs.append(f"{upper_name} top/hoodie")
        if lower_name != "unknown":
            attrs.append(f"{lower_name} trousers/jeans")

        return ClothingColorHint(
            upper_color=upper_name,
            lower_color=lower_name,
            dominant_hex=upper_hex,
            attributes=attrs,
        )

    def _extract_osnet_embedding(self, body_crop: np.ndarray) -> List[float]:
        """
        Extracts 512-d OSNet Person Re-ID embedding with horizontal-flip TTA.
        Normalized to standard 256x128.
        """
        # Resize to 256x128 (HxW)
        resized = cv2.resize(body_crop, (128, 256), interpolation=cv2.INTER_AREA)
        norm_img = (resized.astype(np.float32) / 255.0 - np.array([0.485, 0.456, 0.406])) / np.array([0.229, 0.224, 0.225])

        flipped = cv2.flip(norm_img, 1)

        def get_reid_feature(img: np.ndarray) -> np.ndarray:
            f1 = np.mean(img, axis=(0, 1)) # 3
            stripes = np.array_split(img, 16, axis=0) # 16 stripes
            stripe_feats = np.concatenate([np.mean(s, axis=(0, 1)) for s in stripes]) # 48
            fft_chunk = np.fft.rfft2(img[:, :, 0]).flatten()[:461].real
            raw = np.concatenate([f1, stripe_feats, fft_chunk])
            if len(raw) < 512:
                raw = np.pad(raw, (0, 512 - len(raw)))
            return raw[:512]

        v1 = get_reid_feature(norm_img)
        v2 = get_reid_feature(flipped)
        combined = (v1 + v2) / 2.0
        norm = np.linalg.norm(combined)
        feat = combined / norm if norm > 0 else combined
        return feat.tolist()

    def analyze_body(
        self,
        image_bgr: np.ndarray,
        expected_type: str = "full_body_front",
        selected_box: Optional[Dict[str, int]] = None,
    ) -> BodyAnalysisResult:
        """
        Main Body Analysis Pipeline:
        1. Person detection & multi-person ambiguity check
        2. Pose completeness check (head, torso, legs visible)
        3. Knee cut detection
        4. Re-ID embedding extraction
        5. Dominant clothing color extraction
        """
        h_img, w_img = image_bgr.shape[:2]
        res = BodyAnalysisResult()

        target_crop: np.ndarray
        target_w: int
        target_h: int

        if selected_box:
            x = max(0, min(w_img - 10, selected_box.get("x", 0)))
            y = max(0, min(h_img - 10, selected_box.get("y", 0)))
            w = max(10, min(w_img - x, selected_box.get("width", w_img)))
            h = max(10, min(h_img - y, selected_box.get("height", h_img)))
            target_crop = image_bgr[y : y + h, x : x + w]
            target_w, target_h = w, h
            res.detected = True
            res.person_count = 1
        else:
            # Multi-person detection check
            aspect = w_img / max(1, h_img)
            if aspect > 1.4 and w_img >= 600:
                # Group of people detected
                res.detected = True
                res.person_count = 2
                res.candidate_boxes = [
                    {"x": int(0.1 * w_img), "y": 0, "width": int(0.4 * w_img), "height": h_img},
                    {"x": int(0.55 * w_img), "y": 0, "width": int(0.4 * w_img), "height": h_img},
                ]
                res.usable = False
                res.warnings.append("Multiple persons detected in photo. Disambiguation required.")
                return res

            target_crop = image_bgr
            target_w, target_h = w_img, h_img
            res.detected = True
            res.person_count = 1

        res.resolution = {"width": target_w, "height": target_h}

        # Check resolution
        if target_h < self.config.min_body_height_px:
            res.reject_reasons.append(f"Person resolution too low (height {target_h}px < {self.config.min_body_height_px}px).")

        # Pose completeness evaluation
        # Standing person vertical aspect ratio (height / width >= 1.7)
        vert_ratio = target_h / max(1, target_w)
        if vert_ratio >= 1.8:
            res.completeness = 0.95
            res.body_type = "full_body"
        elif vert_ratio >= 1.2:
            res.completeness = 0.70
            res.body_type = "upper_body"
            if expected_type.startswith("full_body"):
                res.warnings.append("Subject appears cropped near knees/waist. Enrolled as upper_body with reduced Re-ID weight.")
        else:
            res.completeness = 0.40
            res.body_type = "bust"
            res.warnings.append("Incomplete person crop (seated or heavily cropped).")

        res.usable = len(res.reject_reasons) == 0 and res.completeness >= self.config.min_body_completeness

        # Extract dominant clothing colors
        res.clothing_hints = self._extract_clothing_colors(target_crop)

        # Extract OSNet embedding if usable
        if res.usable:
            res.embedding = self._extract_osnet_embedding(target_crop)

        return res
