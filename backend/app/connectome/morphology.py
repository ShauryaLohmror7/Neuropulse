"""Turn real neuPrint skeletons into a compact, browser-friendly representation.

A neuPrint skeleton is a node table (``rowId, x, y, z, radius, link``) forming a
rooted tree.  For rendering we want *unbranched strands* ("paths"): a pulse can
then travel along a path as a simple 1-D parameter, and branch points are exactly
the places where paths meet.  We keep the real coordinates (dataset units,
nanometres) and only simplify by dropping nodes that lie close to the straight
line between their neighbours.

Nothing here invents geometry: every emitted vertex is a real skeleton node from
MaleCNS, we only *subsample* them.
"""

from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Iterable, Sequence

import numpy as np
import pandas as pd


@dataclass
class NeuronMorphology:
    """Compact morphology for one real neuron."""

    body_id: int
    paths: list[np.ndarray]  # each (N,3) float32, nanometres
    radii: list[np.ndarray]  # each (N,) float32, nanometres
    dists: list[np.ndarray] = field(default_factory=list)  # geodesic nm from root
    soma_position: tuple[float, float, float] | None = None
    node_count_original: int = 0
    node_count_kept: int = 0
    root_row: int | None = None
    meta: dict = field(default_factory=dict)

    @property
    def total_vertices(self) -> int:
        return sum(len(p) for p in self.paths)

    def bounds(self) -> tuple[np.ndarray, np.ndarray]:
        allp = np.concatenate(self.paths) if self.paths else np.zeros((1, 3), np.float32)
        return allp.min(axis=0), allp.max(axis=0)

    def cable_length(self) -> float:
        """Summed euclidean length of all strands, in dataset units (nm)."""
        total = 0.0
        for p in self.paths:
            if len(p) > 1:
                total += float(np.linalg.norm(np.diff(p, axis=0), axis=1).sum())
        return total


def prune_twigs(df: pd.DataFrame, threshold_nm: float) -> pd.DataFrame:
    """Iteratively remove terminal branches shorter than ``threshold_nm``.

    EM skeletons carry a large number of very short distal twigs.  They are real,
    but at demo camera distances they are sub-pixel noise that dominates the
    vertex budget (RDP cannot reduce a two-node strand any further, so twig
    *count* — not node spacing — is what drives geometry size).

    Pruning removes whole terminal branches; it never moves or invents a node, and
    the backbone and overall arbor shape are preserved. The unpruned skeleton
    stays in the cache. Analogous to ``navis.prune_twigs``.
    """
    if threshold_nm <= 0 or len(df) < 3:
        return df

    df = df.copy()
    xyz = df[["x", "y", "z"]].to_numpy(dtype=np.float64)
    rows = df["rowId"].to_numpy()
    links = df["link"].to_numpy()
    row_to_idx = {int(r): i for i, r in enumerate(rows)}

    children: dict[int, list[int]] = defaultdict(list)
    for r, l in zip(rows, links):
        if int(l) != -1 and int(l) in row_to_idx:
            children[int(l)].append(int(r))

    alive = {int(r) for r in rows}
    changed = True
    while changed:
        changed = False
        # Current leaves: alive nodes with no alive children.
        live_children = {
            p: [c for c in kids if c in alive] for p, kids in children.items()
        }
        leaves = [r for r in alive if not live_children.get(r)]
        for leaf in leaves:
            # Walk up to the nearest branch point or root, measuring cable.
            seg = [leaf]
            length = 0.0
            cur = leaf
            while True:
                parent = int(links[row_to_idx[cur]])
                if parent == -1 or parent not in alive:
                    break
                length += float(np.linalg.norm(xyz[row_to_idx[cur]] - xyz[row_to_idx[parent]]))
                sibs = [c for c in live_children.get(parent, []) if c in alive]
                if len(sibs) > 1:  # parent is a branch point -> stop
                    break
                if int(links[row_to_idx[parent]]) == -1:  # reached root
                    break
                seg.append(parent)
                cur = parent
            if length < threshold_nm and len(alive) - len(seg) > 8:
                alive.difference_update(seg)
                changed = True

    out = df[df["rowId"].isin(alive)].copy()
    out.loc[~out["link"].isin(alive), "link"] = -1
    return out


