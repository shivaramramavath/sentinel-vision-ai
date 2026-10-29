"""
Base tracking primitives and lifecycle states.
"""

from enum import IntEnum
from typing import Optional


class TrackState(IntEnum):
    NEW = 0
    TRACKED = 1
    LOST = 2
    REMOVED = 3


class BaseTrack:
    _count = 0

    track_id = 0
    is_activated = False
    state = TrackState.NEW

    history = {}
    features = []
    curr_feature = None
    score = 0
    start_frame = 0
    frame_id = 0
    time_since_update = 0

    @property
    def end_frame(self) -> int:
        return self.frame_id

    @classmethod
    def next_id(cls) -> int:
        cls._count += 1
        return cls._count

    @classmethod
    def reset_id(cls, start: int = 0) -> None:
        cls._count = start

    def activate(self, *args) -> None:
        raise NotImplementedError

    def predict(self) -> None:
        raise NotImplementedError

    def update(self, *args, **kwargs) -> None:
        raise NotImplementedError

    def mark_lost(self) -> None:
        self.state = TrackState.LOST

    def mark_removed(self) -> None:
        self.state = TrackState.REMOVED
