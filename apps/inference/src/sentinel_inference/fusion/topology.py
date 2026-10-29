"""
Camera Topology Graph and Spatio-Temporal Plausibility (S_camera).

Represents inter-camera travel constraints as a directed graph, calculates
transition plausibility between sightings using geographic priors (distance / walking speed),
log-normal/Gaussian travel windows, hard physical constraints (dt < distance / max_speed -> 0),
and enables online Bayesian/Welford learning of travel-time distributions from confirmed journeys.
Includes intelligent "Next cameras to search" ranking based on reachable radius, transition
probability, and optical heading alignment with the approaching pedestrian.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any
import math
import numpy as np


DEFAULT_WALKING_SPEED_MPS = 1.4  # Standard human walking speed (1.4 m/s ~ 5.0 km/h)
MAX_PLAUSIBLE_SPEED_MPS = 3.0    # Hard physical limit (3.0 m/s ~ 10.8 km/h sprinting)


def haversine_distance(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
    """
    Computes great-circle distance in meters between two coordinates.
    coord format: (longitude, latitude)
    """
    lng1, lat1 = coord1
    lng2, lat2 = coord2
    r = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    return float(2.0 * r * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a))))


def calculate_bearing(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
    """
    Calculates geographic bearing in degrees [0, 360) from coord1 (lng, lat) to coord2 (lng, lat).
    0 = North, 90 = East, 180 = South, 270 = West.
    """
    lng1, lat1 = math.radians(coord1[0]), math.radians(coord1[1])
    lng2, lat2 = math.radians(coord2[0]), math.radians(coord2[1])
    d_lng = lng2 - lng1
    x = math.sin(d_lng) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(d_lng)
    bearing_rad = math.atan2(x, y)
    bearing_deg = math.degrees(bearing_rad)
    return float((bearing_deg + 360.0) % 360.0)


@dataclass
class TopologyEdge:
    from_camera: str
    to_camera: str
    min_travel_sec: float
    max_travel_sec: float
    distance_meters: float = 100.0
    transition_prob: float = 1.0
    distribution_type: str = "lognormal"  # "lognormal" | "gaussian"
    sigma_lognormal: float = 0.35
    # Learned empirical parameters (Welford's algorithm)
    sample_count: int = 0
    mean_travel_sec: float = 0.0
    m2_travel_sec: float = 0.0  # Sum of squared differences from mean

    @property
    def expected_travel_sec(self) -> float:
        """Expected transit time from learned data or physical distance prior."""
        if self.sample_count >= 2 and self.mean_travel_sec > 0:
            return self.mean_travel_sec
        if self.distance_meters > 0:
            return self.distance_meters / DEFAULT_WALKING_SPEED_MPS
        return (self.min_travel_sec + self.max_travel_sec) / 2.0

    @property
    def min_physical_travel_sec(self) -> float:
        """Absolute minimum plausible transit time based on sprinting speed constraint."""
        if self.distance_meters > 0:
            return self.distance_meters / MAX_PLAUSIBLE_SPEED_MPS
        return max(0.5, self.min_travel_sec * 0.5)

    @property
    def variance_travel_sec(self) -> float:
        if self.sample_count < 2:
            span = max(1.0, self.max_travel_sec - self.min_travel_sec)
            return (span / 4.0) ** 2
        return self.m2_travel_sec / (self.sample_count - 1)

    @property
    def std_travel_sec(self) -> float:
        return math.sqrt(max(1.0, self.variance_travel_sec))


class CameraTopologyGraph:
    """
    Directed graph of surveillance cameras with geographic travel constraints,
    log-normal/Gaussian spatial-temporal plausibility (S_camera), and online Bayesian learning.
    """

    def __init__(self, same_camera_dwell_sec: float = 300.0):
        self.edges: Dict[Tuple[str, str], TopologyEdge] = {}
        self.adj_list: Dict[str, List[str]] = {}
        self.same_camera_dwell_sec = same_camera_dwell_sec

    def add_edge(
        self,
        from_camera: str,
        to_camera: str,
        min_travel_sec: float,
        max_travel_sec: float,
        distance_meters: Optional[float] = None,
        transition_prob: float = 1.0,
        distribution_type: str = "lognormal",
        bidirectional: bool = False,
    ) -> None:
        """Add a directed edge between two cameras."""
        expected_t = (float(min_travel_sec) + float(max_travel_sec)) / 2.0
        dist = float(distance_meters) if distance_meters is not None and distance_meters > 0 else (expected_t * DEFAULT_WALKING_SPEED_MPS)

        edge = TopologyEdge(
            from_camera=from_camera,
            to_camera=to_camera,
            min_travel_sec=float(min_travel_sec),
            max_travel_sec=float(max_travel_sec),
            distance_meters=dist,
            transition_prob=float(transition_prob),
            distribution_type=distribution_type,
            mean_travel_sec=expected_t,
        )
        self.edges[(from_camera, to_camera)] = edge
        if from_camera not in self.adj_list:
            self.adj_list[from_camera] = []
        if to_camera not in self.adj_list[from_camera]:
            self.adj_list[from_camera].append(to_camera)

        if bidirectional and from_camera != to_camera:
            self.add_edge(
                from_camera=to_camera,
                to_camera=from_camera,
                min_travel_sec=min_travel_sec,
                max_travel_sec=max_travel_sec,
                distance_meters=dist,
                transition_prob=transition_prob,
                distribution_type=distribution_type,
                bidirectional=False,
            )

    def get_edge(self, from_camera: str, to_camera: str) -> Optional[TopologyEdge]:
        return self.edges.get((from_camera, to_camera))

    def calculate_plausibility(
        self,
        from_camera: str,
        to_camera: str,
        t1_sec: float,
        t2_sec: float,
        distance_meters: Optional[float] = None,
    ) -> float:
        """
        Compute S_camera: plausibility in [0.0, 1.0] of moving from from_camera at t1
        to to_camera at t2.

        Geographic Constraints & Formulations:
        1. Time-order: If dt < 0, S_camera = 0.0
        2. Same camera: 1.0 within dwell window; exponential decay beyond.
        3. Hard Physical Sprinting Constraint:
           If dt < distance / max_plausible_speed (3.0 m/s), transition is physically
           impossible -> S_camera = 0.0.
        4. Distribution Window:
           - Expected travel time prior: distance_meters / 1.4 m/s.
           - Flat-top peak of 1.0 within [min_travel_sec, max_travel_sec].
           - Log-normal or Gaussian decay outside the window.
        """
        dt = t2_sec - t1_sec
        if dt < 0:
            return 0.0

        # Same camera observation
        if from_camera == to_camera:
            if dt <= self.same_camera_dwell_sec:
                return 1.0
            excess = dt - self.same_camera_dwell_sec
            decay = math.exp(-excess / self.same_camera_dwell_sec)
            return float(np.clip(decay, 0.0, 1.0))

        edge = self.get_edge(from_camera, to_camera)

        # Dynamic Prior Edge calculation if distance is provided but edge is unconfigured
        if edge is None:
            if distance_meters is not None and distance_meters > 0:
                expected = distance_meters / DEFAULT_WALKING_SPEED_MPS
                min_phys = distance_meters / MAX_PLAUSIBLE_SPEED_MPS
                if dt < min_phys:
                    return 0.0  # Hard physical sprinting constraint
                # Log-normal prior around expected time
                diff = math.log(max(0.1, dt)) - math.log(max(0.1, expected))
                score = math.exp(-0.5 * (diff / 0.35) ** 2)
                return float(np.clip(score, 0.0, 1.0))
            return 0.0

        # HARD PHYSICAL CONSTRAINT: Sprinting speed limit (3.0 m/s)
        effective_dist = distance_meters if distance_meters is not None and distance_meters > 0 else edge.distance_meters
        min_plausible_time = effective_dist / MAX_PLAUSIBLE_SPEED_MPS
        if dt < min_plausible_time:
            return 0.0  # Hard constraint: S_camera = 0 for superhuman sprint

        # Optimal window: peak plausibility
        if edge.min_travel_sec <= dt <= edge.max_travel_sec:
            return float(edge.transition_prob)

        # Log-Normal decay outside window
        if edge.distribution_type == "lognormal":
            expected = edge.expected_travel_sec
            if dt <= 0 or expected <= 0:
                return 0.0
            sigma = edge.sigma_lognormal
            if edge.sample_count >= 2 and edge.std_travel_sec > 0:
                rel_var = (edge.std_travel_sec / expected) ** 2
                sigma = max(0.15, min(0.75, math.sqrt(math.log(1.0 + rel_var))))

            diff = math.log(dt) - math.log(expected)
            score = edge.transition_prob * math.exp(-0.5 * (diff / sigma) ** 2)
            return float(np.clip(score, 0.0, 1.0))

        # Gaussian window decay
        sigma = max(2.0, edge.std_travel_sec)
        if dt < edge.min_travel_sec:
            delta = edge.min_travel_sec - dt
            score = edge.transition_prob * math.exp(-0.5 * (delta / (sigma * 0.5)) ** 2)
            return float(np.clip(score, 0.0, 1.0))

        delta = dt - edge.max_travel_sec
        score = edge.transition_prob * math.exp(-0.5 * (delta / sigma) ** 2)
        return float(np.clip(score, 0.0, 1.0))

    def update_from_verification(
        self,
        from_camera: str,
        to_camera: str,
        observed_travel_sec: float,
        distance_meters: Optional[float] = None,
    ) -> None:
        """
        Learn transition-time distributions from confirmed historical verifications
        using Welford's algorithm for numerically stable running mean and variance.
        """
        if from_camera == to_camera or observed_travel_sec <= 0:
            return

        edge = self.get_edge(from_camera, to_camera)
        dist = distance_meters if distance_meters is not None else 100.0

        if edge is None:
            # Create discovered transition edge with geographic default
            self.add_edge(
                from_camera=from_camera,
                to_camera=to_camera,
                min_travel_sec=max(1.0, observed_travel_sec * 0.6),
                max_travel_sec=observed_travel_sec * 1.5,
                distance_meters=dist,
            )
            edge = self.get_edge(from_camera, to_camera)

        assert edge is not None

        # Welford's algorithm for online variance & mean
        edge.sample_count += 1
        delta = observed_travel_sec - edge.mean_travel_sec
        edge.mean_travel_sec += delta / edge.sample_count
        delta2 = observed_travel_sec - edge.mean_travel_sec
        edge.m2_travel_sec += delta * delta2

        # Dynamically widen or tighten min/max bounds based on empirical data
        std = edge.std_travel_sec
        edge.min_travel_sec = max(edge.min_physical_travel_sec, edge.mean_travel_sec - 2.5 * std)
        edge.max_travel_sec = max(edge.min_travel_sec + 2.0, edge.mean_travel_sec + 2.5 * std)

    def rank_next_cameras(
        self,
        from_camera_id: str,
        from_coords: Tuple[float, float],  # (lng, lat)
        last_seen_sec: float,
        query_time_sec: float,
        camera_catalog: List[Dict[str, Any]],
        max_radius_meters: float = 3000.0,
    ) -> List[Dict[str, Any]]:
        """
        'Next cameras to search' ranking:
        Identifies cameras inside the reachable area at time t (radius = 1.4 m/s * elapsed_sec),
        ordered by learned transition probability and optical alignment (whether the camera
        faces the oncoming walking direction for optimal frontal capture).
        """
        elapsed_sec = max(1.0, query_time_sec - last_seen_sec)
        reachable_radius = min(max_radius_meters, DEFAULT_WALKING_SPEED_MPS * elapsed_sec * 1.25)

        ranked: List[Dict[str, Any]] = []

        for cam in camera_catalog:
            cam_id = cam.get("id") or cam.get("cameraId")
            if not cam_id or cam_id == from_camera_id:
                continue

            # Coordinates
            coords = cam.get("coordinates")
            if not coords and "location" in cam and isinstance(cam["location"], dict):
                coords = cam["location"].get("coordinates")
            if not coords or len(coords) < 2:
                continue

            target_coords = (float(coords[0]), float(coords[1]))
            dist_m = haversine_distance(from_coords, target_coords)

            # 1. Reachable area gate
            if dist_m > reachable_radius:
                continue

            # 2. Hard physical constraint
            if elapsed_sec < (dist_m / MAX_PLAUSIBLE_SPEED_MPS):
                continue  # Impossible sprint

            # 3. Travel time plausibility
            s_camera = self.calculate_plausibility(
                from_camera=from_camera_id,
                to_camera=cam_id,
                t1_sec=last_seen_sec,
                t2_sec=query_time_sec,
                distance_meters=dist_m,
            )

            # 4. Optical Direction Alignment
            # Bearing from origin camera to target camera
            approach_bearing = calculate_bearing(from_coords, target_coords)
            # A camera facing towards the approaching subject has optical heading pointing towards origin
            # i.e., ideal capture heading = approach_bearing + 180 degrees
            cam_heading = float(cam.get("headingDeg", 0.0))
            cam_fov = float(cam.get("fovDeg", 75.0))

            ideal_heading = (approach_bearing + 180.0) % 360.0
            angle_diff = abs((cam_heading - ideal_heading + 180.0) % 360.0 - 180.0)

            # Faces walking direction if optical field of view captures approaching subject
            faces_walking_direction = angle_diff <= (cam_fov / 2.0)
            alignment_factor = max(0.1, math.cos(math.radians(angle_diff / 2.0)))

            edge = self.get_edge(from_camera_id, cam_id)
            transition_prob = edge.transition_prob if edge else 0.5
            has_learned_edge = bool(edge and edge.sample_count > 0)

            # Combined ranking score
            # Prioritizes high transition prob + plausible travel time + frontal capture angle
            rank_score = (
                (0.40 * transition_prob)
                + (0.35 * s_camera)
                + (0.25 * (1.0 if faces_walking_direction else alignment_factor))
            )

            ranked.append({
                "cameraId": cam_id,
                "cameraName": cam.get("name", f"CCTV {cam_id}"),
                "locationName": cam.get("locationName", ""),
                "coordinates": target_coords,
                "distanceMeters": round(dist_m),
                "expectedArrivalSec": round(dist_m / DEFAULT_WALKING_SPEED_MPS),
                "sCameraPlausibility": round(s_camera, 3),
                "transitionProbability": round(transition_prob, 3),
                "facesWalkingDirection": faces_walking_direction,
                "approachBearingDeg": round(approach_bearing, 1),
                "cameraHeadingDeg": round(cam_heading, 1),
                "hasLearnedEdge": has_learned_edge,
                "rankScore": round(rank_score, 4),
            })

        # Sort descending by rankScore
        ranked.sort(key=lambda x: x["rankScore"], reverse=True)
        return ranked
