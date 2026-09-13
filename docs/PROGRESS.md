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


## Pixel maze learning lab

Added five progressively larger mazes, procedural pixel fly/environment, temporary throwable obstacles, visible trials, accelerated Q-learning, separate persisted maze memories, nonlearning evaluation and measured progress charts. The full real brain displays modeled sensory responses to game events; route learning is explicitly a separate controller. Engine tests verify all five agents learn shortest routes after 500 trials and evaluation preserves learned values. No biological-learning claim. The maze was subsequently removed; see the removal entry below.


### Understandable learning and sensory explanations

Added saved untrained baseline replay, comparable learned tests, dead-end markers and backtrack counters, lifetime completed-attempt totals and 10/50/200-attempt batches. Added What’s happening? with actual controller reasons, recent decisions, source-derived sensory input groups/types and per-step real-neuron counts. The first-maze browser comparison improved from 70 steps/32 backtracks to 12/0 after 50 learning attempts. Four engine tests cover all-maze convergence, replay path validity, retained baselines and lifetime counters.


## Sensory interpretation and response repair

Fixed silently dropped approach clauses and single-pulse handling of repeated/ongoing input. Explicit schedules now drive propagation and remain excluded for silenced cells. The approach-plus-sugar example reaches both DNp01 markers under unchanged criteria; repeated lights report the actual visual response with unresolved action. Added real output-marker evidence and input-specific limitations, per-component representative neurons, and class-based plain-language descriptions with body IDs secondary. The untyped gustatory cell 104287023 now explains taste sensing without inventing its tastant preference. 45 backend and six frontend tests pass; production build passes. See RESPONSE_MODEL_AUDIT.md for exact examples and scientific limits.


## Grooming decoder and activity visibility

Added a research-linked antennal-grooming readout for matching MaleCNS DNg62/DNge011/DNge012/DNge078 types. Single touch reaches six of eight monitored cells below the action threshold; repeated touch meets the unchanged criterion. Silencing the reached markers removes engagement. Partial output activity now identifies the responding action circuit without pretending its movement is confirmed. No-input runs skip playback and remove fake completion/chart/replay. Added source-position soma halos, modality colors, a display-only contrast curve and visibility slider. Browser verified repeated-touch output, active rendering and unsupported-input behavior without runtime errors; production build, 46 backend tests and six frontend tests pass. Large-bundle and existing Three.js mutation lint warnings remain. The maze still uses Q-learning; biological-learning replacement is explicitly unfinished (BIOLOGICAL_LEARNING_STATUS.md).

## First situation-interpretation layer

Added bounded rain, capture and social-encounter decomposition, with original text, explicit assumptions, approximate input quality and missing context surfaced in the UI and result evidence. Social approach maps to visible motion, not automatic escape or direct mating activation. Enclosures and shelter avoid invented contact. Recognized scenes with no defensible input now ask a specific sensory-context question. 51 backend tests and production build pass. This is not a general biological predictor or a connectome-learning maze replacement; see SCENE_INTERPRETATION.md.


## Maze removed

Removed the maze entry point, five-maze interface, pixel renderer, Q-learning engine, decision explanations, styles, maze tests and user guide at the project owner’s request. The explorer is now the only product flow. Earlier maze entries above are historical, not current capabilities. Existing connectome data and sensory simulation remain intact.


## Optional neural state continuity and system coverage

Added default fresh runs and opt-in continuous-state sequences with six-event history, reset and no-input settling. Full activity and refractory arrays persist, source weights do not learn. Added disjoint class/superclass recruitment summaries accounting for all 166,700 neurons, including memory-related, central-complex and modulatory groups without inventing functional activity. Tests verify uninterrupted/split-state equality, isolated fresh runs, decay and exact group totals. 55 backend tests, two frontend tests and production build pass; see NEURAL_STATE_MODES.md.

## Optional AI interpretation and clearer source branches

Added opt-in server-side structured scene interpretation, fixed-ontology validation, visible local fallback and signed event receipts for stable sequences. No API key is configured: live model quality remains untested. Added anatomical branch ribbons, shaded measured-position soma sprites, branch-focus/all-somata toggle, and activation overlays on additional real overview skeletons. No invented geometry paths or extra model firings. See AI_INTERPRETATION.md and ANATOMICAL_RENDERING.md. Backend: 64 tests passing; frontend: 2 tests passing.

Interpreter provider changed to Google Gemini at the user’s request. OpenAI transport/configuration removed. AI Studio free-tier project verified, but Google rejected automated key creation as suspicious; awaiting manual creation. No billing enabled and no existing unrelated key reused.

The user manually completed Gemini key creation. Stored the dedicated key in ignored backend configuration, verified the project remains Free tier, and passed five live interpretation checks. Gemini is the configured default, Local remains selectable. The Gemini migration passes 64 backend tests and the frontend build.

Gemini browser flow verified to completion: left-feeler brush paraphrase → repeated left-antennal input → 207 reached real neurons / 37,408 connections → modeled antennal grooming.

## Demo-readiness pass

