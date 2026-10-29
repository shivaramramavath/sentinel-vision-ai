"""
Vision Pipeline Latency Profiler and Micro-Benchmarking Engine.

Records per-stage latency (ms/frame, ms/crop, crops/sec) and throughput
across video decoding, person detection, feature extraction, vector querying,
and multimodal evidence fusion.
"""

from dataclasses import dataclass, field
import time
from typing import Dict, List, Optional
import numpy as np


@dataclass
class StageMetrics:
    stage_name: str
    total_calls: int = 0
    total_time_ms: float = 0.0
    latencies_ms: List[float] = field(default_factory=list)

    @property
    def avg_ms(self) -> float:
        return self.total_time_ms / max(1, self.total_calls)

    @property
    def p50_ms(self) -> float:
        return float(np.percentile(self.latencies_ms, 50)) if self.latencies_ms else 0.0

    @property
    def p95_ms(self) -> float:
        return float(np.percentile(self.latencies_ms, 95)) if self.latencies_ms else 0.0

    @property
    def p99_ms(self) -> float:
        return float(np.percentile(self.latencies_ms, 99)) if self.latencies_ms else 0.0

    @property
    def throughput_per_sec(self) -> float:
        avg = self.avg_ms
        return (1000.0 / avg) if avg > 0 else 0.0


class VisionProfiler:
    """
    Micro-profiling manager tracking execution timings across all pipeline components.
    """

    def __init__(self):
        self.stages: Dict[str, StageMetrics] = {}

    def record(self, stage_name: str, duration_ms: float) -> None:
        if stage_name not in self.stages:
            self.stages[stage_name] = StageMetrics(stage_name=stage_name)
        m = self.stages[stage_name]
        m.total_calls += 1
        m.total_time_ms += duration_ms
        m.latencies_ms.append(duration_ms)

    def time_block(self, stage_name: str):
        """Context manager to profile a code block."""
        return _ProfileContext(self, stage_name)

    def summary(self) -> Dict[str, Dict[str, float]]:
        res = {}
        for name, m in self.stages.items():
            res[name] = {
                "calls": m.total_calls,
                "avg_ms": round(m.avg_ms, 2),
                "p50_ms": round(m.p50_ms, 2),
                "p95_ms": round(m.p95_ms, 2),
                "p99_ms": round(m.p99_ms, 2),
                "throughput_per_sec": round(m.throughput_per_sec, 1),
            }
        return res

    def print_report(self) -> None:
        print("\n" + "=" * 80)
        print(" SENTINEL VISION AI — INFERENCE MICRO-BENCHMARK PROFILER")
        print("=" * 80)
        print(f"{'Stage Name':<28} | {'Calls':<7} | {'Avg (ms)':<9} | {'p50 (ms)':<9} | {'p95 (ms)':<9} | {'Throughput'}")
        print("-" * 80)
        for name, m in self.stages.items():
            tp_str = f"{m.throughput_per_sec:.1f} /s"
            print(f"{name:<28} | {m.total_calls:<7} | {m.avg_ms:<9.2f} | {m.p50_ms:<9.2f} | {m.p95_ms:<9.2f} | {tp_str}")
        print("=" * 80 + "\n")


class _ProfileContext:
    def __init__(self, profiler: VisionProfiler, stage_name: str):
        self.profiler = profiler
        self.stage_name = stage_name
        self.start = 0.0

    def __enter__(self):
        self.start = time.perf_counter()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration_ms = (time.perf_counter() - self.start) * 1000.0
        self.profiler.record(self.stage_name, duration_ms)
