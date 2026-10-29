"""
Association metrics and bipartite matching for ByteTrack and BoT-SORT.
"""

from typing import List, Tuple
import numpy as np
from scipy.optimize import linear_sum_assignment


def bbox_ious(atlbrs: np.ndarray, btlbrs: np.ndarray) -> np.ndarray:
    """
    Compute pairwise IoU between two sets of bounding boxes in [tl_x, tl_y, br_x, br_y] format.
    """
    ious = np.zeros((len(atlbrs), len(btlbrs)), dtype=np.float32)
    if atlbrs.size == 0 or btlbrs.size == 0:
        return ious

    atlbrs = np.ascontiguousarray(atlbrs, dtype=np.float32)
    btlbrs = np.ascontiguousarray(btlbrs, dtype=np.float32)

    area_a = (atlbrs[:, 2] - atlbrs[:, 0]) * (atlbrs[:, 3] - atlbrs[:, 1])
    area_b = (btlbrs[:, 2] - btlbrs[:, 0]) * (btlbrs[:, 3] - btlbrs[:, 1])

    for i, a in enumerate(atlbrs):
        x1 = np.maximum(a[0], btlbrs[:, 0])
        y1 = np.maximum(a[1], btlbrs[:, 1])
        x2 = np.minimum(a[2], btlbrs[:, 2])
        y2 = np.minimum(a[3], btlbrs[:, 3])

        inter = np.maximum(0.0, x2 - x1) * np.maximum(0.0, y2 - y1)
        union = area_a[i] + area_b - inter
        ious[i] = np.where(union > 0, inter / union, 0.0)

    return ious


def iou_distance(atracks: list, btracks: list) -> np.ndarray:
    """
    Compute 1.0 - IoU distance matrix between tracks.
    """
    if (len(atracks) > 0 and isinstance(atracks[0], np.ndarray)) or (
        len(btracks) > 0 and isinstance(btracks[0], np.ndarray)
    ):
        atlbrs = atracks
        btlbrs = btracks
    else:
        atlbrs = [track.tlbr for track in atracks]
        btlbrs = [track.tlbr for track in btracks]

    ious = bbox_ious(np.asarray(atlbrs), np.asarray(btlbrs))
    return 1.0 - ious


def embedding_cosine_distance(atracks: list, btracks: list) -> np.ndarray:
    """
    Compute cosine distance matrix (1.0 - cosine_similarity) between track embeddings.
    """
    if len(atracks) == 0 or len(btracks) == 0:
        return np.empty((len(atracks), len(btracks)), dtype=np.float32)

    a_embs = np.asarray([t.smooth_feat if hasattr(t, "smooth_feat") and t.smooth_feat is not None else t.curr_feat for t in atracks])
    b_embs = np.asarray([t.curr_feat if hasattr(t, "curr_feat") and t.curr_feat is not None else t.smooth_feat for t in btracks])

    if a_embs.ndim == 1:
        a_embs = a_embs.reshape(1, -1)
    if b_embs.ndim == 1:
        b_embs = b_embs.reshape(1, -1)

    # Cosine distance = 1 - (A . B) / (|A| |B|)
    norm_a = np.linalg.norm(a_embs, axis=1, keepdims=True)
    norm_b = np.linalg.norm(b_embs, axis=1, keepdims=True)
    norm_a[norm_a == 0] = 1e-6
    norm_b[norm_b == 0] = 1e-6

    sim = np.dot(a_embs / norm_a, (b_embs / norm_b).T)
    dist = 1.0 - sim
    return np.clip(dist, 0.0, 2.0)


def linear_assignment(
    cost_matrix: np.ndarray, thresh: float
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Perform linear sum assignment (Hungarian matching) with a rejection threshold.

    Returns:
        matches: Array of shape (N, 2) with (row_idx, col_idx).
        unmatched_a: Indices of unmatched elements in A.
        unmatched_b: Indices of unmatched elements in B.
    """
    if cost_matrix.size == 0:
        return (
            np.empty((0, 2), dtype=int),
            np.arange(cost_matrix.shape[0], dtype=int),
            np.arange(cost_matrix.shape[1], dtype=int),
        )

    row_ind, col_ind = linear_sum_assignment(cost_matrix)

    matches = []
    unmatched_a = list(range(cost_matrix.shape[0]))
    unmatched_b = list(range(cost_matrix.shape[1]))

    for r, c in zip(row_ind, col_ind):
        if cost_matrix[r, c] <= thresh:
            matches.append([r, c])
            if r in unmatched_a:
                unmatched_a.remove(r)
            if c in unmatched_b:
                unmatched_b.remove(c)

    matches_arr = np.asarray(matches, dtype=int) if len(matches) > 0 else np.empty((0, 2), dtype=int)
    return matches_arr, np.asarray(unmatched_a, dtype=int), np.asarray(unmatched_b, dtype=int)
