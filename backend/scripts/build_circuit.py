#!/usr/bin/env python
"""Build the NEUROPULSE demo circuit from real MaleCNS v1.0 data.

Seeds every stimulatable concept in the ontology (both body sides), expands
downstream under an explicit policy, fetches real skeletons for the neurons the
scene will draw, and writes a browser bundle with full provenance.

    backend/.venv/bin/python -m scripts.build_circuit
"""

from __future__ import annotations

import argparse
import logging
import time

import numpy as np
import pandas as pd

from app.config import REPO_ROOT, get_settings
from app.connectome.bundle import fetch_morphologies, write_bundle
from app.connectome.circuits import (Circuit, ExpansionPolicy, attach_output_neurons,
                                     expand_circuit)
from app.connectome.client import verify_dataset
from app.connectome.populations import resolve_population
from app.connectome.provenance import Provenance
from app.experience.ontology import STIMULATABLE
from app.simulation.response import CHANNELS

OUT_DIR = REPO_ROOT / "frontend" / "public" / "circuits"
log = logging.getLogger("build_circuit")


def select_render_set(circuit: Circuit, limit: int) -> list[int]:
    """Choose which real neurons the scene will draw.

    Seeds always render (they are the origin of the experience).  Beyond that we
    prefer neurons that carry the most signal: total synaptic weight on their
    incoming edges *within this circuit*, with earlier hops favoured so the
    rendered network stays connected back to the sensory periphery.
    """
    seeds = {b for ids in circuit.seed_sets.values() for b in ids}
    # Named output neurons always render: they are what the response readout reports.
    marker_types = {t for c in CHANNELS for t in c.marker_types}
    seeds |= {
        b for b, meta in circuit.nodes.items() if meta.get("type") in marker_types
    }
    score: dict[int, float] = {b: 0.0 for b in circuit.nodes}
    for (_s, t), w in circuit.edges.items():
        score[t] = score.get(t, 0.0) + float(w)
    hop_bonus = {0: 4.0, 1: 2.2, 2: 1.4, 3: 1.0, 4: 0.8}
    ranked = sorted(
        (b for b in circuit.nodes if b not in seeds),
        key=lambda b: -score.get(b, 0.0) * hop_bonus.get(circuit.hop_of.get(b, 4), 0.7),
    )
    out = list(seeds)
    for b in ranked:
        if len(out) >= limit:
            break
        out.append(b)
    return out


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s", datefmt="%H:%M:%S")
    ap = argparse.ArgumentParser()
    ap.add_argument("--seeds-per-set", type=int, default=40)
    ap.add_argument("--hops", type=int, default=4)
    ap.add_argument("--max-nodes", type=int, default=5000)
    ap.add_argument("--render-limit", type=int, default=800)
    ap.add_argument("--epsilon", type=float, default=420.0)
    ap.add_argument("--twig", type=float, default=6000.0, help="Terminal-branch prune threshold, nm.")
    ap.add_argument("--name", default="cns_circuit")
    ap.add_argument("--only", default=None, help="Comma-separated concept keys (debug).")
    args = ap.parse_args()

    settings = get_settings()
    info = verify_dataset()
    log.info("dataset %s uuid=%s", info.dataset, info.uuid)

    concepts = STIMULATABLE
    if args.only:
        wanted = {k.strip() for k in args.only.split(",")}
        concepts = [c for c in concepts if c.key in wanted]

    t0 = time.time()
    seed_frames: dict[str, pd.DataFrame] = {}
    for concept in concepts:
        for side in ("L", "R"):
            df = resolve_population(concept, side)
            if df.empty:
                log.warning("  %s:%s resolved to 0 neurons", concept.key, side)
                continue
            seed_frames[f"{concept.key}:{side}"] = df.head(args.seeds_per_set)
            log.info("  %-24s %s  %3d seeds", concept.key, side, min(len(df), args.seeds_per_set))

    policy = ExpansionPolicy(hops=args.hops, max_nodes=args.max_nodes)
    circuit = expand_circuit(seed_frames, policy)

    # Behavioural readout depends on specific, small descending/motor populations.
    marker_types = sorted({t for c in CHANNELS for t in c.marker_types})
    attach_output_neurons(circuit, marker_types)

    log.info("circuit: %d neurons, %d measured connections (%.0fs)",
             circuit.n_nodes, circuit.n_edges, time.time() - t0)

    render_ids = select_render_set(circuit, args.render_limit)
    log.info("fetching %d real skeletons ...", len(render_ids))
    t1 = time.time()
    rendered = fetch_morphologies(
        render_ids, simplify_epsilon_nm=args.epsilon, twig_prune_nm=args.twig
    )
    log.info("got %d skeletons in %.0fs", len(rendered), time.time() - t1)

    prov = Provenance.build(
        dataset=settings.neuprint_dataset,
        server=settings.neuprint_server,
        source_query=(
            "Sensory populations resolved from MaleCNS annotations (class/subclass/type/"
            "entryNerve/rootSide/somaSide); downstream expansion over ConnectsTo edges with "
            f"weight thresholds {policy.min_weight_first}/{policy.min_weight_deep}, fanout "
            f"{policy.fanout_first}/{policy.fanout_deep}, {policy.hops} hops; graph closed over "
            "all measured edges among collected neurons; skeletons from the neuPrint skeleton API."
        ),
        notes=(
            "All neuron identities, connectivity, synapse counts, annotations and 3D morphology "
            "in this bundle are real MaleCNS v1.0 data. Activation dynamics are modelled "
            "separately at simulation time and are not part of this file."
        ),
        dataset_uuid=info.uuid,
        seed_sets=list(seed_frames),
        simplify_epsilon_nm=args.epsilon,
        twig_prune_nm=args.twig,
        skeleton_policy="largest connected component only; no synthetic links",
    )

    extra = {
        "concepts": [
            {
                "key": c.key,
                "modality": c.modality,
                "label": c.label,
                "mappingQuality": c.mapping_quality,
                "evidence": c.evidence,
                "caveat": c.caveat,
            }
            for c in concepts
        ]
    }
    res = write_bundle(OUT_DIR, args.name, circuit, rendered, prov, extra=extra)
    log.info("wrote %s (%.0f KB) + %s (%.0f KB)  rendered=%d vertices=%d",
             res["json"], res["json_kb"], res["bin"], res["bin_kb"],
             res["rendered"], res["vertices"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
