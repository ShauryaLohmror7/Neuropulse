"""Process-wide handles: the cached circuit and the semantic index.

Loaded once at startup so a simulation request is pure computation — no neuPrint
round-trip in the interactive path.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.config import REPO_ROOT
from app.simulation.graph import ConnectomeGraph

log = logging.getLogger(__name__)

CIRCUIT_DIR = REPO_ROOT / "frontend" / "public" / "circuits"
CIRCUIT_NAME = "cns_circuit"


class CircuitMissingError(RuntimeError):
    """The cached circuit bundle has not been built yet."""


@dataclass
class LoadedCircuit:
    doc: dict[str, Any]
    graph: ConnectomeGraph
    node_meta: dict[int, dict[str, Any]]
    seed_sets: dict[str, list[int]]
    rendered_ids: set[int]

    @property
    def provenance(self) -> dict[str, Any]:
        return self.doc.get("provenance", {})


@lru_cache(maxsize=1)
def get_circuit(name: str = CIRCUIT_NAME) -> LoadedCircuit:
    path = CIRCUIT_DIR / f"{name}.json"
    if not path.exists():
        raise CircuitMissingError(
            f"No circuit bundle at {path}. Build it with:\n"
            "  backend/.venv/bin/python -m scripts.build_circuit\n"
            "NEUROPULSE has no synthetic fallback."
        )
    doc = json.loads(path.read_bytes())

    node_meta: dict[int, dict[str, Any]] = {int(n["bodyId"]): n for n in doc["nodes"]}
    edges = doc["edges"]
    edge_list = [
        (int(s), int(t), float(w))
        for s, t, w in zip(edges["source"], edges["target"], edges["weight"])
    ]
    graph = ConnectomeGraph.from_edges(
        edge_list,
        node_meta={
            b: {
                "type": m.get("type"),
                "class": m.get("class"),
                "superclass": m.get("superclass"),
                "side": m.get("side"),
                "predictedNt": m.get("nt"),
                "predictedNtConfidence": m.get("ntConf"),
                "hop": m.get("hop"),
                "roi": m.get("roi"),
            }
            for b, m in node_meta.items()
        },
        provenance=doc.get("provenance", {}),
    )
    rendered = {int(n["bodyId"]) for n in doc.get("neurons", [])}
    log.info(
        "circuit %s: %d neurons, %d edges, %d rendered",
        name, graph.n_nodes, graph.n_edges, len(rendered),
    )
    return LoadedCircuit(
        doc=doc,
        graph=graph,
        node_meta=node_meta,
        seed_sets={k: [int(b) for b in v] for k, v in doc.get("seedSets", {}).items()},
        rendered_ids=rendered,
    )


@lru_cache(maxsize=1)
def get_semantic_index():
    from app.experience.embeddings import get_index

    return get_index()
