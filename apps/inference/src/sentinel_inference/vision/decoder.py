"""
Video Decoder module with adaptive sampling and motion gating.

Sampling rates:
- Base rate: 2 FPS (idle/monitoring)
- Boosted rate: 8 FPS (candidate sighting detected or active track)
- Motion gating: Skips static/background frames via luminance variance.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Iterator
import cv2
import numpy as np


@dataclass
class DecodedFrame:
    frame: np.ndarray       # HWC BGR uint8
    timestamp_sec: float    # Timestamp in seconds from video start or epoch
    frame_index: int
    is_motion: bool


class VideoDecoderBase(ABC):
    @abstractmethod
    def decode(self, source_uri: str, start_sec: float = 0.0, end_sec: float | None = None) -> Iterator[DecodedFrame]:
        pass

    @abstractmethod
    def set_boost(self, boost: bool) -> None:
        pass


class AdaptiveVideoDecoder(VideoDecoderBase):
    def __init__(
        self,
        base_fps: float = 2.0,
        boost_fps: float = 8.0,
        motion_threshold: float = 12.0,  # Mean absolute diff threshold on 64x64 thumbnail
    ) -> None:
        self.base_fps = base_fps
        self.boost_fps = boost_fps
        self.current_fps = base_fps
        self.motion_threshold = motion_threshold
        self._is_boosted = False

    def set_boost(self, boost: bool) -> None:
        self._is_boosted = boost
        self.current_fps = self.boost_fps if boost else self.base_fps

    def _compute_motion(self, prev_gray: np.ndarray | None, curr_frame: np.ndarray) -> tuple[bool, np.ndarray]:
        # Downscale to 64x64 grayscale for ultra-fast motion estimation
        small = cv2.resize(curr_frame, (64, 64))
        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

        if prev_gray is None:
            return True, gray

        diff = cv2.absdiff(prev_gray, gray)
        mean_diff = float(np.mean(diff))
        is_motion = mean_diff >= self.motion_threshold
        return is_motion, gray

    def decode(
        self,
        source_uri: str,
        start_sec: float = 0.0,
        end_sec: float | None = None,
    ) -> Iterator[DecodedFrame]:
        """
        Decodes video stream using PyAV or OpenCV VideoCapture fallback.
        Yields frames at the adaptive FPS rate, skipping non-motion frames.
        """
        cap = cv2.VideoCapture(source_uri)
        if not cap.isOpened():
            # If synthetic/mock URI or file not found, yield dummy test frame if in testing
            return

        native_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        frame_interval = max(1, int(round(native_fps / self.current_fps)))

        prev_gray: np.ndarray | None = None
        frame_idx = 0

        if start_sec > 0:
            cap.set(cv2.CAP_PROP_POS_MSEC, start_sec * 1000)

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            current_pos_sec = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
            if end_sec is not None and current_pos_sec > end_sec:
                break

            frame_interval = max(1, int(round(native_fps / self.current_fps)))

            if frame_idx % frame_interval == 0:
                is_motion, prev_gray = self._compute_motion(prev_gray, frame)

                # Skip completely static frames unless boosted
                if is_motion or self._is_boosted:
                    yield DecodedFrame(
                        frame=frame,
                        timestamp_sec=current_pos_sec,
                        frame_index=frame_idx,
                        is_motion=is_motion,
                    )

            frame_idx += 1

        cap.release()
