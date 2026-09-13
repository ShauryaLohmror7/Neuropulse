"""Serialise a real circuit (graph + morphology) into a browser bundle.

Layout:
  circuit.json  — provenance, node metadata, edges, per-neuron vertex ranges
  circuit.bin   — Float32Array, stride 4: [x, y, z, geodesic] per vertex

Coordinates are micrometres, translated so the circuit's bounding-box centre is
the scene origin.  The transform is recorded in the JSON so any point can be
mapped back to real MaleCNS dataset coordinates.
"""

from __future__ import annotations

import concurrent.futures as cf
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import orjson

from app.connectome.circuits import Circuit
from app.connectome.morphology import NeuronMorphology, build_morphology, prune_twigs
from app.connectome.provenance import Provenance
from app.connectome.queries import fetch_real_skeleton, voxel_size_nm

log = logging.getLogger(__name__)

NM_TO_UM = 1.0 / 1000.0

#: Strands shorter than this (micrometres of cable) are dropped from the render.
#: They are real, but at demo camera distances they are sub-pixel fuzz that costs
#: vertices without adding legible morphology. The full skeleton is untouched in
#: the cache; this only affects what is drawn.
MIN_STRAND_UM = 1.2


@dataclass
class RenderedNeuron:
    body_id: int
    morph: NeuronMorphology
    report: dict[str, Any]


def fetch_morphologies(
    body_ids: Iterable[int],
    *,
    simplify_epsilon_nm: float = 420.0,
    twig_prune_nm: float = 6000.0,
    workers: int = 8,
    max_vertices_each: int = 520,
) -> list[RenderedNeuron]:
    """Fetch and simplify real skeletons in parallel."""
    ids = [int(b) for b in body_ids]

    def one(b: int) -> RenderedNeuron | None:
        try:
            df, report = fetch_real_skeleton(b)
        except Exception as e:  # pragma: no cover - network
            log.warning("skeleton %d unavailable: %s", b, str(e)[:120])
            return None
        if df is None or len(df) < 4:
            return None
        raw_cable_nodes = len(df)
        # Adaptive pruning: the threshold scales with the neuron's own size, so a
        # small ORN is not reduced to a stick while a huge central neuron still
        # sheds its sub-pixel twigs.
        extent = float(
            np.linalg.norm(
                df[["x", "y", "z"]].to_numpy().max(axis=0)
                - df[["x", "y", "z"]].to_numpy().min(axis=0)
            )
        )
        eff_twig = float(np.clip(extent * 0.035, 1200.0, twig_prune_nm))
        df = prune_twigs(df, eff_twig)
        report["nodes_after_twig_prune"] = int(len(df))
        report["twig_prune_nm"] = round(eff_twig, 1)
        report["nodes_before_twig_prune"] = int(raw_cable_nodes)
        eps = simplify_epsilon_nm
        morph = build_morphology(b, df, simplify_epsilon_nm=eps)
        # Escalate simplification if a neuron is unusually large.
        while morph.total_vertices > max_vertices_each and eps < 12000:
            eps *= 1.7
            morph = build_morphology(b, df, simplify_epsilon_nm=eps)
        return RenderedNeuron(b, morph, report)

    out: list[RenderedNeuron] = []
    with cf.ThreadPoolExecutor(max_workers=workers) as ex:
        for i, r in enumerate(ex.map(one, ids)):
            if r is not None:
                out.append(r)
            if (i + 1) % 100 == 0:
                log.info("  skeletons %d/%d", i + 1, len(ids))
    return out


