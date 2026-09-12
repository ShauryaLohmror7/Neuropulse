# NEUROPULSE — build progress

Working notes for resuming the build. Not user documentation.

## Where we are

| Milestone | State |
|---|---|
| M1 — one real neuron rendered from real skeleton | **done** |
| M2 — real subcircuit + propagation | **done** (backend), scene renders, visual tuning pending |
| M3 — experience compiler | **done** |
| M4 — multimodal simultaneous pathways | **done** end-to-end via API; needs on-screen verification |
| Two view modes (fly / brain) | scene + camera built; transition needs polish |
| Modelled response | **done** (backend + panel) |
| Lesion | backend done, no UI yet |
| README / attribution | **not started** |

## Verified facts about the dataset

* `male-cns:v1.0`, uuid `4b2087c0fbe046bfaf0d60bc970e3e5d`. 45.6M pre / 311.8M post, 144 primary ROIs.
* **Skeleton and `somaLocation` coordinates are in 8 nm voxel units**, not nanometres.
  `voxel_size_nm()` converts at fetch time — everything downstream is true nm.
* `heal_skeleton` invents straight segments between disconnected fragments. Disabled.
  We keep the largest connected component and report fragmentation.
* Laterality lives in **two** fields: `rootSide` for peripheral sensory neurons,
  `somaSide` for central/optic neurons. Queries coalesce them.
* Real sensory annotations exist as `class`: visual, olfactory, gustatory,
  mechanosensory(+_tactile/_proprioceptive), thermosensory, hygrosensory; and as
  `subclass`: auditory, wind_gravity, chordotonal organ, taste bristle, …
* ORNs are typed by glomerulus (`ORN_DM1` …), TRN/HRN by VP glomerulus.
* Named descending neurons all present with L/R: DNp01 (giant fibre), DNp02/03/04/06/09/11,
  DNa01, DNa02, MDN, pIP10, DNg100. Proboscis motor neurons: MN9, MN11D/V, MN12D.
* RDP simplification cannot reduce a strand below 2 vertices, so **twig count**, not node
  spacing, drives geometry size. Size-adaptive `prune_twigs` is what keeps bundles small.

## Scene coordinate frame

Dataset axes: **+X = the fly's left, −Y = dorsal, −Z = anterior.**
The scene wraps real data in `rotation={[Math.PI, 0, 0]}` so screen convention is
+Y up, +Z forward (toward the head).

**The schematic fly body is authored directly in screen frame and must stay OUTSIDE
that rotated group** — nesting it double-transforms and puts the brain in the thorax.

Circuit and anatomy bundles have different local origins; both record `origin_nm`,
and `useSceneData` uses the difference to align them exactly.

## Regenerating data

```bash
cd backend
.venv/bin/python -m scripts.verify_connection
.venv/bin/python -m scripts.build_circuit --seeds-per-set 60 --hops 4 --max-nodes 5200 --render-limit 1200
.venv/bin/python -m scripts.fetch_anatomy --cell-um 6.0
```

## Running

```bash
cd backend && .venv/bin/python -m uvicorn app.main:app --port 8000
cd frontend && npm run dev          # http://localhost:5173
```

## Next up

1. **Visual pass** — the scene is currently too dim and badly framed. Camera poses
   need re-composition, bloom/exposure need lifting, and the neuron network needs to
   read clearly against the body shell.
2. Verify the full simulate flow on screen (fly → head → cascade → response) and time
   it against the 30-second demo beats.
3. Inspector drawer: provenance, evidence per mapping, NT coverage, lesion tool.
4. README with dataset attribution, real-vs-modelled table, citations, limitations.
5. Consider seeding more LC4/LPLC2 so DNp01 clears the engagement threshold — it fires
   at step 1 but peaks just under it.
