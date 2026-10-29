"""
Unit and Integration Tests for Phase 5:
- Local Tracking (ByteTrack, BoT-SORT, Kalman filter, Redis state store)
- Camera Topology Graph (S_camera, Gaussian decay, online learning)
- Evidence Fusion (Features, Logistic Regression, XGBoost, ECE Calibration)
- Cross-Camera Journey Reconstruction (Spatio-Temporal DAG, Viterbi Paths)
"""

import pytest
import numpy as np

from sentinel_inference.tracking import (
    KalmanFilter,
    STrack,
    TrackState,
    ByteTracker,
    BoTSORTTracker,
    TrackRedisStateStore,
    iou_distance,
    linear_assignment,
)
from sentinel_inference.fusion import (
    CameraTopologyGraph,
    CameraDomainNormalizer,
    EvidenceFeatures,
    FeatureExtractor,
    EvidenceFusionModel,
    compute_ece,
    compute_fmr_operating_points,
    CandidateSightingNode,
    CrossCameraJourneyReconstructor,
)


# =========================================================================
# 1. Local Tracking Tests
# =========================================================================

def test_kalman_filter_kinematics():
    kf = KalmanFilter()
    measurement = np.array([100.0, 100.0, 0.5, 200.0], dtype=np.float32)
    mean, cov = kf.initiate(measurement)

    assert mean.shape == (8,)
    assert cov.shape == (8, 8)
    np.testing.assert_allclose(mean[:4], measurement)

    # Predict
    pred_mean, pred_cov = kf.predict(mean, cov)
    assert pred_mean.shape == (8,)

    # Update with shifted measurement
    new_meas = np.array([105.0, 102.0, 0.5, 202.0], dtype=np.float32)
    upd_mean, upd_cov = kf.update(pred_mean, pred_cov, new_meas)
    assert upd_mean.shape == (8,)
    assert abs(upd_mean[0] - 105.0) < 5.0


def test_strack_quality_weighted_ema_and_modality_separation():
    emb1 = np.random.randn(512).astype(np.float32)
    emb1 /= np.linalg.norm(emb1)
    face_emb1 = np.random.randn(512).astype(np.float32)
    face_emb1 /= np.linalg.norm(face_emb1)

    track = STrack(
        tlwh=np.array([50, 50, 40, 100], dtype=np.float32),
        score=0.9,
        feat=emb1,
        face_feat=face_emb1,
        quality=0.95,
        camera_id="cam-1",
    )

    # Invariant: Re-ID and Face embeddings must stay in distinct buffers
    assert len(track.features_buffer) == 1
    assert len(track.face_features_buffer) == 1
    assert track.smooth_feat is not None
    assert track.curr_face_feat is not None
    assert not np.array_equal(track.smooth_feat, track.curr_face_feat)

    # Update with second measurement
    emb2 = np.random.randn(512).astype(np.float32)
    emb2 /= np.linalg.norm(emb2)
    track.update_features(emb2, quality=0.80)
    assert len(track.features_buffer) == 2

    # Serialization test
    d = track.to_dict()
    restored = STrack.from_dict(d)
    assert restored.camera_id == "cam-1"
    np.testing.assert_allclose(restored.tlwh, track.tlwh, atol=1e-3)


def test_bytetrack_association_and_continuity():
    tracker = ByteTracker(camera_id="cam-test", track_thresh=0.5, low_thresh=0.1)

    # Frame 1: Two persons
    dets1 = np.array(
        [
            [100, 100, 160, 220, 0.95],
            [300, 200, 360, 320, 0.90],
        ],
        dtype=np.float32,
    )
    t1 = tracker.update(dets1, timestamp=0.0)
    assert len(t1) == 2
    id1, id2 = t1[0].track_id, t1[1].track_id

    # Frame 2: Smooth movement with one low-confidence detection (occlusion)
    dets2 = np.array(
        [
            [104, 102, 164, 222, 0.94],
            [303, 201, 363, 321, 0.35],  # Low confidence, matched in stage 2!
        ],
        dtype=np.float32,
    )
    t2 = tracker.update(dets2, timestamp=0.1)
    assert len(t2) == 2
    active_ids = [t.track_id for t in t2]
    assert id1 in active_ids
    assert id2 in active_ids


