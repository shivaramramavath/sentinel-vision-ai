"""
Single Track (STrack) implementation with Kalman kinematics and quality-weighted EMA embeddings.
"""

from typing import List, Optional, Tuple, Dict, Any
import numpy as np

from .basetrack import BaseTrack, TrackState
from .kalman_filter import KalmanFilter


class STrack(BaseTrack):
    shared_kalman = KalmanFilter()

    def __init__(
        self,
        tlwh: np.ndarray,
        score: float,
        feat: Optional[np.ndarray] = None,
        face_feat: Optional[np.ndarray] = None,
        quality: float = 1.0,
        camera_id: str = "default",
        frame_id: int = 0,
        timestamp: float = 0.0,
    ):
        # Coordinates in [top_left_x, top_left_y, width, height]
        self._tlwh = np.asarray(tlwh, dtype=np.float32)
        self.score = float(score)
        self.quality = float(quality)
        self.camera_id = camera_id
        self.frame_id = frame_id
        self.timestamp = timestamp

        self.kalman_filter: Optional[KalmanFilter] = None
        self.mean: Optional[np.ndarray] = None
        self.covariance: Optional[np.ndarray] = None
        self.is_activated = False

        self.tracklet_len = 0
        self.time_since_update = 0

        # Re-ID Embedding and EMA buffer (Top-N=10 quality-weighted)
        self.curr_feat: Optional[np.ndarray] = None
        self.smooth_feat: Optional[np.ndarray] = None
        self.features_buffer: List[Tuple[np.ndarray, float]] = []  # list of (emb, quality)
        self.max_buffer_size = 10
        self.alpha = 0.9  # EMA momentum

        # Face embedding (kept strictly decoupled from Re-ID feature space)
        self.curr_face_feat: Optional[np.ndarray] = None
        self.face_features_buffer: List[Tuple[np.ndarray, float]] = []

        if feat is not None:
            self.update_features(feat, quality)
        if face_feat is not None:
            self.update_face_features(face_feat, quality)

    def update_features(self, feat: np.ndarray, quality: float = 1.0) -> None:
        """
        Update Re-ID embedding with EMA and store in top-N buffer.
        Never mix with face features.
        """
        feat = np.asarray(feat, dtype=np.float32)
        norm = np.linalg.norm(feat)
        if norm > 0:
            feat = feat / norm

        self.curr_feat = feat

        # Top-N quality-weighted buffer
        self.features_buffer.append((feat, float(quality)))
        # Keep top-N highest quality embeddings
        self.features_buffer.sort(key=lambda x: x[1], reverse=True)
        if len(self.features_buffer) > self.max_buffer_size:
            self.features_buffer = self.features_buffer[: self.max_buffer_size]

        # Quality-weighted average calculation
        weights = np.array([q for _, q in self.features_buffer], dtype=np.float32)
        total_w = np.sum(weights)
        if total_w > 0:
            stacked = np.stack([emb for emb, _ in self.features_buffer], axis=0)
            weighted_avg = np.sum(stacked * weights[:, np.newaxis], axis=0) / total_w
            w_norm = np.linalg.norm(weighted_avg)
            if w_norm > 0:
                weighted_avg = weighted_avg / w_norm
        else:
            weighted_avg = feat

        # EMA update
        if self.smooth_feat is None:
            self.smooth_feat = weighted_avg
        else:
            self.smooth_feat = self.alpha * self.smooth_feat + (1.0 - self.alpha) * weighted_avg
            s_norm = np.linalg.norm(self.smooth_feat)
            if s_norm > 0:
                self.smooth_feat = self.smooth_feat / s_norm

    def update_face_features(self, face_feat: np.ndarray, quality: float = 1.0) -> None:
        """
        Store face embedding in separate buffer. Decoupled from Re-ID.
        """
        face_feat = np.asarray(face_feat, dtype=np.float32)
        norm = np.linalg.norm(face_feat)
        if norm > 0:
            face_feat = face_feat / norm

        self.curr_face_feat = face_feat
        self.face_features_buffer.append((face_feat, float(quality)))
        self.face_features_buffer.sort(key=lambda x: x[1], reverse=True)
        if len(self.face_features_buffer) > self.max_buffer_size:
            self.face_features_buffer = self.face_features_buffer[: self.max_buffer_size]

    @property
    def best_face_feat(self) -> Optional[np.ndarray]:
        """Returns the highest quality face embedding observed in track."""
        if len(self.face_features_buffer) == 0:
            return None
        return self.face_features_buffer[0][0]

    @property
    def tlwh(self) -> np.ndarray:
        """Get current bounding box in [top_left_x, top_left_y, width, height]."""
        if self.mean is None:
            return self._tlwh.copy()
        ret = self.mean[:4].copy()
        ret[2] *= ret[3]
        ret[:2] -= ret[2:] / 2
        return ret

    @property
    def tlbr(self) -> np.ndarray:
        """Convert tlwh to [top_left_x, top_left_y, bottom_right_x, bottom_right_y]."""
        ret = self.tlwh.copy()
        ret[2:] += ret[:2]
        return ret

    @staticmethod
    def tlwh_to_xyah(tlwh: np.ndarray) -> np.ndarray:
        """Convert [tl_x, tl_y, w, h] to [center_x, center_y, aspect_ratio, h]."""
        ret = np.asarray(tlwh, dtype=np.float32).copy()
        ret[:2] += ret[2:] / 2
        ret[2] /= max(1e-6, ret[3])
        return ret

    def to_xyah(self) -> np.ndarray:
        return self.tlwh_to_xyah(self.tlwh)

    def activate(self, kalman_filter: KalmanFilter, frame_id: int) -> None:
        """Start a new tracklet."""
        self.kalman_filter = kalman_filter
        self.track_id = self.next_id()
        self.mean, self.covariance = self.kalman_filter.initiate(self.to_xyah())

        self.tracklet_len = 0
        self.state = TrackState.TRACKED
        if frame_id == 1:
            self.is_activated = True
        self.frame_id = frame_id
        self.start_frame = frame_id
        self.time_since_update = 0

    def re_activate(self, new_track: "STrack", frame_id: int, new_id: bool = False) -> None:
        if self.kalman_filter is None:
            self.kalman_filter = self.shared_kalman

        self.mean, self.covariance = self.kalman_filter.update(
            self.mean, self.covariance, self.tlwh_to_xyah(new_track.tlwh)
        )
        if new_track.curr_feat is not None:
            self.update_features(new_track.curr_feat, new_track.quality)
        if new_track.curr_face_feat is not None:
            self.update_face_features(new_track.curr_face_feat, new_track.quality)

        self.tracklet_len = 0
        self.state = TrackState.TRACKED
        self.is_activated = True
        self.frame_id = frame_id
        if new_id:
            self.track_id = self.next_id()
        self.score = new_track.score
        self.timestamp = new_track.timestamp
        self.time_since_update = 0

    def update(self, new_track: "STrack", frame_id: int) -> None:
        """
        Update a matched track with new measurement.
        """
        self.frame_id = frame_id
        self.tracklet_len += 1
        self.time_since_update = 0

        new_tlwh = new_track.tlwh
        self.mean, self.covariance = self.kalman_filter.update(
            self.mean, self.covariance, self.tlwh_to_xyah(new_tlwh)
        )
        self.state = TrackState.TRACKED
        self.is_activated = True
        self.score = new_track.score
        self.timestamp = new_track.timestamp

        if new_track.curr_feat is not None:
            self.update_features(new_track.curr_feat, new_track.quality)
        if new_track.curr_face_feat is not None:
            self.update_face_features(new_track.curr_face_feat, new_track.quality)

    def predict(self) -> None:
        """Run Kalman predict step."""
        mean_state = self.mean.copy()
        if self.state != TrackState.TRACKED:
            mean_state[7] = 0
        self.mean, self.covariance = self.kalman_filter.predict(mean_state, self.covariance)

    def to_dict(self) -> Dict[str, Any]:
        """Serialize track state for Redis persistence."""
        return {
            "track_id": self.track_id,
            "camera_id": self.camera_id,
            "state": int(self.state),
            "score": float(self.score),
            "quality": float(self.quality),
            "frame_id": int(self.frame_id),
            "timestamp": float(self.timestamp),
            "tlwh": self.tlwh.tolist(),
            "mean": self.mean.tolist() if self.mean is not None else None,
            "covariance": self.covariance.tolist() if self.covariance is not None else None,
            "smooth_feat": self.smooth_feat.tolist() if self.smooth_feat is not None else None,
            "curr_face_feat": self.curr_face_feat.tolist() if self.curr_face_feat is not None else None,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "STrack":
        """Deserialize track from Redis state dictionary."""
        track = cls(
            tlwh=np.array(data["tlwh"], dtype=np.float32),
            score=data["score"],
            quality=data.get("quality", 1.0),
            camera_id=data.get("camera_id", "default"),
            frame_id=data.get("frame_id", 0),
            timestamp=data.get("timestamp", 0.0),
        )
        track.track_id = data["track_id"]
        track.state = TrackState(data["state"])
        track.kalman_filter = cls.shared_kalman

        if data.get("mean") is not None:
            track.mean = np.array(data["mean"], dtype=np.float32)
        if data.get("covariance") is not None:
            track.covariance = np.array(data["covariance"], dtype=np.float32)
        if data.get("smooth_feat") is not None:
            track.smooth_feat = np.array(data["smooth_feat"], dtype=np.float32)
        if data.get("curr_face_feat") is not None:
            track.curr_face_feat = np.array(data["curr_face_feat"], dtype=np.float32)

        track.is_activated = True
        return track
