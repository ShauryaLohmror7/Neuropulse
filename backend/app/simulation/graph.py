"""In-memory representation of a real connectome subgraph.

Nodes are MaleCNS bodyIds; edges are measured ``ConnectsTo`` relationships with
their real synapse counts.  The only derived quantity is the normalised weight
used by the propagation model, and the optional excitatory/inhibitory sign taken
from the dataset's neurotransmitter prediction.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

import numpy as np

#: Neurotransmitter -> sign, following standard Drosophila pharmacology.
#: ACh is the principal fast excitatory transmitter; GABA and glutamate act
#: largely through inhibitory receptors (GluCl-alpha) in the fly CNS.  Modulators
#: are left unsigned because their net effect is context dependent.
NT_SIGN: dict[str, float] = {
    "acetylcholine": +1.0,
    "ach": +1.0,
    "gaba": -1.0,
    "glutamate": -1.0,
    "glut": -1.0,
    "serotonin": 0.0,
    "dopamine": 0.0,
    "octopamine": 0.0,
    "unknown": 0.0,
    "": 0.0,
}


@dataclass
class ConnectomeGraph:
    """A weighted directed graph of real neurons."""

    body_ids: np.ndarray  # (N,) int64
    sources: np.ndarray  # (E,) int32 node indices
    targets: np.ndarray  # (E,) int32 node indices
    weights: np.ndarray  # (E,) float32 — real synapse counts
    node_meta: list[dict[str, Any]] = field(default_factory=list)
    index: dict[int, int] = field(default_factory=dict)
    provenance: dict[str, Any] = field(default_factory=dict)

    # ---------------------------------------------------------------- build
    @classmethod
    def from_edges(
        cls,
        edges: Iterable[tuple[int, int, float]],
        node_meta: Mapping[int, dict[str, Any]] | None = None,
        provenance: dict[str, Any] | None = None,
    ) -> ConnectomeGraph:
        edges = list(edges)
        ids: list[int] = []
        index: dict[int, int] = {}

        def idx(b: int) -> int:
            b = int(b)
            if b not in index:
                index[b] = len(ids)
                ids.append(b)
            return index[b]

        # Ensure every annotated node exists even if it has no surviving edge.
        if node_meta:
            for b in node_meta:
                idx(int(b))

        s = np.empty(len(edges), dtype=np.int32)
        t = np.empty(len(edges), dtype=np.int32)
        w = np.empty(len(edges), dtype=np.float32)
        for i, (a, b, weight) in enumerate(edges):
            s[i] = idx(a)
            t[i] = idx(b)
            w[i] = float(weight)

        body_ids = np.asarray(ids, dtype=np.int64)
        meta = [dict((node_meta or {}).get(int(b), {})) for b in body_ids]
        return cls(
            body_ids=body_ids,
            sources=s,
            targets=t,
            weights=w,
            node_meta=meta,
            index=index,
            provenance=provenance or {},
        )

    # ------------------------------------------------------------- queries
    @property
    def n_nodes(self) -> int:
        return len(self.body_ids)

    @property
    def n_edges(self) -> int:
        return len(self.weights)

    def node_index(self, body_id: int) -> int | None:
        return self.index.get(int(body_id))

    def neighbours(self, body_id: int) -> list[int]:
        i = self.node_index(body_id)
        if i is None:
            return []
        return [int(self.body_ids[t]) for t in self.targets[self.sources == i]]

    # ------------------------------------------------------------ dynamics
    def nt_signs(self, *, confidence_floor: float = 0.5) -> np.ndarray:
        """Per-source sign multiplier derived from dataset NT predictions.

        Returns +1 (excitatory), -1 (inhibitory) or 0-marker +1 with
        ``unsigned`` semantics: unknown/unconfident neurons are treated as
        excitatory-neutral (+1) so we never invent inhibition we cannot defend.
        """
        signs = np.ones(self.n_nodes, dtype=np.float32)
        for i, meta in enumerate(self.node_meta):
            nt = (meta.get("predictedNt") or meta.get("consensusNt") or "") or ""
            conf = meta.get("predictedNtConfidence")
            nt_key = str(nt).strip().lower()
            sign = NT_SIGN.get(nt_key, 0.0)
            if sign == 0.0:
                continue
            if conf is not None:
                try:
                    if float(conf) < confidence_floor:
                        continue
                except (TypeError, ValueError):
                    pass
            signs[i] = sign
        return signs

    def nt_coverage(self, *, confidence_floor: float = 0.5) -> dict[str, Any]:
        """How much of this subgraph actually carries a usable NT prediction."""
        total = self.n_nodes
        signed = 0
        inhibitory = 0
        for meta in self.node_meta:
            nt = str(meta.get("predictedNt") or meta.get("consensusNt") or "").strip().lower()
            sign = NT_SIGN.get(nt, 0.0)
            conf = meta.get("predictedNtConfidence")
            ok = sign != 0.0
            if ok and conf is not None:
                try:
                    ok = float(conf) >= confidence_floor
                except (TypeError, ValueError):
                    ok = True
            if ok:
                signed += 1
                if sign < 0:
                    inhibitory += 1
        return {
            "nodes": total,
            "withConfidentNt": signed,
            "inhibitory": inhibitory,
            "fraction": (signed / total) if total else 0.0,
        }

    def transmission_edges(
        self, mode: str = "target_input", *, top_k: int | None = None, min_weight: float = 1.0
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """Filtered edge list with normalised transmission weights.

        Returns ``(sources, targets, normalised_weight)``.
        """
        if min_weight <= 1:
            s, t, w = self.sources, self.targets, self.weights
        else:
            keep = self.weights >= min_weight
            s, t, w = self.sources[keep], self.targets[keep], self.weights[keep]

        if top_k is not None and len(w):
            order = np.lexsort((-w, s))
            s, t, w = s[order], t[order], w[order]
            # rank within each source block
            rank = np.zeros(len(s), dtype=np.int64)
            if len(s) > 1:
                new_block = np.empty(len(s), dtype=bool)
                new_block[0] = True
                new_block[1:] = s[1:] != s[:-1]
                block_start = np.maximum.accumulate(np.where(new_block, np.arange(len(s)), 0))
                rank = np.arange(len(s)) - block_start
            keep2 = rank < top_k
            s, t, w = s[keep2], t[keep2], w[keep2]

        if not len(w):
            return s, t, w.astype(np.float32), w

        if mode == "source_output":
            denom = np.bincount(s, weights=w, minlength=self.n_nodes)
            nw = w / np.maximum(denom[s], 1e-6)
        elif mode == "log":
            lw = np.log1p(w)
            denom = np.bincount(s, weights=lw, minlength=self.n_nodes)
            nw = lw / np.maximum(denom[s], 1e-6)
        else:  # target_input (default)
            denom = np.bincount(t, weights=w, minlength=self.n_nodes)
            nw = w / np.maximum(denom[t], 1e-6)
        return s, t, nw.astype(np.float32), w

    def normalised_weights(self, mode="target_input", *, top_k=None, min_weight=1.0):
        return self.transmission_edges(mode, top_k=top_k, min_weight=min_weight)[:3]

    # ------------------------------------------------------------ lesioning
    def without(self, body_ids: Sequence[int]) -> ConnectomeGraph:
        """Return a copy with the given neurons computationally silenced."""
        drop = {int(b) for b in body_ids}
        drop_idx = {self.index[b] for b in drop if b in self.index}
        if not drop_idx:
            return self
        mask = ~(np.isin(self.sources, list(drop_idx)) | np.isin(self.targets, list(drop_idx)))
        g = ConnectomeGraph(
            body_ids=self.body_ids.copy(),
            sources=self.sources[mask].copy(),
            targets=self.targets[mask].copy(),
            weights=self.weights[mask].copy(),
            node_meta=[dict(m) for m in self.node_meta],
            index=dict(self.index),
            provenance={**self.provenance, "lesioned": sorted(drop)},
        )
        return g