def test_track_redis_state_store():
    store = TrackRedisStateStore(redis_url="redis://localhost:9999/0")  # will use in-memory fallback
    track = STrack(
        tlwh=np.array([10, 10, 50, 100], dtype=np.float32),
        score=0.85,
        camera_id="cam-mem-1",
    )
    track.track_id = 42
    track.state = TrackState.TRACKED

    store.save_tracks("cam-mem-1", [track])
    loaded = store.load_tracks("cam-mem-1")
    assert len(loaded) == 1
    assert loaded[0].track_id == 42
    assert loaded[0].state == TrackState.TRACKED

    store.clear("cam-mem-1")
    assert len(store.load_tracks("cam-mem-1")) == 0


# =========================================================================
# 2. Camera Topology & Plausibility Tests
# =========================================================================

def test_camera_topology_plausibility_and_learning():
    topo = CameraTopologyGraph(same_camera_dwell_sec=120.0)
    topo.add_edge("cam-A", "cam-B", min_travel_sec=10.0, max_travel_sec=30.0)

    # Perfect time
    assert topo.calculate_plausibility("cam-A", "cam-B", 0.0, 20.0) == 1.0

    # Intra-camera dwell
    assert topo.calculate_plausibility("cam-A", "cam-A", 0.0, 60.0) == 1.0
    assert topo.calculate_plausibility("cam-A", "cam-A", 0.0, 300.0) < 0.5

    # Out of window decay
    too_fast = topo.calculate_plausibility("cam-A", "cam-B", 0.0, 2.0)
    too_slow = topo.calculate_plausibility("cam-A", "cam-B", 0.0, 60.0)
    assert too_fast < 0.1
    assert too_slow < 0.1

    # Impossible direction
    assert topo.calculate_plausibility("cam-B", "cam-A", 0.0, 20.0) == 0.0

    # Online learning from confirmed reviews
    for obs in [19.0, 21.0, 20.5, 19.5, 20.0]:
        topo.update_from_verification("cam-A", "cam-B", obs)
    edge = topo.get_edge("cam-A", "cam-B")
    assert abs(edge.mean_travel_sec - 20.0) < 0.5


# =========================================================================
# 3. Evidence Fusion & Calibration Tests
# =========================================================================

def test_camera_domain_normalizer():
    norm = CameraDomainNormalizer(default_mean=0.40, default_std=0.10)
    norm.set_camera_stats("cam-dark", mean=0.25, std=0.08)

    # Score of 0.35 is below mean on standard camera, but well above mean on dark camera
    s_std = norm.normalize(0.35, "cam-standard")
    s_dark = norm.normalize(0.35, "cam-dark")
    assert s_dark > s_std


def test_fusion_feature_extractor_and_face_available_mask():
    extractor = FeatureExtractor()
    feat_with_face = extractor.extract(
        camera_id="cam-1",
        t_sec=10.0,
        raw_reid_score=0.82,
        raw_face_score=0.88,
        face_quality=0.90,
    )
    assert feat_with_face.face_available == 1.0
    assert feat_with_face.s_face > 0.0

    feat_reid_only = extractor.extract(
        camera_id="cam-1",
        t_sec=10.0,
        raw_reid_score=0.82,
        raw_face_score=None,  # No face available
    )
    assert feat_reid_only.face_available == 0.0
    assert feat_reid_only.s_face == 0.0


