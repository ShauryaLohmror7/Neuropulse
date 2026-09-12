"""Extract real sensory circuits from MaleCNS by bounded downstream expansion.

We never pull the whole brain.  Starting from a real sensory population we walk
downstream a few synapses at a time, keeping only connections above a synapse
count floor, capping each neuron's fan-out, and capping how many new neurons may
enter per hop (strongest total input first).  The result is a subgraph in the
low thousands of neurons — enough for a spectacular cascade, small enough for a
browser.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Iterable, Sequence

import numpy as np
import pandas as pd
from neuprint import fetch_custom

from app.connectome.client import get_client
from app.connectome.queries import available_keys

log = logging.getLogger(__name__)


@dataclass
class ExpansionPolicy:
    """Bounds that keep a circuit tractable. All are modelling choices."""

    hops: int = 4
    min_weight_first: int = 5
    min_weight_deep: int = 10
    fanout_first: int = 12
    fanout_deep: int = 7
    max_new_per_hop: int = 700
    max_nodes: int = 4200

    def min_weight(self, hop: int) -> int:
        return self.min_weight_first if hop == 1 else self.min_weight_deep

    def fanout(self, hop: int) -> int:
        return self.fanout_first if hop == 1 else self.fanout_deep


@dataclass
class Circuit:
    """A real connectome subgraph plus the metadata needed to explain it."""

    nodes: dict[int, dict[str, Any]] = field(default_factory=dict)
    edges: dict[tuple[int, int], int] = field(default_factory=dict)
    hop_of: dict[int, int] = field(default_factory=dict)
    seed_sets: dict[str, list[int]] = field(default_factory=dict)
    policy: dict[str, Any] = field(default_factory=dict)

    @property
    def n_nodes(self) -> int:
        return len(self.nodes)

    @property
    def n_edges(self) -> int:
        return len(self.edges)

    def edge_list(self) -> list[tuple[int, int, float]]:
        return [(s, t, float(w)) for (s, t), w in self.edges.items()]


def _batch(seq: Sequence[int], size: int) -> Iterable[list[int]]:
    for i in range(0, len(seq), size):
        yield list(seq[i : i + size])


def _fetch_downstream(
    ids: Sequence[int], *, min_weight: int, fanout: int, batch_size: int = 400
) -> pd.DataFrame:
    """Strongest downstream edges for a batch of neurons, with metadata on targets."""
    keys = [k for k in available_keys() if k != "bodyId"]
    ret = ", ".join(f"m.`{k}` AS `{k}`" for k in keys)
    frames: list[pd.DataFrame] = []
    for chunk in _batch(list(ids), batch_size):
        q = f"""
            MATCH (n:Neuron)-[w:ConnectsTo]->(m:Neuron)
            WHERE n.bodyId IN {chunk!r} AND w.weight >= {int(min_weight)}
            WITH n, m, w.weight AS weight
            ORDER BY weight DESC
            WITH n, collect({{m: m, w: weight}})[0..{int(fanout)}] AS top
            UNWIND top AS t
            WITH n.bodyId AS source, t.m AS m, t.w AS weight
            RETURN source, m.bodyId AS target, weight,
                   coalesce(m.somaSide, m.rootSide) AS side, {ret}
        """
        frames.append(fetch_custom(q, client=get_client()))
    if not frames:
        return pd.DataFrame()
    return pd.concat(frames, ignore_index=True)


def _row_meta(row: pd.Series) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in row.items():
        if k in ("source", "target", "weight"):
            continue
        if v is None:
            continue
        if isinstance(v, float) and np.isnan(v):
            continue
        out[k] = v.item() if hasattr(v, "item") else v
    return out


def expand_circuit(
    seed_frames: dict[str, pd.DataFrame],
    policy: ExpansionPolicy = ExpansionPolicy(),
) -> Circuit:
    """Grow a circuit downstream from one or more real seed populations.

    ``seed_frames`` maps a stream label (e.g. ``"visual_looming:L"``) to the
    neuron metadata frame for that population.
    """
    circuit = Circuit(policy=policy.__dict__.copy())

    frontier: set[int] = set()
    for label, df in seed_frames.items():
        ids = [int(b) for b in df["bodyId"]]
        circuit.seed_sets[label] = ids
        for _, row in df.iterrows():
            b = int(row["bodyId"])
            circuit.nodes.setdefault(b, _row_meta(row))
            circuit.hop_of.setdefault(b, 0)
        frontier.update(ids)

    log.info("seeded %d neurons across %d streams", len(frontier), len(seed_frames))

    for hop in range(1, policy.hops + 1):
        if not frontier or len(circuit.nodes) >= policy.max_nodes:
            break
        df = _fetch_downstream(
            sorted(frontier), min_weight=policy.min_weight(hop), fanout=policy.fanout(hop)
        )
        if df.empty:
            break

        # Rank candidate new neurons by how much total input they receive from
        # the current frontier — the ones the signal actually converges on.
        incoming: dict[int, float] = defaultdict(float)
        for t, w in zip(df["target"], df["weight"]):
            t = int(t)
            if t not in circuit.nodes:
                incoming[t] += float(w)
        admitted = set(
            b for b, _ in sorted(incoming.items(), key=lambda kv: -kv[1])[: policy.max_new_per_hop]
        )
        room = policy.max_nodes - len(circuit.nodes)
        if len(admitted) > room:
            admitted = set(list(admitted)[:room])

        new_frontier: set[int] = set()
        for _, row in df.iterrows():
            s, t, w = int(row["source"]), int(row["target"]), int(row["weight"])
            if t not in circuit.nodes and t not in admitted:
                continue
            if t not in circuit.nodes:
                circuit.nodes[t] = _row_meta(row)
                circuit.hop_of[t] = hop
                new_frontier.add(t)
            key = (s, t)
            if w > circuit.edges.get(key, 0):
                circuit.edges[key] = w

        log.info("hop %d: +%d neurons (%d total), %d edges",
                 hop, len(new_frontier), len(circuit.nodes), len(circuit.edges))
        frontier = new_frontier

    _close_graph(circuit, min_weight=policy.min_weight_deep)
    return circuit


def attach_output_neurons(
    circuit: Circuit, cell_types: Sequence[str], *, min_weight: int = 3
) -> int:
    """Guarantee named output neurons are in the circuit if the signal can reach them.

    Bounded expansion ranks candidates by input weight, so a small but decisive
    population (the Giant Fibre is a single neuron per side) can be crowded out by
    bulk interneurons. Behavioural readout depends on these specific cells, so we
    add any of them that genuinely receive connections from neurons already in the
    circuit. The edges added are real measured connections — we are choosing what
    to *look at*, not inventing connectivity.
    """
    if not cell_types:
        return 0
    ids = sorted(circuit.nodes)
    keys = [k for k in available_keys() if k != "bodyId"]
    ret = ", ".join(f"m.`{k}` AS `{k}`" for k in keys)
    added_nodes = 0
    for chunk in _batch(ids, 900):
        q = f"""
            MATCH (n:Neuron)-[w:ConnectsTo]->(m:Neuron)
            WHERE n.bodyId IN {chunk!r} AND m.type IN {list(cell_types)!r}
              AND w.weight >= {int(min_weight)}
            RETURN n.bodyId AS source, m.bodyId AS target, w.weight AS weight,
                   coalesce(m.somaSide, m.rootSide) AS side, {ret}
        """
        df = fetch_custom(q, client=get_client())
        if df.empty:
            continue
        for _, row in df.iterrows():
            s_id, t_id, w = int(row["source"]), int(row["target"]), int(row["weight"])
            if t_id not in circuit.nodes:
                circuit.nodes[t_id] = _row_meta(row)
                circuit.hop_of[t_id] = circuit.hop_of.get(s_id, 0) + 1
                added_nodes += 1
            key = (s_id, t_id)
            if w > circuit.edges.get(key, 0):
                circuit.edges[key] = w
    log.info("attached %d named output neurons", added_nodes)
    return added_nodes


def _close_graph(circuit: Circuit, *, min_weight: int, batch_size: int = 900) -> None:
    """Add the edges that exist *between* neurons already in the circuit.

    Downstream expansion only records edges it walked.  Real subgraphs also
    contain lateral and recurrent connections among the neurons we collected;
    including them makes the propagation honest about the measured wiring.
    """
    ids = sorted(circuit.nodes)
    added = 0
    for chunk in _batch(ids, batch_size):
        q = f"""
            MATCH (n:Neuron)-[w:ConnectsTo]->(m:Neuron)
            WHERE n.bodyId IN {chunk!r} AND m.bodyId IN {ids!r}
              AND w.weight >= {int(min_weight)}
            RETURN n.bodyId AS source, m.bodyId AS target, w.weight AS weight
        """
        df = fetch_custom(q, client=get_client())
        for s, t, w in zip(df["source"], df["target"], df["weight"]):
            key = (int(s), int(t))
            if int(w) > circuit.edges.get(key, 0):
                circuit.edges[key] = int(w)
                added += 1
    log.info("closed graph with %d additional measured edges", added)