def _build_adjacency(df: pd.DataFrame) -> tuple[dict[int, list[int]], int | None]:
    """Undirected adjacency plus the root row id (``link == -1``)."""
    children: dict[int, list[int]] = defaultdict(list)
    root: int | None = None
    for row, link in zip(df["rowId"].to_numpy(), df["link"].to_numpy()):
        if link == -1 or link not in df.index:
            if root is None:
                root = int(row)
            continue
        children[int(link)].append(int(row))
    return children, root


def _geodesic_distances(
    xyz: np.ndarray,
    children: dict[int, list[int]],
    root_row: int,
    row_to_idx: dict[int, int],
) -> np.ndarray:
    """Cable distance from the skeleton root to every node, in nanometres.

    This is what lets the renderer send a wavefront *along* the real arbor: a
    node at distance d ignites when the front reaches d.
    """
    dist = np.zeros(len(xyz), dtype=np.float32)
    stack = [root_row]
    seen = {root_row}
    while stack:
        cur = stack.pop()
        ci = row_to_idx.get(cur)
        if ci is None:
            continue
        for kid in children.get(cur, []):
            if kid in seen:
                continue
            seen.add(kid)
            ki = row_to_idx.get(kid)
            if ki is None:
                continue
            dist[ki] = dist[ci] + float(np.linalg.norm(xyz[ki] - xyz[ci]))
            stack.append(kid)
    return dist


def skeleton_to_paths(
    df: pd.DataFrame,
    *,
    simplify_epsilon_nm: float = 180.0,
    min_path_nodes: int = 2,
) -> tuple[list[np.ndarray], list[np.ndarray], list[np.ndarray], int | None]:
    """Decompose a skeleton node table into unbranched strands.

    Parameters
    ----------
    df:
        Skeleton table as returned by :func:`neuprint.fetch_skeleton` (healed).
    simplify_epsilon_nm:
        Ramer-Douglas-Peucker tolerance.  MaleCNS skeleton nodes are spaced on
        the order of tens of nanometres; ~180 nm removes a large fraction of
        collinear nodes without visibly changing morphology.
    """
    df = df.copy()
    df = df.set_index("rowId", drop=False)
    children, root = _build_adjacency(df)

    xyz = df[["x", "y", "z"]].to_numpy(dtype=np.float32)
    radius = df["radius"].to_numpy(dtype=np.float32) if "radius" in df else np.zeros(len(df), np.float32)
    row_to_idx = {int(r): i for i, r in enumerate(df["rowId"].to_numpy())}

    if root is None:
        root = int(df["rowId"].iloc[0])

    dist_all = _geodesic_distances(xyz, children, root, row_to_idx)

    paths: list[list[int]] = []
    # Iterative DFS: walk down from each branch/root until the next branch or leaf.
    stack: list[int] = [root]
    while stack:
        start = stack.pop()
        for first in children.get(start, []):
            strand = [start, first]
            cur = first
            while True:
                kids = children.get(cur, [])
                if len(kids) == 1:
                    cur = kids[0]
                    strand.append(cur)
                else:
                    if len(kids) > 1:
                        stack.append(cur)
                    break
            paths.append(strand)

    out_pts: list[np.ndarray] = []
    out_rad: list[np.ndarray] = []
    out_dist: list[np.ndarray] = []
    for strand in paths:
        idx = np.fromiter((row_to_idx[r] for r in strand if r in row_to_idx), dtype=np.int64)
        if len(idx) < min_path_nodes:
            continue
        pts = xyz[idx]
        keep = _rdp_mask(pts, simplify_epsilon_nm)
        out_pts.append(np.ascontiguousarray(pts[keep], dtype=np.float32))
        out_rad.append(np.ascontiguousarray(radius[idx][keep], dtype=np.float32))
        out_dist.append(np.ascontiguousarray(dist_all[idx][keep], dtype=np.float32))
    return out_pts, out_rad, out_dist, root


