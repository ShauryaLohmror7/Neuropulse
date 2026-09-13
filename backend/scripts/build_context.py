#!/usr/bin/env python
"""Build the dense brain-context layer: a broad sample of real MaleCNS neurons.

Published renders of this connectome show essentially the whole population, which
is what gives the brain its characteristic dense silhouette — two optic lobes
flanking the central brain, with the oesophageal foramen in the middle. The
NEUROPULSE sensory circuit is a few thousand neurons threading through that
volume, so on its own it reads as wires rather than tissue.

This script fetches a *stratified sample of real traced neurons* spanning the
whole brain to render as dim context behind the active circuit. Every neuron in
it is real MaleCNS data with a real bodyId; it is a sample, not a synthesis, and
it is drawn unlit and unanimated so it can never be mistaken for simulated
activity.

    backend/.venv/bin/python -m scripts.build_context
"""

from __future__ import annotations

import argparse
import logging
import time

import numpy as np
import pandas as pd
from neuprint import fetch_custom

from app.config import REPO_ROOT, get_settings
from app.connectome.bundle import fetch_morphologies, write_bundle
from app.connectome.circuits import Circuit
from app.connectome.client import get_client, verify_dataset
from app.connectome.provenance import Provenance
from app.connectome.queries import available_keys

OUT_DIR = REPO_ROOT / "frontend" / "public" / "circuits"
log = logging.getLogger("build_context")

#: Roughly how the brain's mass is distributed. Sampling proportionally is what
#: reproduces the familiar silhouette: the optic lobes dominate by cell count.
STRATA: list[tuple[str, float]] = [
    ("ol_intrinsic", 0.42),
    ("cb_intrinsic", 0.26),
    ("visual_projection", 0.09),
    ("ol_sensory", 0.07),
    ("cb_sensory", 0.05),
    ("visual_centrifugal", 0.03),
    ("descending_neuron", 0.03),
    ("ascending_neuron", 0.02),
    ("cb_motor", 0.01),
    ("sensory_ascending", 0.02),
]


def sample_stratum(superclass: str, n: int, seed: int) -> pd.DataFrame:
    """A deterministic pseudo-random sample of traced neurons in one stratum.

    Ordering by a hash of bodyId gives a spatially unbiased spread that is
    reproducible run to run (important: the demo must look identical each time).
    """
    keys = [k for k in available_keys()]
    ret = ", ".join(f"n.`{k}` AS `{k}`" for k in keys)
    q = f"""
        MATCH (n:Neuron)
        WHERE n.superclass = {superclass!r} AND n.status = 'Traced'
        RETURN {ret}, coalesce(n.somaSide, n.rootSide) AS side,
               (n.bodyId * {seed}) % 100003 AS _shuffle
        ORDER BY _shuffle
        LIMIT {int(n)}
    """
    df = fetch_custom(q, client=get_client())
    return df.drop(columns=[c for c in ("_shuffle",) if c in df.columns])


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s", datefmt="%H:%M:%S")
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=3600, help="Total context neurons.")
    ap.add_argument("--epsilon", type=float, default=1400.0, help="RDP simplification, nm.")
    ap.add_argument("--twig", type=float, default=14000.0, help="Twig prune threshold, nm.")
    ap.add_argument("--max-vertices", type=int, default=130)
    ap.add_argument("--seed", type=int, default=7919)
    ap.add_argument("--name", default="brain_context")
    args = ap.parse_args()

    settings = get_settings()
    info = verify_dataset()
    log.info("dataset %s uuid=%s", info.dataset, info.uuid)

    frames: list[pd.DataFrame] = []
    for superclass, share in STRATA:
        n = max(int(args.count * share), 1)
        df = sample_stratum(superclass, n, args.seed)
        log.info("  %-20s requested %4d, got %4d", superclass, n, len(df))
        if len(df):
            frames.append(df)

    if not frames:
        raise SystemExit("No context neurons returned — refusing to write an empty bundle.")

    neurons = pd.concat(frames, ignore_index=True).drop_duplicates(subset=["bodyId"])
    log.info("sampled %d real neurons", len(neurons))

    # The context layer is geometry only: no edges, no simulation participation.
    circuit = Circuit()
    for _, row in neurons.iterrows():
        b = int(row["bodyId"])
        meta = {
            k: (None if (isinstance(v, float) and np.isnan(v)) else v)
            for k, v in row.items()
            if k != "roiInfo"
        }
        circuit.nodes[b] = meta
        circuit.hop_of[b] = -1
    circuit.policy = {"role": "visual context only", "sampled": len(neurons), "seed": args.seed}

    t0 = time.time()
    log.info("fetching %d real skeletons ...", len(neurons))
    rendered = fetch_morphologies(
        [int(b) for b in neurons["bodyId"]],
        simplify_epsilon_nm=args.epsilon,
        twig_prune_nm=args.twig,
        max_vertices_each=args.max_vertices,
        workers=10,
    )
    log.info("got %d skeletons in %.0fs", len(rendered), time.time() - t0)

    prov = Provenance.build(
        dataset=settings.neuprint_dataset,
        server=settings.neuprint_server,
        source_query=(
            "Stratified deterministic sample of status='Traced' neurons by superclass "
            f"(seed {args.seed}); skeletons from the neuPrint skeleton API."
        ),
        notes=(
            "VISUAL CONTEXT LAYER. Every neuron here is real MaleCNS v1.0 data with a real "
            "bodyId and real morphology, but this bundle is a *sample* of the population "
            "rendered purely to show the brain's structure. It carries no connectivity and "
            "takes no part in the simulation; it is never animated as active."
        ),
        dataset_uuid=info.uuid,
        role="context",
        strata=dict(STRATA),
        simplify_epsilon_nm=args.epsilon,
        twig_prune_nm=args.twig,
    )

    res = write_bundle(OUT_DIR, args.name, circuit, rendered, prov,
                       extra={"role": "context"})
    log.info("wrote %s (%.0f KB) + %s (%.0f KB)  rendered=%d vertices=%d",
             res["json"], res["json_kb"], res["bin"], res["bin_kb"],
             res["rendered"], res["vertices"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
