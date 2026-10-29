"""
Cross-Camera Journey Reconstruction via Spatio-Temporal Directed Acyclic Graph (DAG) and Viterbi Search.

Builds a candidate graph where nodes represent candidate sightings across cameras,
and edges represent valid transitions weighted by appearance similarity and
camera topology transition plausibility S_camera.

Computes:
1. Optimal trajectory via Viterbi Dynamic Programming (maximizing sum of log likelihoods).
2. Top-3 alternative journeys via beam search / K-best path enumeration.
3. Agglomerative clustering on appearance embeddings with chronological ordering.
4. Transparent per-hop explanation records preserving all individual sub-scores.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple
import math
import numpy as np
from sklearn.cluster import AgglomerativeClustering

from .topology import CameraTopologyGraph


@dataclass
class CandidateSightingNode:
    sighting_id: str
    camera_id: str
    timestamp_sec: float
    reid_embedding: np.ndarray  # Decoupled 512-d Re-ID vector
    face_embedding: Optional[np.ndarray] = None  # Decoupled 512-d Face vector
    fusion_score: float = 0.5
    s_face: float = 0.0
    s_reid: float = 0.5
    s_temporal: float = 0.5
    s_camera: float = 1.0
    confidence_band: str = "medium"
    thumbnail_key: str = ""
    crop_key: str = ""
    display_label: str = "Possible match"


@dataclass
class JourneyHop:
    hop_index: int
    from_sighting_id: str
    to_sighting_id: str
    from_camera: str
    to_camera: str
    t1_sec: float
    t2_sec: float
    travel_time_sec: float
    appearance_similarity: float
    topology_plausibility: float
    hop_score: float
    confidence_band: str
    display_label: str = "Possible match"
    explanation: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "hop_index": self.hop_index,
            "from_sighting_id": self.from_sighting_id,
            "to_sighting_id": self.to_sighting_id,
            "from_camera": self.from_camera,
            "to_camera": self.to_camera,
            "t1_sec": self.t1_sec,
            "t2_sec": self.t2_sec,
            "travel_time_sec": self.travel_time_sec,
            "appearance_similarity": round(self.appearance_similarity, 4),
            "topology_plausibility": round(self.topology_plausibility, 4),
            "hop_score": round(self.hop_score, 4),
            "confidence_band": self.confidence_band,
            "display_label": self.display_label,
            "explanation": self.explanation,
        }


@dataclass
class ReconstructedJourney:
    journey_id: str
    rank: int
    cumulative_score: float
    sightings: List[CandidateSightingNode]
    hops: List[JourneyHop]
    total_travel_time_sec: float
    display_label: str = "Possible match"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "journey_id": self.journey_id,
            "rank": self.rank,
            "cumulative_score": round(self.cumulative_score, 4),
            "camera_sequence": [s.camera_id for s in self.sightings],
            "sighting_ids": [s.sighting_id for s in self.sightings],
            "hops": [h.to_dict() for h in self.hops],
            "total_travel_time_sec": round(self.total_travel_time_sec, 2),
            "display_label": self.display_label,
        }


class CrossCameraJourneyReconstructor:
    """
    Reconstructs person journeys across camera networks using spatio-temporal DAGs,
    Viterbi Dynamic Programming, and Agglomerative Clustering.
    """

    def __init__(
        self,
        topology_graph: Optional[CameraTopologyGraph] = None,
        min_appearance_sim: float = 0.35,
        min_topology_score: float = 0.05,
    ):
        self.topology = topology_graph or CameraTopologyGraph()
        self.min_appearance_sim = min_appearance_sim
        self.min_topology_score = min_topology_score

    def compute_appearance_similarity(
        self,
        node_a: CandidateSightingNode,
        node_b: CandidateSightingNode,
    ) -> float:
        """
        Cosine similarity between Re-ID appearance embeddings.
        If both have face embeddings, face similarity is evaluated as supplementary evidence.
        Feature spaces are strictly kept decoupled.
        """
        norm_a = np.linalg.norm(node_a.reid_embedding)
        norm_b = np.linalg.norm(node_b.reid_embedding)
        if norm_a == 0 or norm_b == 0:
            reid_sim = 0.0
        else:
            reid_sim = float(np.dot(node_a.reid_embedding / norm_a, node_b.reid_embedding / norm_b))

        # Optional face similarity check when both crops have usable faces
        if node_a.face_embedding is not None and node_b.face_embedding is not None:
            fnorm_a = np.linalg.norm(node_a.face_embedding)
            fnorm_b = np.linalg.norm(node_b.face_embedding)
            if fnorm_a > 0 and fnorm_b > 0:
                face_sim = float(np.dot(node_a.face_embedding / fnorm_a, node_b.face_embedding / fnorm_b))
                # Weighted combination of independent modalities (0.6 Re-ID, 0.4 Face)
                combined = 0.6 * max(0.0, reid_sim) + 0.4 * max(0.0, face_sim)
                return float(np.clip(combined, 0.0, 1.0))

        return float(np.clip(reid_sim, 0.0, 1.0))

    def reconstruct_journeys(
        self,
        sightings: List[CandidateSightingNode],
        top_k: int = 3,
    ) -> List[ReconstructedJourney]:
        """
        Finds the top-K most likely journeys across cameras using a Viterbi DAG pass.
        """
        if not sightings:
            return []

        # Sort chronologically
        nodes = sorted(sightings, key=lambda s: s.timestamp_sec)
        n = len(nodes)

        if n == 1:
            return [
                ReconstructedJourney(
                    journey_id="journey-opt-1",
                    rank=1,
                    cumulative_score=nodes[0].fusion_score,
                    sightings=nodes,
                    hops=[],
                    total_travel_time_sec=0.0,
                )
            ]

        # Build DAG adjacency and edge scores:
        # edge_weight = appearance_sim * s_camera * fusion_score_b
        # log_weight = log(edge_weight + 1e-6)
        dag_edges: Dict[int, List[Tuple[int, float, float, float]]] = {i: [] for i in range(n)}

        for i in range(n):
            for j in range(i + 1, n):
                dt = nodes[j].timestamp_sec - nodes[i].timestamp_sec
                if dt < 0:
                    continue

                # Spatio-temporal camera plausibility
                s_cam = self.topology.calculate_plausibility(
                    nodes[i].camera_id,
                    nodes[j].camera_id,
                    nodes[i].timestamp_sec,
                    nodes[j].timestamp_sec,
                )

                if s_cam < self.min_topology_score:
                    continue

                # Appearance similarity
                app_sim = self.compute_appearance_similarity(nodes[i], nodes[j])
                if app_sim < self.min_appearance_sim:
                    continue

                # Edge likelihood: product of appearance similarity, topology, and node confidence
                edge_score = (app_sim ** 1.5) * s_cam * (nodes[j].fusion_score ** 0.5)
                dag_edges[i].append((j, edge_score, app_sim, s_cam))

        # Beam search for top-K paths in DAG
        # Each beam state: (cumulative_log_score, [node_indices], [hops])
        beam_width = max(top_k * 4, 16)
        active_paths: List[Tuple[float, List[int], List[JourneyHop]]] = []

        # Initialize with each possible starting node
        for start_idx in range(n):
            init_score = math.log(max(1e-4, nodes[start_idx].fusion_score))
            active_paths.append((init_score, [start_idx], []))

        # Expand paths along chronological DAG
        completed_journeys: List[Tuple[float, List[int], List[JourneyHop]]] = []

        for _ in range(n):
            new_paths: List[Tuple[float, List[int], List[JourneyHop]]] = []
            for cum_score, path, hops in active_paths:
                curr = path[-1]
                outgoing = dag_edges.get(curr, [])

                if not outgoing:
                    if len(path) > 1:
                        completed_journeys.append((cum_score, path, hops))
                    continue

                for nxt, edge_score, app_sim, s_cam in outgoing:
                    log_s = math.log(max(1e-6, edge_score))
                    dt = nodes[nxt].timestamp_sec - nodes[curr].timestamp_sec

                    # Assign confidence band to hop
                    if edge_score >= 0.65:
                        band = "high"
                    elif edge_score >= 0.40:
                        band = "medium"
                    else:
                        band = "low"

                    hop = JourneyHop(
                        hop_index=len(hops) + 1,
                        from_sighting_id=nodes[curr].sighting_id,
                        to_sighting_id=nodes[nxt].sighting_id,
                        from_camera=nodes[curr].camera_id,
                        to_camera=nodes[nxt].camera_id,
                        t1_sec=nodes[curr].timestamp_sec,
                        t2_sec=nodes[nxt].timestamp_sec,
                        travel_time_sec=dt,
                        appearance_similarity=app_sim,
                        topology_plausibility=s_cam,
                        hop_score=edge_score,
                        confidence_band=band,
                        explanation={
                            "s_face": nodes[nxt].s_face,
                            "s_reid": nodes[nxt].s_reid,
                            "s_temporal": nodes[nxt].s_temporal,
                            "s_camera": s_cam,
                            "appearance_sim": round(app_sim, 4),
                            "fusion_score": nodes[nxt].fusion_score,
                            "display_label": "Possible match",
                        },
                    )

                    new_paths.append((cum_score + log_s, path + [nxt], hops + [hop]))

            if not new_paths:
                break

            # Prune to beam width (sort descending by cumulative log score)
            new_paths.sort(key=lambda x: x[0], reverse=True)
            active_paths = new_paths[:beam_width]

        # Collect all candidates
        all_candidates = completed_journeys + active_paths
        # Filter for journeys with at least 2 sightings if available
        multi_hop = [c for c in all_candidates if len(c[1]) >= 2]
        pool = multi_hop if multi_hop else all_candidates

        # Deduplicate paths by node tuple and rank by coverage and quality
        unique_journeys: Dict[Tuple[int, ...], Tuple[float, List[int], List[JourneyHop]]] = {}
        for score, path, hops in pool:
            key = tuple(path)
            # Length-normalized average log likelihood plus hop bonus
            n_hops = max(1, len(hops))
            avg_log_likelihood = score / n_hops
            # Rank score rewards both hop quality and journey span
            rank_metric = avg_log_likelihood + 0.5 * math.log(len(path))
            if key not in unique_journeys or rank_metric > unique_journeys[key][0]:
                unique_journeys[key] = (rank_metric, path, hops)

        sorted_unique = sorted(unique_journeys.values(), key=lambda x: x[0], reverse=True)
        top_paths = sorted_unique[:top_k]

        results: List[ReconstructedJourney] = []
        for rank, (score, path, hops) in enumerate(top_paths, start=1):
            path_nodes = [nodes[i] for i in path]
            total_dt = path_nodes[-1].timestamp_sec - path_nodes[0].timestamp_sec if len(path_nodes) > 1 else 0.0

            n_hops = max(1, len(hops))
            geometric_mean_prob = math.exp(min(0.0, sum([math.log(max(1e-4, h.hop_score)) for h in hops]) / n_hops)) if hops else path_nodes[0].fusion_score

            results.append(
                ReconstructedJourney(
                    journey_id=f"journey-opt-{rank}",
                    rank=rank,
                    cumulative_score=geometric_mean_prob,
                    sightings=path_nodes,
                    hops=hops,
                    total_travel_time_sec=total_dt,
                )
            )

        return results

    def cluster_sightings_by_appearance(
        self,
        sightings: List[CandidateSightingNode],
        distance_threshold: float = 0.40,
    ) -> List[List[CandidateSightingNode]]:
        """
        Agglomerative clustering on Re-ID appearance embeddings,
        with each cluster sorted chronologically.
        """
        if not sightings:
            return []
        if len(sightings) == 1:
            return [sightings]

        embs = np.stack([s.reid_embedding for s in sightings], axis=0)
        norm = np.linalg.norm(embs, axis=1, keepdims=True)
        norm[norm == 0] = 1e-6
        normalized = embs / norm

        # Distance matrix = 1 - cosine
        dist_matrix = np.clip(1.0 - np.dot(normalized, normalized.T), 0.0, 2.0)

        clustering = AgglomerativeClustering(
            n_clusters=None,
            metric="precomputed",
            linkage="average",
            distance_threshold=distance_threshold,
        )
        labels = clustering.fit_predict(dist_matrix)

        clusters: Dict[int, List[CandidateSightingNode]] = {}
        for label, sighting in zip(labels, sightings):
            if label not in clusters:
                clusters[label] = []
            clusters[label].append(sighting)

        # Sort each cluster chronologically
        sorted_clusters = [
            sorted(c, key=lambda s: s.timestamp_sec) for c in clusters.values()
        ]
        sorted_clusters.sort(key=lambda c: len(c), reverse=True)
        return sorted_clusters
