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

## Visual handoff — 2026-09-13

Preserved the existing dirty working tree and real-data pipeline; no fresh scaffold.

### Audit and changes

- Backend and local semantic index work; 30 tests now pass offline. TypeScript/build pass; remaining lint warnings primarily concern Three.js mutations and legacy hooks.
- Fixed the central visibility bug: brain coordinates are negative Z in the aligned dataset frame. The previous clipping retained the posterior side. Context clipping now also accounts for the context bundle's separate origin.
- Replaced additive resting tissue blending with controlled normal blending/depth; reduced bloom and added readable inactive detail. Both modes use a dedicated viewport with correct mobile aspect framing.
- Corrected fly abdomen polarity, mirrored/swept broader wings and jointed leg chains. Removed the unsupported motor pose so the shell stays registered with the real CNS.
- Replaced sparse floating UI with an experience rail, large specimen stage, view tools, activity legend, live step-based counts, result explanation and scientific/identity inspector.
- Camera can focus selected real skeletons, via pathway cards, search or explicit detail buttons. Corrected dataset-to-camera centroid axis signs. Resting orbit is bounded; reduced-motion preferences disable idle orbit.
- Activation now waits for ignition and scales with modeled amplitude. Cable distance is normalized per arbor to fit a display step. React scheduling reads the renderer clock. Removed the centroid-arc particles from the scene because they were not measured anatomical routes.
- Real asset requests run concurrently; a shared promise prevents duplicate StrictMode fetching/geometry construction. Expensive whole-geometry debug scans are throttled and dev-only.
- Removed the unsupported conversion from marker sidedness to behavioral turn direction. Clarified no-prediction text for reached but subthreshold output markers.
- Browser testing exposed a semantic false positive for “sitting beside a banana”; an explicit odor-cue gate now prevents injecting an olfactory stimulus from proximity alone. Unsupported clauses remain visible even when other clauses map.

### Scope limits / next work

The dense view is 4,200 sampled context skeletons plus the 1,498-skeleton circuit subset, not the full connectome. Overview geometry remains pruned LOD; the subsequent full-detail pass below adds an unpruned source fetch. Temporal event scheduling, a fully choreographed 30-second recording mode, and a scientifically validated motor decoder remain future work. Existing literature-to-output mappings need a dedicated citation audit before broad behavioral claims. The browser JS bundle remains large; no cross-device benchmark claim is made.

Live checks: default multimodal prompt, scientific dialog/Escape, ID search/focus, real pathway cards, replay, narrow viewport and a local 120-frame sample (~16.6 ms/frame). See README for real/model/context boundaries.


## Full-detail and recorded activity — 2026-09-13

- Added unpruned per-body source forests, live UUID/unit verification, invalid-topology rejection, binary hashing, browser verification, cache, loading/error/retry states, and solo/context camera framing. All disconnected source components remain separate; no artificial bridges.
- Verified live bodies 19034 (2,816 nodes), 917516 (558 nodes, two components), 531898 (3,428 nodes), and 20859 (1,406 nodes). No dropped nodes or invented edges. LOD nodes for 19034 match full-source coordinates within float encoding precision.
- Removed all scene picking that opened the inspector. First drag now enables orbit controls before their event handler runs. Added a focal-plane micrometre scale.
- The simulation now returns actual per-step activation histories and source emission steps. Fixed playback completion: final first-crossing depth is not simulation duration. Timeline covers all returned states; settled view is explicitly a static peak summary.
- Added a prominent possible-action readout and explicit free-form-input scope. Biological accuracy of arbitrary text, electrical timing, and fly behavior is not claimed.
- 38 backend tests pass offline, including exact state-history recurrence and retained-edge/source identity checks; TypeScript/build pass. Lint has Three.js mutation and existing legacy warnings.
- Browser verified full-detail source failure/retry recovery, same-ID reselection, explicit inspector buttons, and orbit dragging with zero dialogs. Mobile at 390 px scrolls through all controls with no horizontal overflow. No browser runtime errors. Default scenario yields the inferred Escape takeoff readout; an unsupported abstract prompt maps zero populations, activates zero neurons, and reports no defensible prediction. Screenshots: `full-neuron.png`, `full-neuron-mobile.png`, and `recorded-activity.png` in `docs/screenshots/`.

## Plain-language explanations and cinematic display

Added curated, research-linked descriptions for R1–R6, LC4, LPLC2, T4/T5, DNp01 and DNp09. All other types get an explicit unresolved-function explanation using their actual annotation, plus their role in the current run. The same component appears in full detail and the scientific inspector. Added the light-change ON/OFF limitation to the sensory ontology and visible input breakdown. The full dataset and loaded-circuit counts are now separate in the inspector.

Added a sci-fi styling toggle, luminous shader cores and source-node highlights for recorded full-neuron events, a model-state readout, and a frame around the scene. No new anatomical edges or model events are invented. Reduced-motion preferences use static per-state shading for the new effects. Added `UNDERSTAND_NEUROPULSE.md` for the project owner. Comparison of two experiences remains a proposed feature.

Verified LC4 description/source link, full-detail loading, replay with source-node shader, no runtime errors, and 390px layout without horizontal overflow. Build passes; 38 backend tests pass. Existing lint warnings and large-bundle warning remain.

## 21st.dev component pass

Browsed 21st.dev and integrated Paper's open-source Neuro Noise shader (0.0.80), with a custom violet/mint palette, plus local border-beam and aurora components. Paid 21st export was not used; sources and licensing are in `UI_COMPONENT_SOURCES.md`. Decorations stay outside the anatomy layer and honor the cinematic toggle/reduced motion. Shader loading is separate, resolution-capped and visibility-aware. Build passes; existing Three.js lint warnings remain.
Browser verification: default simulation completed with its action readout; cinematic off removed the ambient shader canvas and aurora, and on restored them. Mobile width 390px has no horizontal overflow. No browser runtime errors. Screenshot: `docs/screenshots/21st-components.png`.


## Full dataset expansion — 13 September 2026

Replaced the runtime subset with all 166,700 annotated MaleCNS neurons, 25,582,938 connections and 124,177,617 represented synapses. Removed default population/fanout/weak-edge caps, added full-catalogue search and full-graph connection inspection, and rendered all 139,662 supplied soma positions with model-state activity. Source skeletons remain streamed on demand. Every graph edge was compared against the official bulk export; 40 tests and the frontend build passed. Browser verified new-neuron detail, full-model playback and drag behavior. No maze work. See [exact scope and reproduction](FULL_DATASET_REPORT.md).
