"""Typed queries against the MaleCNS v1.0 dataset.

Design notes
------------
* We never fetch the whole brain.  Circuit extraction walks downstream from a
  seed population with a synaptic-weight floor, a per-neuron fan-out cap and a
  hop limit, which keeps subgraphs in the hundreds-to-low-thousands of neurons.
* Property names differ between neuPrint datasets.  Rather than hard-coding a
  schema we introspect ``fetch_neuron_keys()`` once and select the keys that
  actually exist in MaleCNS.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Iterable, Sequence

import pandas as pd
from neuprint import (Client, fetch_custom, fetch_meta, fetch_neurons, fetch_skeleton,
                      heal_skeleton)
from neuprint import NeuronCriteria as NC

from app.connectome.client import get_client

log = logging.getLogger(__name__)

#: Neuron properties we would like, in preference order. Filtered against the
#: dataset's real key list at runtime.
WANTED_KEYS = [
    "bodyId",
    "type",
    "instance",
    "status",
    "statusLabel",
    "class",
    "subclass",
    "superclass",
    "group",
    "serial",
    "hemilineage",
    "somaSide",
    "side",
    "rootSide",
    "entryNerve",
    "exitNerve",
    "predictedNt",
    "predictedNtConfidence",
    "consensusNt",
    "celltypePredictedNt",
    "ntUnknownProb",
    "ntAcetylcholineProb",
    "ntGabaProb",
    "ntGlutamateProb",
    "ntSerotoninProb",
    "ntOctopamineProb",
    "ntDopamineProb",
    "somaLocation",
    "soma",
    "size",
    "pre",
    "post",
    "synweight",
    "roiInfo",
    "cellBodyFiber",
    "flow",
    "birthtime",
    "dimorphism",
]


@lru_cache(maxsize=1)
def neuron_keys() -> tuple[str, ...]:
    """The neuron property keys this dataset actually exposes."""
    c = get_client()
    try:
        return tuple(c.fetch_neuron_keys())
    except Exception as e:  # pragma: no cover - network
        log.warning("fetch_neuron_keys failed (%s); falling back to a minimal key set", e)
        return ("bodyId", "type", "instance", "status")


@lru_cache(maxsize=1)
def available_keys() -> tuple[str, ...]:
    have = set(neuron_keys())
    return tuple(k for k in WANTED_KEYS if k in have or k == "bodyId")


def fetch_neuron_metadata(body_ids: Sequence[int]) -> pd.DataFrame:
    """Full metadata rows for specific real neurons."""
    if not len(body_ids):
        return pd.DataFrame()
    neurons, _roi = fetch_neurons(NC(bodyId=list(body_ids)), client=get_client())
    return neurons


def search_neurons(
    *,
    type_regex: str | None = None,
    instance_regex: str | None = None,
    cell_class: str | list[str] | None = None,
    rois: list[str] | None = None,
    status: str | list[str] | None = None,
    limit: int | None = None,
) -> pd.DataFrame:
    """Find real neurons by annotation."""
    kwargs: dict[str, Any] = {}
    if type_regex:
        kwargs["type"] = type_regex
        kwargs["regex"] = True
    if instance_regex:
        kwargs["instance"] = instance_regex
        kwargs["regex"] = True
    if cell_class is not None and "class" in neuron_keys():
        kwargs["class"] = cell_class
    if rois:
        kwargs["rois"] = rois
    if status is not None:
        kwargs["status"] = status
    neurons, _ = fetch_neurons(NC(**kwargs), client=get_client())
    if limit is not None and len(neurons) > limit:
        sort_col = "synweight" if "synweight" in neurons.columns else (
            "pre" if "pre" in neurons.columns else "bodyId"
        )
        neurons = neurons.sort_values(sort_col, ascending=False).head(limit)
    return neurons.reset_index(drop=True)


def search_neurons_by_property(prop: str, values: list[str], limit: int | None = None) -> pd.DataFrame:
    """Search on an arbitrary (existing) neuron property via Cypher."""
    if prop not in neuron_keys():
        return pd.DataFrame()
    cols = [k for k in available_keys()]
    ret = ", ".join(f"n.`{k}` AS `{k}`" for k in cols)
    q = f"""
        MATCH (n:Neuron)
        WHERE n.`{prop}` IN {values!r}
        RETURN {ret}
        {'LIMIT ' + str(limit) if limit else ''}
    """
    return fetch_custom(q, client=get_client())


def fetch_connections(
    source_ids: Sequence[int],
    *,
    min_weight: int = 5,
    max_per_source: int = 24,
    direction: str = "downstream",
) -> pd.DataFrame:
    """Strongest connections out of (or into) a set of real neurons.

    Returns columns ``[source, target, weight]`` plus target annotations.
    Uses a per-source ``ORDER BY weight DESC / LIMIT`` in Cypher so we never
    transfer a full fan-out.
    """
    if not len(source_ids):
        return pd.DataFrame(columns=["source", "target", "weight"])

    ids = [int(b) for b in source_ids]
    keys = [k for k in available_keys() if k != "bodyId"]
    ret_keys = ", ".join(f"m.`{k}` AS `{k}`" for k in keys)
    if direction == "downstream":
        pattern = "(n:Neuron)-[w:ConnectsTo]->(m:Neuron)"
        src, dst = "n", "m"
    else:
        pattern = "(m:Neuron)-[w:ConnectsTo]->(n:Neuron)"
        src, dst = "m", "n"

    q = f"""
        MATCH {pattern}
        WHERE n.bodyId IN {ids!r} AND w.weight >= {int(min_weight)}
        WITH n, m, w
        ORDER BY w.weight DESC
        WITH n, collect({{m: m, w: w.weight}})[0..{int(max_per_source)}] AS top
        UNWIND top AS t
        WITH n, t.m AS m, t.w AS weight
        RETURN {src}.bodyId AS source, {dst}.bodyId AS target, weight, {ret_keys}
    """
    df = fetch_custom(q, client=get_client())
    return df


def fetch_connection_weights(pairs_source: Sequence[int], pairs_target: Sequence[int],
                             min_weight: int = 1) -> pd.DataFrame:
    """All edges among two id sets (used to close the graph after expansion)."""
    if not len(pairs_source) or not len(pairs_target):
        return pd.DataFrame(columns=["source", "target", "weight"])
    q = f"""
        MATCH (n:Neuron)-[w:ConnectsTo]->(m:Neuron)
        WHERE n.bodyId IN {[int(i) for i in pairs_source]!r}
          AND m.bodyId IN {[int(i) for i in pairs_target]!r}
          AND w.weight >= {int(min_weight)}
        RETURN n.bodyId AS source, m.bodyId AS target, w.weight AS weight
    """
    return fetch_custom(q, client=get_client())


@lru_cache(maxsize=1)
def primary_roi_set() -> frozenset[str]:
    """The dataset's primary neuropils — the level we report 'regions reached' at."""
    return frozenset(get_client().primary_rois)


