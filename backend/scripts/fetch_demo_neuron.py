#!/usr/bin/env python
"""Milestone 1, steps 8-13: fetch ONE real MaleCNS neuron end to end.

Retrieves metadata, the real skeleton (dataset nanometre coordinates) and real
connectivity for a single neuron, converts the morphology to the compact
browser format, and writes it to ``frontend/public/circuits/`` with provenance.

Usage:
    backend/.venv/bin/python -m scripts.fetch_demo_neuron [--type LPLC2] [--body-id N]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import orjson

from app.config import REPO_ROOT, get_settings
from app.connectome.client import get_client, verify_dataset
from app.connectome.morphology import build_morphology, morphology_to_payload
from app.connectome.provenance import Provenance
from app.connectome.queries import (
    available_keys,
    fetch_connections,
    fetch_neuron_metadata,
    fetch_real_skeleton,
    search_neurons,
    voxel_size_nm,
)

OUT_DIR = REPO_ROOT / "frontend" / "public" / "circuits"


def pick_neuron(type_name: str) -> dict:
    df = search_neurons(type_regex=f"^{type_name}$", status="Traced")
    if df.empty:
        df = search_neurons(type_regex=f"^{type_name}$")
    if df.empty:
        raise SystemExit(f"No neurons of type {type_name!r} in this dataset.")
    sort_col = "synweight" if "synweight" in df.columns else "pre"
    df = df.sort_values(sort_col, ascending=False)
    return df.iloc[0].to_dict()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--type", default="LPLC2", help="Cell type to sample (default LPLC2).")
    ap.add_argument("--body-id", type=int, default=None)
    ap.add_argument("--epsilon", type=float, default=250.0, help="RDP simplification, nm.")
    args = ap.parse_args()

    settings = get_settings()
    info = verify_dataset()
    print(f"dataset {info.dataset} uuid={info.uuid}")

    if args.body_id:
        meta_df = fetch_neuron_metadata([args.body_id])
        if meta_df.empty:
            raise SystemExit(f"bodyId {args.body_id} not found.")
        row = meta_df.iloc[0].to_dict()
    else:
        row = pick_neuron(args.type)

    body_id = int(row["bodyId"])
    print(f"\nREAL NEURON  bodyId={body_id}")
    for k in ("type", "instance", "class", "subclass", "superclass", "status",
              "rootSide", "somaSide", "predictedNt", "predictedNtConfidence",
              "pre", "post", "synweight", "somaLocation"):
        if k in row and row[k] is not None and str(row[k]) != "nan":
            print(f"  {k:24s} {row[k]}")

    print("\nfetching real skeleton ...")
    skel, skel_report = fetch_real_skeleton(body_id)
    print(f"  skeleton nodes: {len(skel)}  columns: {list(skel.columns)}")
    print(f"  fragmentation: {skel_report}")
    print(f"  voxel size: {voxel_size_nm():.0f} nm -> coordinates converted to nm")
    print(f"  bbox um: x[{skel.x.min()/1000:.1f},{skel.x.max()/1000:.1f}] "
          f"y[{skel.y.min()/1000:.1f},{skel.y.max()/1000:.1f}] "
          f"z[{skel.z.min()/1000:.1f},{skel.z.max()/1000:.1f}]")

    soma = None
    if isinstance(row.get("somaLocation"), (list, tuple)):
        # somaLocation is also in voxel units.
        soma = tuple(float(v) * voxel_size_nm() for v in row["somaLocation"])

    morph = build_morphology(
        body_id, skel, simplify_epsilon_nm=args.epsilon, soma_position=soma,
        meta={k: (None if (isinstance(row.get(k), float) and np.isnan(row.get(k))) else row.get(k))
              for k in available_keys() if k in row},
    )
    print(f"  strands: {len(morph.paths)}  vertices kept: {morph.node_count_kept}"
          f" / {morph.node_count_original}  cable: {morph.cable_length()/1000:.1f} um")

    print("\nfetching real connectivity ...")
    down = fetch_connections([body_id], min_weight=5, max_per_source=25, direction="downstream")
    up = fetch_connections([body_id], min_weight=5, max_per_source=25, direction="upstream")
    print(f"  downstream partners (weight>=5): {len(down)}")
    if len(down):
        print(down[["source", "target", "weight", "type"]].head(10).to_string(index=False))
    print(f"  upstream partners (weight>=5): {len(up)}")

    # Centre the neuron on its own bounding-box centre; scale nm -> scene units.
    lo, hi = morph.bounds()
    centre = ((lo + hi) / 2.0).tolist()
    scale = 1.0 / 1000.0  # nanometres -> micrometres
    payload = morphology_to_payload(morph, scale=scale, origin=centre)
    payload["connectivity"] = {
        "downstream": down[["target", "weight", "type"]].rename(
            columns={"target": "bodyId"}).to_dict(orient="records") if len(down) else [],
        "upstream": up[["source", "weight", "type"]].rename(
            columns={"source": "bodyId"}).to_dict(orient="records") if len(up) else [],
    }

    prov = Provenance.build(
        dataset=settings.neuprint_dataset,
        server=settings.neuprint_server,
        source_query=(
            f"fetch_neurons(bodyId={body_id}); fetch_skeleton({body_id}, heal=True); "
            f"ConnectsTo edges with weight>=5"
        ),
        notes="Single-neuron proof of the real-data pipeline (Milestone 1).",
        dataset_uuid=info.uuid,
        body_id=body_id,
        morphology_source="neuPrint skeleton API (nanometre coordinates), RDP-simplified",
        simplify_epsilon_nm=args.epsilon,
        skeleton_report=skel_report,
    )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / "demo_neuron.json"
    out.write_bytes(orjson.dumps({"provenance": prov.model_dump(), "payload": payload}))
    size_kb = out.stat().st_size / 1024
    print(f"\nwrote {out.relative_to(REPO_ROOT)}  ({size_kb:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
