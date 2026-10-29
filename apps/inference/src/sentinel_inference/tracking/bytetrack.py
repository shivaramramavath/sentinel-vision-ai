"""
ByteTrack: Multi-Object Tracking by Associating Every Detection Box.

Reference:
Zhang et al., "ByteTrack: Multi-Object Tracking by Associating Every Detection Box", ECCV 2022.
"""

from typing import List, Tuple, Optional
import numpy as np

from .basetrack import TrackState
from .kalman_filter import KalmanFilter
from .matching import iou_distance, linear_assignment
from .state_store import TrackRedisStateStore
from .track import STrack


class ByteTracker:
    """
    ByteTrack implementation with two-stage high/low confidence association
    and Redis state persistence.
    """

    def __init__(
        self,
        camera_id: str = "camera-1",
        track_thresh: float = 0.5,
        match_thresh: float = 0.8,
        low_thresh: float = 0.1,
        max_time_lost: int = 30,
        state_store: Optional[TrackRedisStateStore] = None,
    ):
        self.camera_id = camera_id
        self.track_thresh = track_thresh
        self.match_thresh = match_thresh
        self.low_thresh = low_thresh
        self.max_time_lost = max_time_lost

        self.kalman_filter = KalmanFilter()
        self.state_store = state_store

        self.tracked_stracks: List[STrack] = []
        self.lost_stracks: List[STrack] = []
        self.removed_stracks: List[STrack] = []

        self.frame_id = 0

        # Try restoring tracks from persistent storage
        if self.state_store is not None:
            restored = self.state_store.load_tracks(self.camera_id)
            if restored:
                self.tracked_stracks = [t for t in restored if t.state == TrackState.TRACKED]
                self.lost_stracks = [t for t in restored if t.state == TrackState.LOST]

    def update(
        self,
        detections: np.ndarray,
        features: Optional[np.ndarray] = None,
        face_features: Optional[np.ndarray] = None,
        qualities: Optional[np.ndarray] = None,
        timestamp: float = 0.0,
    ) -> List[STrack]:
        """
        Update tracker with new frame detections.

        Args:
            detections: Array of shape (N, 5) with [x1, y1, x2, y2, score].
            features: Optional Re-ID embeddings for detections (N, D).
            face_features: Optional Face embeddings for detections (N, D).
            qualities: Optional quality scores (N,).
            timestamp: Frame timestamp in seconds.

        Returns:
            List of active confirmed STrack objects for this frame.
        """
        self.frame_id += 1
        activated_stracks: List[STrack] = []
        refind_stracks: List[STrack] = []
        lost_stracks: List[STrack] = []
        removed_stracks: List[STrack] = []

        if len(detections) > 0:
            scores = detections[:, 4]
            bboxes = detections[:, :4]

            remain_inds = scores >= self.track_thresh
            inds_low = (scores >= self.low_thresh) & (scores < self.track_thresh)

            # High confidence detections
            dets = bboxes[remain_inds]
            scores_keep = scores[remain_inds]
            feats_keep = features[remain_inds] if features is not None else [None] * len(dets)
            face_feats_keep = face_features[remain_inds] if face_features is not None else [None] * len(dets)
            qualities_keep = qualities[remain_inds] if qualities is not None else [1.0] * len(dets)

            # Low confidence detections
            dets_second = bboxes[inds_low]
            scores_second = scores[inds_low]
            feats_second = features[inds_low] if features is not None else [None] * len(dets_second)
            face_feats_second = face_features[inds_low] if face_features is not None else [None] * len(dets_second)
            qualities_second = qualities[inds_low] if qualities is not None else [0.5] * len(dets_second)
        else:
            dets = np.empty((0, 4))
            scores_keep = np.empty((0,))
            feats_keep = []
            face_feats_keep = []
            qualities_keep = []
            dets_second = np.empty((0, 4))
            scores_second = np.empty((0,))
            feats_second = []
            face_feats_second = []
            qualities_second = []

        # Convert detections to STrack
        detections_high = [
            STrack(
                self.tlbr_to_tlwh(tlbr),
                s,
                feat=f,
                face_feat=ff,
                quality=q,
                camera_id=self.camera_id,
                frame_id=self.frame_id,
                timestamp=timestamp,
            )
            for tlbr, s, f, ff, q in zip(dets, scores_keep, feats_keep, face_feats_keep, qualities_keep)
        ]

        detections_low = [
            STrack(
                self.tlbr_to_tlwh(tlbr),
                s,
                feat=f,
                face_feat=ff,
                quality=q,
                camera_id=self.camera_id,
                frame_id=self.frame_id,
                timestamp=timestamp,
            )
            for tlbr, s, f, ff, q in zip(dets_second, scores_second, feats_second, face_feats_second, qualities_second)
        ]

        # Step 1: Predict new locations of existing tracks
        unconfirmed: List[STrack] = []
        tracked_stracks: List[STrack] = []
        for track in self.tracked_stracks:
            if not track.is_activated:
                unconfirmed.append(track)
            else:
                tracked_stracks.append(track)

        strack_pool = self.joint_stracks(tracked_stracks, self.lost_stracks)
        for track in strack_pool:
            track.predict()

        # Step 2: First association (High confidence detections with Kalman predictions)
        dists = iou_distance(strack_pool, detections_high)
        matches, u_track, u_detection = linear_assignment(dists, thresh=self.match_thresh)

        for itracked, idet in matches:
            track = strack_pool[itracked]
            det = detections_high[idet]
            if track.state == TrackState.TRACKED:
                track.update(det, self.frame_id)
                activated_stracks.append(track)
            else:
                track.re_activate(det, self.frame_id, new_id=False)
                refind_stracks.append(track)

        # Step 3: Second association (Low confidence detections with remaining tracks)
        r_tracked_stracks = [
            strack_pool[i]
            for i in u_track
            if strack_pool[i].state == TrackState.TRACKED
        ]
        dists_second = iou_distance(r_tracked_stracks, detections_low)
        matches_second, u_track_second, _ = linear_assignment(dists_second, thresh=0.5)

        for itracked, idet in matches_second:
            track = r_tracked_stracks[itracked]
            det = detections_low[idet]
            if track.state == TrackState.TRACKED:
                track.update(det, self.frame_id)
                activated_stracks.append(track)
            else:
                track.re_activate(det, self.frame_id, new_id=False)
                refind_stracks.append(track)

        # Mark remaining unmatched tracked tracks as lost
        for it in u_track_second:
            track = r_tracked_stracks[it]
            if track.state != TrackState.LOST:
                track.mark_lost()
                lost_stracks.append(track)

        # Step 4: Deal with unconfirmed tracks using remaining high confidence detections
        detections_remaining = [detections_high[i] for i in u_detection]
        dists_unconfirmed = iou_distance(unconfirmed, detections_remaining)
        matches_unconf, u_unconfirmed, u_detection_final = linear_assignment(
            dists_unconfirmed, thresh=0.7
        )

        for itracked, idet in matches_unconf:
            unconfirmed[itracked].update(detections_remaining[idet], self.frame_id)
            activated_stracks.append(unconfirmed[itracked])

        for it in u_unconfirmed:
            track = unconfirmed[it]
            track.mark_removed()
            removed_stracks.append(track)

        # Step 5: Init new tracks from unmatched high confidence detections
        for inew in u_detection_final:
            track = detections_remaining[inew]
            if track.score < self.track_thresh:
                continue
            track.activate(self.kalman_filter, self.frame_id)
            activated_stracks.append(track)

        # Step 6: Update lost tracks lifecycle
        for track in self.lost_stracks:
            if self.frame_id - track.frame_id > self.max_time_lost:
                track.mark_removed()
                removed_stracks.append(track)

        # Step 7: Update tracked, lost, and removed lists
        self.tracked_stracks = [t for t in self.tracked_stracks if t.state == TrackState.TRACKED]
        self.tracked_stracks = self.joint_stracks(self.tracked_stracks, activated_stracks)
        self.tracked_stracks = self.joint_stracks(self.tracked_stracks, refind_stracks)

        self.lost_stracks = self.sub_stracks(self.lost_stracks, self.tracked_stracks)
        self.lost_stracks.extend(lost_stracks)
        self.lost_stracks = self.sub_stracks(self.lost_stracks, self.removed_stracks)

        self.removed_stracks.extend(removed_stracks)
        self.tracked_stracks, self.lost_stracks = self.remove_duplicate_stracks(
            self.tracked_stracks, self.lost_stracks
        )

        output_stracks = [track for track in self.tracked_stracks if track.is_activated]

        # Persist updated state to Redis
        if self.state_store is not None:
            self.state_store.save_tracks(self.camera_id, self.tracked_stracks + self.lost_stracks)

        return output_stracks

    @staticmethod
    def tlbr_to_tlwh(tlbr: np.ndarray) -> np.ndarray:
        ret = np.asarray(tlbr, dtype=np.float32).copy()
        ret[2] -= ret[0]
        ret[3] -= ret[1]
        return ret

    @staticmethod
    def joint_stracks(tlista: List[STrack], tlistb: List[STrack]) -> List[STrack]:
        exists = {t.track_id: 1 for t in tlista}
        res = list(tlista)
        for t in tlistb:
            if t.track_id not in exists:
                exists[t.track_id] = 1
                res.append(t)
        return res

    @staticmethod
    def sub_stracks(tlista: List[STrack], tlistb: List[STrack]) -> List[STrack]:
        stracks = {t.track_id: t for t in tlista}
        for t in tlistb:
            stracks.pop(t.track_id, None)
        return list(stracks.values())

    @staticmethod
    def remove_duplicate_stracks(
        stracksa: List[STrack], stracksb: List[STrack]
    ) -> Tuple[List[STrack], List[STrack]]:
        pdist = iou_distance(stracksa, stracksb)
        pairs = np.where(pdist < 0.15)
        dupa, dupb = list(), list()
        for p, q in zip(*pairs):
            timep = stracksa[p].frame_id - stracksa[p].start_frame
            timeq = stracksb[q].frame_id - stracksb[q].start_frame
            if timep > timeq:
                dupb.append(q)
            else:
                dupa.append(p)
        resa = [t for i, t in enumerate(stracksa) if i not in dupa]
        resb = [t for i, t in enumerate(stracksb) if i not in dupb]
        return resa, resb