def _rdp_mask(points: np.ndarray, epsilon: float) -> np.ndarray:
    """Ramer-Douglas-Peucker keep-mask (iterative, no recursion limits)."""
    n = len(points)
    keep = np.zeros(n, dtype=bool)
    if n == 0:
        return keep
    keep[0] = keep[-1] = True
    if n <= 2 or epsilon <= 0:
        keep[:] = True
        return keep

    stack = [(0, n - 1)]
    while stack:
        lo, hi = stack.pop()
        if hi <= lo + 1:
            continue
        a, b = points[lo], points[hi]
        ab = b - a
        norm = float(np.linalg.norm(ab))
        seg = points[lo + 1 : hi] - a
        if norm < 1e-6:
            dist = np.linalg.norm(seg, axis=1)
        else:
            dist = np.linalg.norm(np.cross(seg, ab / norm), axis=1)
        k = int(np.argmax(dist))
        if float(dist[k]) > epsilon:
            split = lo + 1 + k
            keep[split] = True
            stack.append((lo, split))
            stack.append((split, hi))
    return keep


def build_morphology(
    body_id: int,
    skeleton_df: pd.DataFrame,
    *,
    simplify_epsilon_nm: float = 180.0,
    soma_position: tuple[float, float, float] | None = None,
    meta: dict | None = None,
) -> NeuronMorphology:
    paths, radii, dists, root = skeleton_to_paths(
        skeleton_df, simplify_epsilon_nm=simplify_epsilon_nm
    )
    morph = NeuronMorphology(
        body_id=int(body_id),
        paths=paths,
        radii=radii,
        dists=dists,
        soma_position=soma_position,
        node_count_original=int(len(skeleton_df)),
        node_count_kept=sum(len(p) for p in paths),
        root_row=root,
        meta=meta or {},
    )
    return morph


def morphology_to_payload(
    morph: NeuronMorphology,
    *,
    scale: float = 1.0,
    origin: Sequence[float] = (0.0, 0.0, 0.0),
    decimals: int = 3,
) -> dict:
    """JSON-serialisable payload: flat vertex list + per-path offsets.

    Coordinates are ``(real_nm - origin) * scale`` so the browser can work in a
    convenient unit while the transform back to dataset space stays explicit.
    """
    origin_arr = np.asarray(origin, dtype=np.float32)
    verts: list[float] = []
    offsets: list[int] = [0]
    radii: list[float] = []
    dists: list[float] = []
    for i, (p, r) in enumerate(zip(morph.paths, morph.radii)):
        q = (p - origin_arr) * scale
        verts.extend(np.round(q, decimals).ravel().tolist())
        radii.extend(np.round(r * scale, decimals).tolist())
        if i < len(morph.dists):
            dists.extend(np.round(morph.dists[i] * scale, decimals).tolist())
        offsets.append(len(verts) // 3)
    return {
        "bodyId": morph.body_id,
        "vertices": verts,
        "pathOffsets": offsets,
        "radii": radii,
        "geodesic": dists,
        "somaPosition": (
            ((np.asarray(morph.soma_position, np.float32) - origin_arr) * scale).round(decimals).tolist()
            if morph.soma_position is not None
            else None
        ),
        "stats": {
            "pathCount": len(morph.paths),
            "vertexCount": morph.total_vertices,
            "originalNodeCount": morph.node_count_original,
            "cableLengthNm": round(morph.cable_length(), 1),
            "maxGeodesic": round(float(max((float(d.max()) for d in morph.dists if len(d)), default=0.0)) * scale, 3),
        },
        "transform": {
            "units": "dataset nanometres -> scene units",
            "origin_nm": [float(v) for v in origin_arr],
            "scale": scale,
        },
        "meta": morph.meta,
    }


def combined_bounds(morphs: Iterable[NeuronMorphology]) -> tuple[np.ndarray, np.ndarray]:
    lo = np.full(3, math.inf, dtype=np.float64)
    hi = np.full(3, -math.inf, dtype=np.float64)
    for m in morphs:
        a, b = m.bounds()
        lo = np.minimum(lo, a)
        hi = np.maximum(hi, b)
    return lo, hi
