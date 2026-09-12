#!/usr/bin/env python
"""Fetch and decimate real MaleCNS ROI surface meshes for anatomical context.

The meshes are genuine neuPrint ROI surfaces for this dataset — the same
neuropil boundaries used by the MaleCNS project — decimated for the browser by
vertex clustering (snap to a grid, weld, drop degenerate triangles).  Decimation
moves vertices onto a coarse grid; it does not invent structure.

    backend/.venv/bin/python -m scripts.fetch_anatomy
"""

from __future__ import annotations

import argparse
import concurrent.futures as cf
import logging

import numpy as np
import orjson

from app.config import REPO_ROOT, get_settings
from app.connectome.client import get_client, verify_dataset
from app.connectome.provenance import Provenance
from app.connectome.queries import voxel_size_nm

OUT_DIR = REPO_ROOT / "frontend" / "public" / "circuits"
log = logging.getLogger("anatomy")

#: Neuropils that matter for the sensory pathways NEUROPULSE stimulates, plus
#: enough of the rest of the CNS to read as a brain rather than a fragment.
ROI_GROUPS: dict[str, list[str]] = {
    "optic": ["ME(L)", "ME(R)", "LO(L)", "LO(R)", "LOP(L)", "LOP(R)", "AME(L)", "AME(R)"],
    "olfactory": ["AL(L)", "AL(R)"],
    "mushroom_body": ["CA(L)", "CA(R)", "PED(L)", "PED(R)",
                      "aL(L)", "aL(R)", "bL(L)", "bL(R)", "gL(L)", "gL(R)"],
    "central_complex": ["FB", "EB", "PB", "NO", "AB(L)", "AB(R)"],
    "lateral_protocerebrum": ["PVLP(L)", "PVLP(R)", "AVLP(L)", "AVLP(R)",
                              "PLP(L)", "PLP(R)"],
    "mechanosensory": ["AMMC(L)", "AMMC(R)", "WED(L)", "WED(R)", "SAD"],
    "gnathal": ["GNG"],
    "superior": ["SLP(L)", "SLP(R)", "SMP(L)", "SMP(R)", "SIP(L)", "SIP(R)"],
    "vnc": ["ANm", "IntTct", "LTct", "LegNp(T1)(L)", "LegNp(T1)(R)",
            "LegNp(T2)(L)", "LegNp(T2)(R)", "LegNp(T3)(L)", "LegNp(T3)(R)",
            "WTct(UTct-T2)(L)", "WTct(UTct-T2)(R)", "NTct(UTct-T1)(L)", "NTct(UTct-T1)(R)"],
}


def parse_obj(data: bytes) -> tuple[np.ndarray, np.ndarray]:
    verts: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int]] = []
    for line in data.decode("utf-8", "ignore").splitlines():
        if line.startswith("v "):
            _, x, y, z = line.split()[:4]
            verts.append((float(x), float(y), float(z)))
        elif line.startswith("f "):
            idx = [int(tok.split("/")[0]) - 1 for tok in line.split()[1:4]]
            faces.append((idx[0], idx[1], idx[2]))
    return np.asarray(verts, dtype=np.float32), np.asarray(faces, dtype=np.int64)