def test_fusion_model_training_and_compliance():
    np.random.seed(42)
    X_train = np.random.rand(500, 10).astype(np.float32)
    y_train = (X_train[:, 0] + 1.5 * X_train[:, 1] > 1.2).astype(int)
    X_val = np.random.rand(150, 10).astype(np.float32)
    y_val = (X_val[:, 0] + 1.5 * X_val[:, 1] > 1.2).astype(int)

    model = EvidenceFusionModel(model_type="logistic")
    metrics = model.train_and_calibrate(X_train, y_train, X_val, y_val)

    assert metrics.expected_calibration_error < 0.10
    assert metrics.roc_auc > 0.90
    assert "1.00%" in metrics.fmr_thresholds

    # Strict compliance verification
    sample_pred = model.predict_score(X_val[0])
    assert sample_pred["display_label"] == "Possible match"
    assert "explanation" in sample_pred
    assert "s_face" in sample_pred["explanation"]
    assert "s_reid" in sample_pred["explanation"]


# =========================================================================
# 4. Cross-Camera Journey Reconstruction Tests
# =========================================================================

def test_cross_camera_journey_reconstruction():
    topo = CameraTopologyGraph()
    topo.add_edge("cam-1", "cam-2", min_travel_sec=10, max_travel_sec=30)
    topo.add_edge("cam-2", "cam-3", min_travel_sec=15, max_travel_sec=35)

    target_emb = np.random.randn(512).astype(np.float32)
    target_emb /= np.linalg.norm(target_emb)

    s1 = CandidateSightingNode("s1", "cam-1", 0.0, target_emb + 0.01 * np.random.randn(512).astype(np.float32), fusion_score=0.92)
    s2 = CandidateSightingNode("s2", "cam-2", 20.0, target_emb + 0.01 * np.random.randn(512).astype(np.float32), fusion_score=0.89)
    s3 = CandidateSightingNode("s3", "cam-3", 45.0, target_emb + 0.01 * np.random.randn(512).astype(np.float32), fusion_score=0.91)
    distractor = CandidateSightingNode("s_dist", "cam-99", 25.0, np.random.randn(512).astype(np.float32), fusion_score=0.3)

    reconstructor = CrossCameraJourneyReconstructor(topology_graph=topo)
    journeys = reconstructor.reconstruct_journeys([s1, s2, s3, distractor], top_k=3)

    assert len(journeys) >= 1
    best_journey = journeys[0]
    expected_cams = ["cam-1", "cam-2", "cam-3"]
    assert [s.camera_id for s in best_journey.sightings] == expected_cams
    assert best_journey.display_label == "Possible match"

    for hop in best_journey.hops:
        assert hop.display_label == "Possible match"
        assert "appearance_sim" in hop.explanation

    # Agglomerative clustering test
    clusters = reconstructor.cluster_sightings_by_appearance([s1, s2, s3, distractor])
    assert len(clusters) >= 2
    # The largest cluster should contain the 3 target sightings
    assert len(clusters[0]) == 3