def dominant_roi(roi_info: Any) -> str | None:
    """The primary neuropil where a neuron has most of its synapses.

    ``roiInfo`` is the real per-ROI synapse tally neuPrint stores on each neuron.
    We restrict to primary ROIs so the reported region is a named neuropil rather
    than a super-level container like 'CentralBrain'.
    """
    if not roi_info:
        return None
    if isinstance(roi_info, str):
        try:
            roi_info = json.loads(roi_info)
        except (ValueError, TypeError):
            return None
    if not isinstance(roi_info, dict):
        return None
    primary = primary_roi_set()
    best: tuple[str, int] | None = None
    for roi, counts in roi_info.items():
        if roi not in primary or not isinstance(counts, dict):
            continue
        total = int(counts.get("pre", 0) or 0) + int(counts.get("post", 0) or 0)
        if best is None or total > best[1]:
            best = (roi, total)
    return best[0] if best else None


@lru_cache(maxsize=1)
def voxel_size_nm() -> float:
    """Isotropic voxel edge length of this dataset, in nanometres.

    MaleCNS skeleton coordinates are expressed in *voxel* units; neuPrint reports
    the voxel size in ``:Meta`` (8 nm for MaleCNS v1.0).  We convert once, here,
    so every coordinate downstream of this module is in true nanometres.
    """
    meta = fetch_meta(client=get_client())
    vs = meta.get("voxelSize") or [8, 8, 8]
    units = str(meta.get("voxelUnits", "nanometers")).lower()
    factor = 1.0 if units.startswith("nano") else 1000.0  # micrometers -> nm
    return float(vs[0]) * factor


def fetch_real_skeleton(
    body_id: int, *, heal: bool = False, to_nm: bool = True
) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Real skeleton node table for one neuron, plus a fragmentation report.

    Coordinates are returned in nanometres (converted from the dataset's voxel
    units using the voxel size the server reports).

    neuPrint skeletons are occasionally delivered as several disconnected
    fragments.  ``heal_skeleton`` would stitch those together with *synthetic*
    straight segments — geometry that does not exist in the reconstruction.
    NEUROPULSE therefore defaults to ``heal=False`` and keeps only the largest
    connected component, reporting what was dropped.  Nothing drawn on screen is
    ever invented.
    """
    df = fetch_skeleton(int(body_id), heal=False, format="pandas", client=get_client())
    report = _component_report(df)
    if heal:
        df = heal_skeleton(df)
        report["strategy"] = "healed (synthetic links added by neuprint.heal_skeleton)"
    else:
        df = _largest_component(df)
        report["strategy"] = "largest connected component only; no synthetic links"
        report["nodes_kept"] = int(len(df))
    if to_nm:
        vs = voxel_size_nm()
        for col in ("x", "y", "z", "radius"):
            if col in df.columns:
                df[col] = df[col].astype("float32") * vs
    return df, report


def _component_report(df: pd.DataFrame) -> dict[str, Any]:
    comps = _components(df)
    sizes = sorted((len(c) for c in comps), reverse=True)
    return {
        "nodes_total": int(len(df)),
        "components": len(sizes),
        "component_sizes": sizes[:8],
        "largest_fraction": round(sizes[0] / len(df), 4) if sizes and len(df) else 0.0,
    }


def _components(df: pd.DataFrame) -> list[set[int]]:
    import networkx as nx

    g = nx.Graph()
    g.add_nodes_from(int(r) for r in df["rowId"])
    for r, link in zip(df["rowId"], df["link"]):
        if int(link) != -1:
            g.add_edge(int(r), int(link))
    return list(nx.connected_components(g))


def _largest_component(df: pd.DataFrame) -> pd.DataFrame:
    comps = _components(df)
    if len(comps) <= 1:
        return df
    keep = max(comps, key=len)
    out = df[df["rowId"].isin(keep)].copy()
    # Re-root: any node whose parent fell outside the kept component becomes a root.
    out.loc[~out["link"].isin(keep), "link"] = -1
    return out


def fetch_roi_mesh_bytes(roi: str) -> bytes:
    """Real ROI surface mesh (OBJ bytes) from neuPrint, if the dataset has one."""
    return get_client().fetch_roi_mesh(roi, export_path=None)


@dataclass
class RoiHierarchyNode:
    name: str
    children: list["RoiHierarchyNode"]


def primary_rois() -> list[str]:
    return list(get_client().primary_rois)


def all_rois() -> list[str]:
    return list(get_client().all_rois)
