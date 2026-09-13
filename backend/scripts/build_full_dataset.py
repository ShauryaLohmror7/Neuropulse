"""Build all annotated neurons and their complete official minconf-0.5 graph."""

import hashlib
import json
from datetime import UTC, datetime

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.compute as pc
from pyarrow import feather

from app.config import REPO_ROOT
from app.experience.ontology import ONTOLOGY

ROOT = REPO_ROOT / "data/full-cns"
SOURCE = ROOT / "source"


def main():
    sources = []
    for path in sorted(SOURCE.glob("*.feather")):
        info = json.loads(path.with_suffix(".source.json").read_text())
        with path.open("rb") as f:
            assert hashlib.file_digest(f, "sha256").hexdigest() == info["sha256"]
        sources.append(info)
    annotations = pd.read_feather(next(SOURCE.glob("body-annotations*.feather")))
    neurons = annotations[annotations.superclass.notna()].sort_values("bodyId").copy()
    ids = neurons.bodyId.to_numpy(np.int64)
    assert len(ids) == len(np.unique(ids)) == 166700
    nt = (
        pd.read_feather(next(SOURCE.glob("body-neurotransmitters*.feather")))
        .set_index("body")
        .reindex(ids)
    )
    st = feather.read_table(
        next(SOURCE.glob("body-stats*.feather")), columns=["body", "pre", "post"], memory_map=True
    )
    stats = (
        st.filter(pc.is_in(st["body"], value_set=pa.array(ids)))
        .to_pandas()
        .set_index("body")
        .reindex(ids)
    )
    del st
    neurons["side"] = neurons.somaSide.fillna(neurons.rootSide)
    seeds = {}
    for c in ONTOLOGY:
        p = c.population
        if c.mapping_quality == "UNSUPPORTED" or p.max_neurons <= 0:
            continue
        mask = pd.Series(True, index=neurons.index)
        constraints = [
            ("type", p.cell_types),
            ("class", p.neuron_class),
            ("subclass", p.subclass),
            ("superclass", p.superclass),
            ("entryNerve", p.entry_nerve),
        ]
        assert any(v for _, v in constraints) or p.type_regex
        for col, values in constraints:
            if values:
                mask &= neurons[col].isin(values)
        if p.type_regex:
            mask &= neurons.type.str.fullmatch(p.type_regex, na=False)
        if p.exclude_subclass:
            mask &= ~neurons.subclass.isin(p.exclude_subclass)
        if p.exclude_types:
            mask &= ~neurons.type.isin(p.exclude_types)
        matched = neurons[mask]
        seeds[c.key + ":all"] = matched.bodyId.astype(int).tolist()
        for side in ("L", "R"):
            seeds[c.key + ":" + side] = (
                matched[
                    matched.side.eq(side) if p.lateralised else pd.Series(True, index=matched.index)
                ]
                .bodyId.astype(int)
                .tolist()
            )

    def clean(v):
        return None if v is None or (np.isscalar(v) and pd.isna(v)) else v

    old = json.loads((REPO_ROOT / "frontend/public/circuits/cns_circuit.json").read_text())
    origin = np.array(old["transform"]["origin_nm"])
    scale = old["transform"]["scale_from_nm"]
    nodes = []
    soma_ids = []
    positions = []
    for i, row in enumerate(neurons.to_dict("records")):
        n = {
            k: clean(row.get(k))
            for k in (
                "bodyId",
                "type",
                "instance",
                "class",
                "superclass",
                "subclass",
                "side",
                "status",
                "somaSide",
                "rootSide",
                "entryNerve",
            )
        }
        n.update(
            hop=None,
            nt=clean(nt.iloc[i].predicted_nt),
            ntConf=clean(nt.iloc[i].predicted_nt_confidence),
            consensusNt=clean(nt.iloc[i].consensus_nt),
            pre=clean(stats.iloc[i].pre),
            post=clean(stats.iloc[i].post),
        )
        nodes.append(n)
        loc = row.get("somaLocation")
        if isinstance(loc, (list, np.ndarray)) and len(loc) == 3 and np.isfinite(loc).all():
            soma_ids.append(int(row["bodyId"]))
            positions.extend(((np.array(loc) * 8 - origin) * scale).tolist())
    print("Catalogue", len(nodes), "somata", len(soma_ids), flush=True)
    table = feather.read_table(next(SOURCE.glob("connectome-weights*.feather")), memory_map=True)
    parts = [[], [], []]
    raw_rows = table.num_rows
    total_syn = 0
    for batch in table.to_batches(max_chunksize=1000000):
        a, b, w = [col.to_numpy(zero_copy_only=False) for col in batch.columns]
        si = np.searchsorted(ids, a)
        ti = np.searchsorted(ids, b)
        keep = (
            (si < len(ids))
            & (ti < len(ids))
            & (ids[np.minimum(si, len(ids) - 1)] == a)
            & (ids[np.minimum(ti, len(ids) - 1)] == b)
        )
        assert (w > 0).all()
        for dest, arr in zip(
            parts,
            (si[keep].astype(np.int32), ti[keep].astype(np.int32), w[keep].astype(np.float32)),
        ):
            dest.append(arr)
        total_syn += int(w[keep].sum())
    del table
    artifacts = {}
    for name, arr in [("body_ids", ids)] + [
        (name, np.concatenate(part)) for name, part in zip(("sources", "targets", "weights"), parts)
    ]:
        path = ROOT / (name + ".npy")
        np.save(path, arr)
        with path.open("rb") as f:
            digest = hashlib.file_digest(f, "sha256").hexdigest()
        artifacts[path.name] = {"sha256": digest, "shape": list(arr.shape), "dtype": str(arr.dtype)}
    count = sum(map(len, parts[0]))
    del parts
    prov = {
        **old["provenance"],
        "source_query": "Official flat-connectome tables: every non-null-superclass annotated neuron and every edge with both endpoints in that catalogue; no edge-weight, fanout or population caps beyond the source minconf-0.5 export.",
        "fetched_at": datetime.now(UTC).isoformat(),
        "overviewSource": old["provenance"],
        "coverage": "all annotated neurons and all connections between them in the official minconf-0.5 flat connectome",
        "sources": sources,
        "membership": "non-null superclass in official body annotations, including isolated neurons",
        "sourceAnnotationRows": len(annotations),
        "excludedUnclassifiedOrNonNeuronalAnnotations": len(annotations) - len(ids),
        "sourceConnectionRows": raw_rows,
        "excludedConnectionsWithEndpointsOutsideNeuronCatalogue": raw_rows - count,
        "totalSynapses": total_syn,
        "artifacts": artifacts,
    }
    doc = {
        **old,
        "name": "full_male_cns",
        "nodes": nodes,
        "edges": {"source": [], "target": [], "weight": []},
        "seedSets": seeds,
        "somas": {"bodyIds": soma_ids, "positions": positions},
        "provenance": prov,
        "counts": {
            **old["counts"],
            "graphNeurons": len(ids),
            "graphEdges": count,
            "measuredSomata": len(soma_ids),
        },
        "policy": {
            "minSynapseConfidence": 0.5,
            "minEdgeWeight": 1,
            "populationCap": None,
            "outgoingEdgeCap": None,
        },
        "connectionAccess": "/api/neurons/{body_id}/connections",
    }
    (ROOT / "catalogue.json").write_text(json.dumps(doc, separators=(",", ":"), allow_nan=False))
    print(doc["counts"], "synapses", total_syn, flush=True)


if __name__ == "__main__":
    main()