def test_geographic_s_camera_hard_constraints_and_ranking():
    topo = CameraTopologyGraph()

    # 1. Test Hard Constraint: dt < distance / 3.0 m/s sprinting speed -> S_camera = 0.0
    # Camera distance = 300 meters -> min sprint time = 100 seconds
    topo.add_edge("cam-start", "cam-far", min_travel_sec=180.0, max_travel_sec=260.0, distance_meters=300.0)

    # At 50s: speed = 6.0 m/s (superhuman sprint) -> must be strictly 0.0
    assert topo.calculate_plausibility("cam-start", "cam-far", 0.0, 50.0) == 0.0
    # At 99s: speed = 3.03 m/s (still above 3 m/s) -> 0.0
    assert topo.calculate_plausibility("cam-start", "cam-far", 0.0, 99.0) == 0.0
    # At 214s: (300m / 1.4 m/s ~ 214s expected time) -> high plausibility (1.0 in window)
    assert topo.calculate_plausibility("cam-start", "cam-far", 0.0, 214.0) == 1.0

    # 2. Test Dynamic Prior from distance when edge is not pre-configured
    # Distance = 140m -> expected = 100s, min_physical = 140 / 3.0 = 46.6s
    # dt = 30s (< 46.6s) -> 0.0
    assert topo.calculate_plausibility("cam-start", "cam-unseen", 0.0, 30.0, distance_meters=140.0) == 0.0
    # dt = 100s -> ~ 1.0
    assert topo.calculate_plausibility("cam-start", "cam-unseen", 0.0, 100.0, distance_meters=140.0) > 0.95

    # 3. Test "Next cameras to search" ranking
    from_coords = (78.4867, 17.3850)
    # Target 1: North along bearing 0 deg, heading 180 deg (faces oncoming walker!)
    cam_facing_north = {
        "id": "cam-north-facing",
        "name": "North Gate (Facing South)",
        "coordinates": [78.4867, 17.3860],  # ~111m north
        "headingDeg": 180.0,  # Points South, directly facing oncoming pedestrian walking North!
        "fovDeg": 75.0,
    }
    # Target 2: Same distance North, but camera heading 0 deg (pointing away from oncoming walker)
    cam_away_north = {
        "id": "cam-north-away",
        "name": "North Gate (Facing North)",
        "coordinates": [78.4867, 17.3860],
        "headingDeg": 0.0,  # Points away from oncoming walker
        "fovDeg": 75.0,
    }
    # Target 3: 5000m away (outside reachable area)
    cam_too_far = {
        "id": "cam-too-far",
        "name": "Distant CCTV",
        "coordinates": [78.5300, 17.3850],
        "headingDeg": 270.0,
        "fovDeg": 75.0,
    }

    # At elapsed_sec = 120s (~168m reachable radius)
    ranked = topo.rank_next_cameras(
        from_camera_id="cam-origin",
        from_coords=from_coords,
        last_seen_sec=0.0,
        query_time_sec=120.0,
        camera_catalog=[cam_facing_north, cam_away_north, cam_too_far],
    )

    # cam_too_far is outside reachable area
    assert not any(r["cameraId"] == "cam-too-far" for r in ranked)
    assert len(ranked) == 2

    # cam-north-facing must rank higher than cam-north-away because it faces the walking direction
    assert ranked[0]["cameraId"] == "cam-north-facing"
    assert ranked[0]["facesWalkingDirection"] is True
    assert ranked[1]["cameraId"] == "cam-north-away"
    assert ranked[1]["facesWalkingDirection"] is False
    assert ranked[0]["rankScore"] > ranked[1]["rankScore"]


def test_geo_ablation_distance_based_timing_vs_without():
    """Validates the Experiment D Geo Ablation: S_camera with distance-based timing vs without it."""
    import sys
    from pathlib import Path
    scripts_dir = Path(__file__).resolve().parent.parent / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    from run_experiments import (
        generate_evaluation_testbed,
        compute_metrics,
    )

    (
        y_true,
        s_face,
        s_reid,
        s_temporal,
        s_camera_dist,
        s_camera_nodist,
        face_avail,
    ) = generate_evaluation_testbed(n_samples=1000, random_seed=123)

    # 1. With distance-based timing & 3.0 m/s sprinting constraint
    score_with_dist = np.where(
        face_avail > 0.5,
        0.35 * s_face + 0.35 * s_reid + 0.20 * s_camera_dist + 0.10 * s_temporal,
        0.60 * s_reid + 0.25 * s_camera_dist + 0.15 * s_temporal,
    )
    metrics_with_dist = compute_metrics(y_true, score_with_dist, threshold=0.50)

    # 2. Without distance-based timing (unconstrained coarse bounds)
    score_no_dist = np.where(
        face_avail > 0.5,
        0.35 * s_face + 0.35 * s_reid + 0.20 * s_camera_nodist + 0.10 * s_temporal,
        0.60 * s_reid + 0.25 * s_camera_nodist + 0.15 * s_temporal,
    )
    metrics_no_dist = compute_metrics(y_true, score_no_dist, threshold=0.50)

    # Assert that distance-based timing yields higher precision and F1
    assert metrics_with_dist["precision"] > metrics_no_dist["precision"]
    assert metrics_with_dist["f1"] > metrics_no_dist["f1"]
    assert metrics_with_dist["precision"] >= 90.0
    assert metrics_with_dist["recall"] >= 98.0