def write_bundle(
    out_dir: Path,
    name: str,
    circuit: Circuit,
    rendered: list[RenderedNeuron],
    provenance: Provenance,
    *,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)

    # ---- geometry --------------------------------------------------------
    all_pts = [p for r in rendered for p in r.morph.paths if len(p)]
    if all_pts:
        stacked = np.concatenate(all_pts)
        lo, hi = stacked.min(axis=0), stacked.max(axis=0)
        centre = (lo + hi) / 2.0
    else:
        centre = np.zeros(3, dtype=np.float32)
        lo = hi = centre

    chunks: list[np.ndarray] = []
    neurons: list[dict[str, Any]] = []
    cursor = 0
    for r in rendered:
        offsets = [0]
        buf: list[np.ndarray] = []
        for pts, dist in zip(r.morph.paths, r.morph.dists):
            if len(pts) < 2:
                continue
            q = (pts - centre) * NM_TO_UM
            span = float(np.linalg.norm(np.diff(q, axis=0), axis=1).sum())
            if span < MIN_STRAND_UM:
                continue
            d = (dist * NM_TO_UM).reshape(-1, 1)
            buf.append(np.hstack([q, d]).astype(np.float32))
            offsets.append(offsets[-1] + len(q))
        if len(offsets) < 2:
            continue
        arr = np.concatenate(buf)
        chunks.append(arr)
        neurons.append(
            {
                "bodyId": r.body_id,
                "start": cursor,
                "count": int(len(arr)),
                "pathOffsets": offsets,
                "maxGeodesic": round(float(arr[:, 3].max()), 2),
                "fragments": r.report.get("components", 1),
            }
        )
        cursor += len(arr)

    flat = (
        np.concatenate(chunks).astype(np.float32)
        if chunks
        else np.zeros((0, 4), dtype=np.float32)
    )
    bin_path = out_dir / f"{name}.bin"
    bin_path.write_bytes(flat.tobytes())

    # ---- somata ----------------------------------------------------------
    # Cell bodies sit in a rind on the surface of the neuropil. They are the
    # dominant visual texture in published renders of this connectome, and
    # somaLocation is real dataset metadata, so we carry it through.
    soma_xyz: list[float] = []
    soma_ids: list[int] = []
    for body_id, meta in circuit.nodes.items():
        loc = _soma_coords(meta.get("somaLocation"))
        if loc is None:
            continue
        try:
            # somaLocation is in voxel units like every other coordinate.
            p_nm = np.asarray(loc, dtype=np.float64) * voxel_size_nm()
        except (TypeError, ValueError):
            continue
        q = (p_nm - centre) * NM_TO_UM
        soma_xyz.extend(float(round(v, 2)) for v in q)
        soma_ids.append(int(body_id))

    # ---- graph -----------------------------------------------------------
    node_list: list[dict[str, Any]] = []
    for body_id, meta in circuit.nodes.items():
        node_list.append(
            {
                "bodyId": int(body_id),
                "hop": circuit.hop_of.get(int(body_id), -1),
                "type": meta.get("type"),
                "instance": meta.get("instance"),
                "class": meta.get("class"),
                "superclass": meta.get("superclass"),
                "side": meta.get("side") or meta.get("somaSide") or meta.get("rootSide"),
                "roi": meta.get("roi"),
                "nt": meta.get("predictedNt"),
                "ntConf": _round(meta.get("predictedNtConfidence"), 3),
                "pre": meta.get("pre"),
                "post": meta.get("post"),
            }
        )

    edges = circuit.edge_list()
    edge_src = np.array([e[0] for e in edges], dtype=np.int64)
    edge_tgt = np.array([e[1] for e in edges], dtype=np.int64)
    edge_w = np.array([e[2] for e in edges], dtype=np.float32)

    doc = {
        "provenance": provenance.model_dump(),
        "name": name,
        "transform": {
            "units": "micrometres",
            "origin_nm": [float(v) for v in centre],
            "scale_from_nm": NM_TO_UM,
            "bounds_nm": {"min": [float(v) for v in lo], "max": [float(v) for v in hi]},
        },
        "counts": {
            "graphNeurons": circuit.n_nodes,
            "graphEdges": circuit.n_edges,
            "renderedNeurons": len(neurons),
            "renderedVertices": int(len(flat)),
        },
        "seedSets": circuit.seed_sets,
        "policy": circuit.policy,
        "neurons": neurons,
        "somas": {"bodyIds": soma_ids, "positions": soma_xyz},
        "nodes": node_list,
        "edges": {
            "source": edge_src.tolist(),
            "target": edge_tgt.tolist(),
            "weight": edge_w.astype(np.int32).tolist(),
        },
        "extra": extra or {},
    }
    json_path = out_dir / f"{name}.json"
    json_path.write_bytes(orjson.dumps(doc))

    return {
        "json": str(json_path),
        "bin": str(bin_path),
        "json_kb": json_path.stat().st_size / 1024,
        "bin_kb": bin_path.stat().st_size / 1024,
        "rendered": len(neurons),
        "vertices": int(len(flat)),
    }


def _soma_coords(loc: Any) -> list[float] | None:
    """Extract [x, y, z] from a somaLocation value.

    neuPrint returns this as a Neo4j spatial point. Through ``fetch_neurons`` it
    arrives as a plain list, but through raw Cypher it is a dict of the form
    ``{"coordinates": [x, y, z], "crs": {...}}``. Handle both.
    """
    if isinstance(loc, dict):
        loc = loc.get("coordinates")
    if isinstance(loc, (list, tuple)) and len(loc) == 3:
        try:
            return [float(v) for v in loc]
        except (TypeError, ValueError):
            return None
    return None


def _round(v: Any, n: int) -> Any:
    try:
        return round(float(v), n)
    except (TypeError, ValueError):
        return None