def cluster_decimate(
    verts: np.ndarray, faces: np.ndarray, cell_nm: float
) -> tuple[np.ndarray, np.ndarray]:
    """Vertex-clustering decimation: snap to a grid, weld, drop degenerate faces."""
    if len(verts) == 0:
        return verts, faces
    keys = np.floor(verts / cell_nm).astype(np.int64)
    _, inverse, counts = np.unique(keys, axis=0, return_inverse=True, return_counts=True)
    n_new = int(inverse.max()) + 1
    acc = np.zeros((n_new, 3), dtype=np.float64)
    np.add.at(acc, inverse, verts.astype(np.float64))
    new_verts = (acc / counts[:, None]).astype(np.float32)

    nf = inverse[faces]
    keep = (nf[:, 0] != nf[:, 1]) & (nf[:, 1] != nf[:, 2]) & (nf[:, 0] != nf[:, 2])
    nf = nf[keep]
    nf = np.unique(np.sort(nf, axis=1), axis=0)
    return new_verts, nf


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s", datefmt="%H:%M:%S")
    ap = argparse.ArgumentParser()
    ap.add_argument("--cell-um", type=float, default=7.0, help="Decimation grid, micrometres.")
    ap.add_argument("--name", default="anatomy")
    args = ap.parse_args()

    settings = get_settings()
    info = verify_dataset()
    client = get_client()
    vs = voxel_size_nm()
    log.info("dataset %s, voxel %.0f nm", info.dataset, vs)

    wanted = [(g, roi) for g, rois in ROI_GROUPS.items() for roi in rois]
    available = set(client.all_rois)
    wanted = [(g, r) for g, r in wanted if r in available]
    log.info("fetching %d ROI meshes", len(wanted))

    def one(item: tuple[str, str]):
        group, roi = item
        try:
            raw = client.fetch_roi_mesh(roi, export_path=None)
        except Exception as e:
            log.warning("  %s unavailable: %s", roi, str(e)[:90])
            return None
        v, f = parse_obj(raw)
        if len(v) == 0:
            return None
        v = v * vs  # voxel units -> nanometres
        v2, f2 = cluster_decimate(v, f, args.cell_um * 1000.0)
        log.info("  %-18s %6d -> %5d verts, %6d -> %5d faces", roi, len(v), len(v2), len(f), len(f2))
        return group, roi, v2, f2

    results = []
    with cf.ThreadPoolExecutor(max_workers=6) as ex:
        for r in ex.map(one, wanted):
            if r:
                results.append(r)

    if not results:
        raise SystemExit("No ROI meshes retrieved.")

    all_v = np.concatenate([r[2] for r in results])
    lo, hi = all_v.min(axis=0), all_v.max(axis=0)
    centre = (lo + hi) / 2.0
    log.info("CNS extent: %.0f x %.0f x %.0f um",
             *(hi - lo) / 1000.0)

    chunks_v: list[np.ndarray] = []
    chunks_f: list[np.ndarray] = []
    entries = []
    voff = 0
    foff = 0
    for group, roi, v, f in results:
        vv = ((v - centre) / 1000.0).astype(np.float32)  # nm -> um, centred
        chunks_v.append(vv)
        chunks_f.append((f + voff).astype(np.uint32))
        entries.append(
            {
                "roi": roi,
                "group": group,
                "vertexStart": voff,
                "vertexCount": int(len(vv)),
                "indexStart": foff,
                "indexCount": int(f.size),
                "centroid": [round(float(x), 2) for x in vv.mean(axis=0)],
            }
        )
        voff += len(vv)
        foff += int(f.size)

    verts = np.concatenate(chunks_v)
    idx = np.concatenate(chunks_f).ravel()
    (OUT_DIR / f"{args.name}.verts.bin").write_bytes(verts.tobytes())
    (OUT_DIR / f"{args.name}.idx.bin").write_bytes(idx.astype(np.uint32).tobytes())

    prov = Provenance.build(
        dataset=settings.neuprint_dataset,
        server=settings.neuprint_server,
        source_query="neuPrint ROI mesh API (/api/roimeshes/mesh) for MaleCNS neuropil surfaces",
        notes=(
            "Real neuropil boundary surfaces for this dataset, decimated by vertex clustering "
            f"on a {args.cell_um} um grid. Decimation snaps and welds existing vertices; no "
            "geometry is invented. Coordinates converted from voxel units to micrometres and "
            "centred on the CNS bounding-box centre."
        ),
        dataset_uuid=info.uuid,
        decimation_grid_um=args.cell_um,
    )
    doc = {
        "provenance": prov.model_dump(),
        "transform": {
            "units": "micrometres",
            "origin_nm": [float(x) for x in centre],
            "bounds_um": {
                "min": [round(float(x), 1) for x in (lo - centre) / 1000.0],
                "max": [round(float(x), 1) for x in (hi - centre) / 1000.0],
            },
        },
        "rois": entries,
        "counts": {"vertices": int(len(verts)), "indices": int(len(idx))},
    }
    (OUT_DIR / f"{args.name}.json").write_bytes(orjson.dumps(doc))
    log.info("wrote %s.json + .verts.bin (%.0f KB) + .idx.bin (%.0f KB)",
             args.name,
             (OUT_DIR / f"{args.name}.verts.bin").stat().st_size / 1024,
             (OUT_DIR / f"{args.name}.idx.bin").stat().st_size / 1024)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
