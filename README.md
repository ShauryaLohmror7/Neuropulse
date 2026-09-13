# NEUROPULSE

Give a biological brain an experience. Explore real MaleCNS v1.0 anatomy and a clearly labeled, connectome-constrained propagation model.

## Run locally

The current workspace includes prepared overview bundles in `frontend/public/circuits/` and the full graph in `data/full-cns/`. On another machine, follow the [full dataset rebuild instructions](docs/FULL_DATASET_REPORT.md#reproduce).

```sh
# Terminal 1, from the repository root
cd backend
HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 .venv/bin/python -m uvicorn app.main:app --port 8000
```

```sh
# Terminal 2, from the repository root
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. Offline flags use the already downloaded semantic model; omit them on a first installation when model downloads are needed. The backend dependencies are in `backend/pyproject.toml`. Copy the appropriate `.env.example` when configuring a new environment; never commit tokens.

The browser uses `http://127.0.0.1:8000/api` by default. Set `VITE_API_BASE` for another backend. The local CORS configuration permits the frontend on port 5173.

## Explore

- Start in Fly View: the shell is contextual artwork, with real reconstructed CNS geometry registered inside it.
- Switch to Brain View to inspect dense real skeletons and measured anatomical region surfaces.
- Drag to orbit, scroll to zoom, and use **Reset view** to restore framing.
- Enter an arbitrary English experience, choose a preset, or use Ctrl/Cmd+Enter to simulate.
- Watch the sensory interpretation, then modeled activity moving over fixed real skeletons. Blue denotes visual activity; green denotes olfactory activity. Other modalities retain their own legend colors in the interpretation panel.
- The result distinguishes modeled active neurons from the subset with rendered morphology. Pathway cards focus real input/output neurons where available.
- Open **Inspect data** to search by cell type/body ID and inspect annotations and connections. Only explicit buttons open this dialog; clicking or dragging the scene never does.
- Choose **Explore one real neuron**, a pathway card, or **Load full-detail neuron** in the inspector to fetch the unpruned source skeleton. Switch between brain context and solo framing.
- **What is real?** explains reconstruction, inference, uncertainties and source provenance. Escape closes the dialog.

## What is real, modeled, or contextual?

| Layer | Origin and limits |
| --- | --- |
| Neuron identity, cell type and sidedness | Official MaleCNS v1.0 bulk annotations |
| Connectivity and synapse counts | All 25,582,938 connections between the 166,700 annotated neurons in the official minconf-0.5 export |
| Morphology | Overview uses real, pruned/simplified skeletons. Selected full-detail view preserves every original node and parent edge returned by neuPrint, including disconnected components |
| Anatomical regions | Dataset ROI meshes, decimated for browser rendering |
| Resting colors | Visual identity cues, not measurements of activity or neurotransmitter |
| Sensory interpretation | Local sentence-transformer retrieval plus deterministic constraints; matches can be approximate or unsupported |
| Activation | Simplified propagation over real connectivity, with model parameters, refractory behavior and available neurotransmitter predictions |
| Moving fronts | Illustrative root-based cable-distance visualization. Each arbor is paced to a display step; speed and direction are not measured conduction or synaptic contact locations |
| Response | Thresholded readout of annotated output markers and the existing literature registry; an inferred tendency, not observed behavior |
| Fly body | Procedural contextual shell, not an EM reconstruction or validated biomechanical model |

This is **not a perfect electrophysiological recreation of a living fly**. Inputs are currently injected together; narrative event timing is not reconstructed. Similarity scores are heuristic, not calibrated biological probabilities. Food proximity alone does not establish an odor stimulus. Abstract cognition is not assigned an invented neural pathway.

The response registry's evidence tiers describe the supporting marker literature, not probabilities that a real fly will act. Anatomical lateral activation is reported in the raw readout but is not converted to a behavioral turn direction. Subthreshold output activity does not establish a response.

## Architecture and data

- `backend/app/connectome`: neuPrint access, provenance, caching, skeleton processing, circuit extraction and binary serialization.
- `backend/app/experience`: semantic retrieval, clause parsing, ontology and real population mappings.
- `backend/app/simulation`: graph dynamics, lesion comparisons and output readout.
- `backend/app/api`: cached circuit/index state and FastAPI endpoints.
- `frontend/src/lib/circuit.ts`: batched real skeleton geometry and GPU state texture.
- `frontend/src/components/brain`: anatomy, contextual fly, cameras, skeleton activation shaders.
- `frontend/src/components/ScientificInspector.tsx`: scientific limitations, evidence and neuron inspection.

Current prepared data: **166,700 annotated neurons**, **25,582,938 directed connections** and **124,177,617 synapses** from the official MaleCNS v1.0 minconf-0.5 tables. The default model uses all these connections, including weight-1 edges, with no fanout or sensory-population cap. The overview displays **139,662 measured cell bodies**, with 1,498 circuit and 4,200 sampled context skeletons; detailed source skeletons load on selection for any catalogue ID. Missing source morphology remains explicitly unavailable. See [full dataset report](docs/FULL_DATASET_REPORT.md) for exact scope and rebuild instructions.

Bundles retain transforms and provenance. Binary vertices store x/y/z plus geodesic distance. Unconnected fragments are never joined by invented bridges; preprocessing keeps and reports the largest connected component. Short twigs may be pruned. Original cached skeletons remain separate from display LOD.

Full-detail endpoints `/api/neurons/{bodyId}/detail` and `/detail.bin` fetch the original skeleton with healing disabled. They verify dataset UUID and explicit voxel units, retain all components, reject invalid forests, and cache a SHA-256 checked binary. The browser verifies the binary hash and shared coordinate transform before rendering. Node coordinates/radii use float32 µm and parent edges use uint32 indices; encoding error is reported separately from biological reconstruction uncertainty. For verified body 19034, all 2,816 source nodes and 2,815 parent edges are retained (maximum coordinate encoding error 0.0152 nm). Source skeletons remain dataset reconstructions, not full neuron surface meshes. Uncached detail requires a configured neuPrint token and network access; failure is displayed without fabricated geometry.

Playback uses the actual per-neuron activation history and recorded source emission steps, covering every returned model state rather than stopping at the final first activation. The timeline reports above-threshold counts for each state. Root-distance fronts are artistic interpolation of model events, not measured spikes, contact locations, or conduction velocities. Once complete, a static peak-activity summary remains visible until reset or replay.

Regenerate with a valid neuPrint token, following the script help and notes in `docs/PROGRESS.md`. This can fetch substantial data:

```sh
cd backend
.venv/bin/python -m scripts.verify_connection
.venv/bin/python -m scripts.build_circuit --help
.venv/bin/python -m scripts.build_context --help
.venv/bin/python -m scripts.fetch_anatomy --help
```

## Verification

```sh
# From repository root; offline flags avoid unnecessary model-server checks
HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 backend/.venv/bin/python -m pytest backend/tests -q
npm --prefix frontend run lint
npm --prefix frontend run build
```

The September 13 full-detail and playback pass passed **38 backend tests**, including guards against converting food proximity into odor and anatomical sidedness into a predicted turn. TypeScript and the production build passed. Lint completes with remaining Three.js mutation/legacy hook warnings; the build still warns about the large WebGL bundle.

Browser verification includes both views, multimodal simulation, replay, neuron selection, scientific dialog, and narrow viewport framing. A local 120-frame resting sample measured about **16.6 ms/frame**; this is a local observation, not a cross-device performance guarantee. Prepared scene assets total about 19 MB uncompressed. Independent assets load concurrently, and a page-lifetime scene promise prevents StrictMode duplicate decoding. Full scene geometry is batched rather than one draw call per neuron.

## Attribution

Real dataset: [Male CNS Connectome Project](https://male-cns.janelia.org/), Janelia FlyEM and collaborators. Data served through [neuPrint](https://neuprint.janelia.org/), dataset **`male-cns:v1.0`**. The project page identifies the dataset as CC-BY and links release notes, the paper and downloads. Preserve original per-bundle provenance, source queries, fetch dates and dataset attribution when sharing derived assets.

Behavioral associations remain in `backend/app/simulation/response.py`; sensory evidence is in `backend/app/experience/ontology.py`. These existing literature mappings are not a comprehensive new review of fly behavior.