Made session settings compact so input remains visible; show computed outcomes during playback, add plain-language action explanations, final-activity skip, revise-input controls and Markdown/JSON run exports. Added eight selectable demo scenarios and made the brain the initial view. Found and fixed a live Gemini omission for held-in-hand contact using explicit instruction plus a bounded reviewed-scene fallback; absent/hypothetical/enclosure-only cases remain unstimulated. 67 backend and four frontend tests pass. Five full-graph live demo checks recorded in demo-live-check.json. Added DEMO_AND_POST.md; no public deployment or social publication performed.

Final browser demo verified: Gemini preset → plain-language grooming result during playback; orbit does not open inspection; final-activity skip and Markdown download work. Downloaded report copied to docs/demo-run.md after verifying counts, result and scientific boundaries.

### Playback and partial-action correction — 2026-09-13
- Partial output-marker activity now headlines “Neural response · movement unresolved”; actual marker counts remain in evidence. No forced courtship or escape output.
- Display timing reduced from 2.8 to 0.85 seconds/state, transition from 1600 to 250 ms. Model computation and source geometry unchanged.
- Camera ownership transfers once per manual session; repeated scroll/drag no longer resets the orbit pivot.
- Context ribbons clip crossing segments before perspective division and no longer write transparent depth. Reduced soma halo overlap and capped sprite footprint; invisible halo sprites are rejected before rasterization.
- Settled GPU state uploads occur once; expensive development geometry scans require ?debugScene. DPR capped at 1.5, redundant postprocessing MSAA removed, bloom reduced.
- Verification: production build, 4 frontend tests, 13 targeted backend tests pass. Browser anatomy renders successfully. No FPS guarantee or claim of biologically measured signal timing.
- Live browser check of the exact female-approach input retained 25,479 reached cells and the 2/8, 0.043 avoidance marker evidence, with the corrected unresolved-movement headline. Orbit and zoom checked; drag did not open the inspector. Removed additive soma blending and static-summary flare after visually observing white saturation. Smoothness is not yet quantitatively benchmarked across devices.

### UI simplification — 2026-09-13
- Removed the sci-fi glow control, disabled cinematic styling by default, and removed bloom plus animated background layers. Dataset activity colors remain.
- Results lead with one headline and plain-language explanation; evidence is expandable. New experience, replay, edit and export precede optional timeline/system/input detail. Sequence actions remain outside the detail disclosure.
- Labeled Reset view / Explore data / Display toolbar stays readable at narrow breakpoints. Display groups region labels, cell-body visibility and contrast.
- Added restrained translucent glass surfaces, clear focus states and reduced-motion-aware result entrance.
- Verified an antenna-input result in the browser with primary actions visible; production build, 4 frontend tests and targeted lint passed. Biological computation unchanged.

### Editorial visual direction — 2026-09-13
- Added editorial.css: ink/olive surfaces, champagne accents, serif display typography, fine rules and restrained translucent controls. Scientific anatomy/activity colors unchanged.
- Replaced pill-like examples with numbered rows and subtle hover arrows; revised hero and atlas headings. Removed unused input border-beam markup; input entrance respects reduced motion.
- Desktop browser visual check confirms new typography, warm palette and labeled controls. Production build and frontend checks run for the presentation-only change.

### Ambient shaders and source-branch entrance — 2026-09-13
- Restored NeuroNoise in the intro with champagne/olive colors; added GrainGradient as masked viewer edge atmosphere. Paper components match shader families reviewed on 21st.dev; source/provenance in SHADER_ART_DIRECTION.md.
- Added animated indeterminate loader tied to real data availability. Added a 2.6-second GPU reveal along the existing normalized cable coordinates in primary/context skeletons, plus soma/surface fade. Interaction or a simulation skips the entrance; no new geometry, firing events or model-state changes.
- Two decorative shader canvases are lazy loaded and pixel-budgeted; hidden-page animation pauses and reduced-motion uses static frames. No sci-fi glow toggle reintroduced.
- Browser reload checked loading state, restored neural ambience and completed source anatomy. Production build, 4 frontend tests and targeted lint pass. Frame rate across devices remains unbenchmarked.

### 20-input readiness audit — 2026-09-13
- Ran 20 live HTTP interpretation/simulation cases, all using Gemini with no fallback or API failure. Results: 3 behavioral-marker outputs, 3 partial-marker outputs, 10 sensory-only outputs, 4 no-input outputs. Median API time 2.41s; playback additional. Full cases in INPUT_AUDIT.md and input-audit.json.
- Browser mixed smell/touch run: visibly distinct mint and amber activity. Clicked ORN_VA2 18147 (odor input), VM2_adPN 14665 (relay), DNge078 36541 (grooming output); all three reached SOURCE GEOMETRY VERIFIED and displayed plain-language roles and run-specific highlight reasons. Relay function remained broad central-brain annotation; no specific function invented.
- Added explicit “Why it is highlighted” heading and incoming recorded signal citation when present. DNge078 displayed incoming neuron 65635 at step 1. Regression test excludes later/fabricated incoming events.
- Fixed legend to use actual run modalities and shader palette; moved viewer toolbar away from neuron-card close button. Production build, targeted lint and 5 frontend tests passed.
- Verdict: scoped research/demo explorer ready; not general behavior-prediction ready. Heat/cold share the broad thermal input; 13/20 cases respond neurally without an action hypothesis. No biological validation claimed.
