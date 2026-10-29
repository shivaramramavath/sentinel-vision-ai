"""
Cascade Tuning & Brief Appearance Recall Optimization.

Simulates and evaluates cascade sampling policies (1, 2, 4, 8 FPS)
and Re-ID shortlist filtering thresholds (0.35, 0.45, 0.55) against
brief appearances (targets crossing FOV in 0.5s - 2.0s).
"""

from dataclasses import dataclass
from typing import Dict, List, Tuple
import numpy as np


@dataclass
class CascadeConfig:
    sampling_fps: float
    reid_recall_thresh: float
    motion_gate_thresh: float


@dataclass
class CascadePerformance:
    config: CascadeConfig
    recall: float
    missed_brief_appearances: int
    total_brief_appearances: int
    relative_speedup_x: float
    avg_inference_ms_per_minute_video: float


class CascadeTuner:
    """
    Evaluates cascade configurations to maximize recall on brief appearances
    while minimizing redundant computation on static/empty frames.
    """

    def benchmark_configurations(
        self,
        appearances_duration_sec: List[float],
        configs: Optional[List[CascadeConfig]] = None,
    ) -> List[CascadePerformance]:
        if configs is None:
            configs = [
                CascadeConfig(sampling_fps=1.0, reid_recall_thresh=0.55, motion_gate_thresh=15.0),
                CascadeConfig(sampling_fps=2.0, reid_recall_thresh=0.45, motion_gate_thresh=10.0),  # Baseline
                CascadeConfig(sampling_fps=4.0, reid_recall_thresh=0.40, motion_gate_thresh=8.0),
                CascadeConfig(sampling_fps=8.0, reid_recall_thresh=0.35, motion_gate_thresh=5.0),
            ]

        results: List[CascadePerformance] = []
        n_appearances = len(appearances_duration_sec)

        for cfg in configs:
            missed = 0
            for dur in appearances_duration_sec:
                # Frames captured during target presence
                frames_captured = int(dur * cfg.sampling_fps)
                if frames_captured == 0:
                    missed += 1

            recall = (n_appearances - missed) / max(1, n_appearances)
            # Relative speedup against full 30 FPS decoding
            # 30 fps -> ~1800 frames/min
            frames_per_min = 60 * cfg.sampling_fps
            relative_speedup = 30.0 / cfg.sampling_fps
            ms_per_min = frames_per_min * 12.5  # ~12.5 ms per frame with YOLO+OSNet

            results.append(
                CascadePerformance(
                    config=cfg,
                    recall=round(recall, 4),
                    missed_brief_appearances=missed,
                    total_brief_appearances=n_appearances,
                    relative_speedup_x=round(relative_speedup, 1),
                    avg_inference_ms_per_minute_video=round(ms_per_min, 1),
                )
            )

        return results
