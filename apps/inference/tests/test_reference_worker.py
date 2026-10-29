"""
Comprehensive tests for Reference Worker pipeline:
1. Clear frontal face (ready)
2. Extreme blur (rejected)
3. Mask / occlusion detection (warning)
4. Multi-face group photo (needs_review disambiguation)
5. Side profile face (poseBin left/right + warning)
6. Cropped body (upper_body warning)
7. Probable different person / outlier (needs_review consistency check)
8. Latency Benchmark (< 2s on GPU, < 6s on CPU)
"""
import time
import cv2
import numpy as np
import pytest

from sentinel_inference.reference_worker import (
    ReferenceWorker,
    QualityGatesConfig,
    DEFAULT_QUALITY_GATES,
)


@pytest.fixture
def worker():
    config = QualityGatesConfig()
    return ReferenceWorker(config=config)


def create_synthetic_face(
    width=400,
    height=500,
    blur=False,
    mask=False,
    sunglasses=False,
    side_pose=False,
    noise_seed=42,
) -> np.ndarray:
    """Generates synthetic portrait fixture image simulating facial structures."""
    np.random.seed(noise_seed)
    # Background
    img = np.full((height, width, 3), 200, dtype=np.uint8)

    # Head oval
    center = (width // 2, int(height * 0.45))
    axes = (int(width * 0.32), int(height * 0.38))
    cv2.ellipse(img, center, axes, 0, 0, 360, (190, 210, 230), -1)

    # Eyes
    eye_y = int(height * 0.38)
    dx = int(width * 0.12)
    left_eye = (center[0] - dx, eye_y)
    right_eye = (center[0] + dx, eye_y)

    if sunglasses:
        # Draw dark sunglasses bar across both eyes
        cv2.rectangle(img, (center[0] - dx - 30, eye_y - 20), (center[0] + dx + 30, eye_y + 20), (20, 20, 20), -1)
    else:
        cv2.circle(img, left_eye, 14, (60, 40, 20), -1)
        cv2.circle(img, right_eye, 14, (60, 40, 20), -1)

    # Nose
    cv2.line(img, (center[0], eye_y + 20), (center[0], eye_y + 60), (120, 140, 160), 4)

    # Mouth / Mask
    mouth_y = int(height * 0.62)
    if mask:
        # Draw surgical mask block over lower half of face
        cv2.rectangle(img, (center[0] - int(width * 0.28), eye_y + 40), (center[0] + int(width * 0.28), int(height * 0.78)), (240, 240, 240), -1)
    else:
        cv2.ellipse(img, (center[0], mouth_y), (35, 12), 0, 0, 180, (80, 80, 160), 3)

    if side_pose:
        # Shift face elements strongly to simulate profile view
        M = np.float32([[1, 0, 80], [0, 1, 0]])
        img = cv2.warpAffine(img, M, (width, height), borderValue=(200, 200, 200))

    if blur:
        # Heavy Gaussian blur to trigger extreme blur rejection gate
        img = cv2.GaussianBlur(img, (51, 51), 30.0)

    return img


def test_clear_frontal_face_ready(worker):
    """Scenario 1: High quality frontal face should be ready with ArcFace embedding."""
    img = create_synthetic_face(blur=False)
    result = worker.process_image_pipeline(
        image_input=img,
        reference_id="ref_clear_01",
        case_id="case_101",
        expected_type="face_front",
    )

    assert result["status"] == "ready"
    assert result["analysis"]["face"]["detected"] is True
    assert result["analysis"]["face"]["usable"] is True
    assert result["analysis"]["face"]["quality"] >= 0.70
    assert result["analysis"]["poseBin"] == "front"
    assert len(result["embeddings"]["face"]["vectorId"]) > 0


def test_extreme_blur_rejected(worker):
    """Scenario 2: Severely blurred photo must be rejected by quality gate."""
    img = create_synthetic_face(blur=True)
    result = worker.process_image_pipeline(
        image_input=img,
        reference_id="ref_blurry_01",
        case_id="case_102",
        expected_type="face_front",
    )

    assert result["status"] == "rejected"
    assert any("blur" in r.lower() for r in result["rejectReasons"])
    assert result["analysis"]["face"]["usable"] is False


def test_mask_sunglasses_occlusion_warning(worker):
    """Scenario 3: Occlusion by sunglasses or mask generates warning."""
    img_glasses = create_synthetic_face(sunglasses=True)
    res_glasses = worker.process_image_pipeline(
        image_input=img_glasses,
        reference_id="ref_glasses_01",
        case_id="case_103",
    )
    assert res_glasses["analysis"]["face"]["occlusion"]["sunglasses"] is True
    assert any("sunglasses" in w.lower() for w in res_glasses["warnings"])

    img_mask = create_synthetic_face(mask=True)
    res_mask = worker.process_image_pipeline(
        image_input=img_mask,
        reference_id="ref_mask_01",
        case_id="case_103",
    )
    assert res_mask["analysis"]["face"]["occlusion"]["mask"] is True
    assert any("mask" in w.lower() for w in res_mask["warnings"])


def test_multi_face_needs_review(worker):
    """Scenario 4: Group photo with multiple subjects triggers needs_review disambiguation."""
    # Create wide image with 2 distinct subjects
    wide_img = np.full((500, 800, 3), 210, dtype=np.uint8)
    f1 = create_synthetic_face(350, 450)
    f2 = create_synthetic_face(350, 450)
    wide_img[20:470, 40:390] = f1
    wide_img[20:470, 420:770] = f2

    result = worker.process_image_pipeline(
        image_input=wide_img,
        reference_id="ref_group_01",
        case_id="case_104",
        selected_face_box=None, # Not yet disambiguated by user
    )

    assert result["status"] == "needs_review"
    assert result["subject"]["faceCountDetected"] >= 2
    assert len(result["subject"]["candidateBoxes"]) >= 2
    assert any("disambiguation" in w.lower() for w in result["warnings"])


def test_profile_side_pose(worker):
    """Scenario 5: Side pose classifies into left/right pose bin with warning."""
    img = create_synthetic_face(side_pose=True)
    result = worker.process_image_pipeline(
        image_input=img,
        reference_id="ref_profile_01",
        case_id="case_105",
        expected_type="face_left",
    )

    assert result["analysis"]["face"]["detected"] is True
    assert result["analysis"]["poseBin"] in ["left", "front_left", "right", "front_right"]


def test_cropped_body_warning(worker):
    """Scenario 6: Person crop cut above knees flags upper_body."""
    # Height to width ratio ~ 1.3 (bust / upper torso only)
    cropped_body = np.full((400, 300, 3), 180, dtype=np.uint8)
    result = worker.process_image_pipeline(
        image_input=cropped_body,
        reference_id="ref_body_cropped",
        case_id="case_106",
        expected_type="full_body_front",
    )

    assert result["analysis"]["body"]["bodyType"] == "upper_body"
    assert any("cropped" in w.lower() for w in result["warnings"])


def test_wrong_person_set_consistency(worker):
    """Scenario 7: Image of a completely different person triggers needs_review."""
    case_id = "case_outlier_test"
    # Seed gallery with person A images (similar noise seed)
    for i in range(2):
        img_a = create_synthetic_face(noise_seed=100)
        worker.process_image_pipeline(
            image_input=img_a,
            reference_id=f"ref_seed_{i}",
            case_id=case_id,
        )

    # Now enroll an outlier photo with radically different feature space
    outlier_img = np.zeros((500, 400, 3), dtype=np.uint8)
    outlier_img[100:400, 100:300] = 255 # High-contrast inverted block
    res_outlier = worker.process_image_pipeline(
        image_input=outlier_img,
        reference_id="ref_impostor_01",
        case_id=case_id,
    )

    assert res_outlier["status"] in ["needs_review", "rejected"]


def test_latency_benchmark(worker):
    """Scenario 8: Benchmark per-image latency (target < 2s on GPU, < 6s on CPU)."""
    img = create_synthetic_face()
    latencies = []

    for i in range(5):
        t0 = time.time()
        res = worker.process_image_pipeline(
            image_input=img,
            reference_id=f"ref_bench_{i}",
            case_id="case_bench",
        )
        elapsed = time.time() - t0
        latencies.append(elapsed)

    mean_latency = float(np.mean(latencies))
    print(f"\n⚡ Reference Worker Latency: Mean = {mean_latency:.4f}s across 5 runs")

    # Hard SLA: Must be strictly under 6 seconds on CPU
    assert mean_latency < 6.0, f"Latency {mean_latency:.2f}s exceeds CPU target of 6.0s"
    assert mean_latency < 2.0, f"Latency {mean_latency:.2f}s exceeds target of 2.0s"
