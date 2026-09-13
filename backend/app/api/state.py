"""Process-wide handles: the cached circuit and the semantic index.

Loaded once at startup so a simulation request is pure computation — no neuPrint
round-trip in the interactive path.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from functools import lru_cache
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
    import hashlib

    import numpy as np

    root = REPO_ROOT / "data/full-cns"
    path = root / "catalogue.json"
    if not path.exists():
        raise CircuitMissingError(
            "Full dataset missing. Run from backend: .venv/bin/python -m scripts.download_full_dataset then .venv/bin/python -m scripts.build_full_dataset. No subset fallback."
        )
    doc = json.loads(path.read_bytes())
    arrays = {}
    for filename, expected in doc["provenance"]["artifacts"].items():
        with (root / filename).open("rb") as f:
            if hashlib.file_digest(f, "sha256").hexdigest() != expected["sha256"]:
                raise CircuitMissingError(
                    f"Full dataset integrity failure: {filename}. Rebuild the full dataset."
                )
        arrays[filename[:-4]] = np.load(root / filename, mmap_mode="r")
    node_meta = {int(n["bodyId"]): n for n in doc["nodes"]}
    ids = arrays["body_ids"]
    if list(node_meta) != ids.tolist():
        raise CircuitMissingError("Catalogue and graph IDs do not agree. Rebuild the full dataset.")
    graph = ConnectomeGraph(
        **arrays,
        node_meta=[
            {**m, "predictedNt": m.get("nt"), "predictedNtConfidence": m.get("ntConf")}
            for m in node_meta.values()
        ],
        index={int(b): i for i, b in enumerate(ids)},
        provenance=doc["provenance"],
    )
    rendered = {int(n["bodyId"]) for n in doc.get("neurons", [])}
    log.info(
        "circuit %s: %d neurons, %d edges, %d rendered",
        name,
        graph.n_nodes,
        graph.n_edges,
        len(rendered),
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
