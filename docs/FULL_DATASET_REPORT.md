# Full MaleCNS dataset expansion — 13 September 2026

The application now loads the complete annotated neuron graph from the official MaleCNS v1.0 bulk export. It no longer uses the 4,279-neuron extracted circuit for simulation or search.

| Coverage | Before | Now |
| --- | ---: | ---: |
| Graph neurons | 4,279 | 166,700 |
| Directed neuron-to-neuron connections | 86,574 | 25,582,938 |
| Synapses represented by those connections | — | 124,177,617 |
| R1–R6 luminance input population | 120 | 3,377 |
| Measured soma positions in full catalogue | — | 139,662 |
| Default outgoing connection cap | 16 | None |
| Default minimum connection weight | 4 | 1 |

## Source and exact inclusion rule

Source: [official MaleCNS downloads](https://male-cns.janelia.org/download/), `v1.0/connectome-data/flat-connectome` on Janelia's public Google Cloud bucket. Four official Feather tables are downloaded: body annotations, neurotransmitters, body statistics, and connection weights. Downloads passed server MD5 validation; SHA-256 checks are recorded and checked before building. Compiled array hashes are checked when the server loads the graph.

The annotation table contains 211,577 records. All 166,700 records with an annotated superclass are included, including neurons without surviving neuron-to-neuron edges and neurons whose tracing status is not `Traced`. The other 44,877 annotations include glia and unclassified segments; they are not silently promoted to neurons. The raw source files remain preserved locally.

The connection source contains 151,856,684 rows, including connections involving unclassified segmentation fragments. Every row with both endpoints in the annotated neuron catalogue is retained, with its exact original weight. This yields 25,582,938 directed connections; 126,273,746 rows involving endpoints outside that catalogue are excluded. No fanout, hop-expansion or weak-edge cutoff is applied during construction. The official export itself uses synapse confidence ≥0.5; this is not a claim to use lower-confidence detections.

An independent Arrow membership-filter audit compared every compiled edge's source, target and weight against the official table, in order: all 25,582,938 matched, with none omitted.

## Runtime use and display

All 166,700 neurons participate in the model state, and all 25,582,938 connections are available to the default propagation calculation and weight normalization. Only neurons driven by an input or downstream activity become active. Existing sensory ontology constraints are preserved, but all matching neurons are now seeded without population caps. Unlocalized inputs also include annotated populations with unknown/midline laterality; explicitly left/right inputs do not fall back to the opposite side.

All IDs are searchable and eligible for source skeleton retrieval. Incident-connection inspection reads the full graph and supports pagination. Full detail is fetched on demand and preserves the supplied SWC nodes and parent links. An unavailable source skeleton is reported as unavailable; no substitute geometry is invented.

All 139,662 supplied `somaLocation` positions are rendered in the overview using the dataset's 8-nm voxel scale and the existing scene transform. Their highlights follow recorded model states. The remaining 27,038 neurons have no supplied soma location, so no cell-body position is fabricated for them. Brain-only view still clips away the VNC; the full CNS remains in the graph.

The existing 1,498 circuit skeletons and 4,200 context skeletons remain sampled overview geometry, with overlap. Full branch geometry for 166,700 neurons is **not** resident in browser memory simultaneously. Selecting a neuron requests its complete available skeleton. This is full graph coverage with streamed morphology, not a claim that every branch is displayed at once.

The visual pulse-event list remains limited to 12,000 significant transmissions per run. This limit does not affect propagation, activation histories, connection counts or synapse totals; omitted event counts are exposed in the API and timeline. Signal timing, neurotransmitter signs and behavioral readouts remain simplified modeling assumptions, not validated biological predictions.

## Verification

- 40 backend tests passed, including full coverage counts and a test proving visual pulse limits do not alter the simulation.
- Production frontend build passed. Lint completed with existing Three.js/hooks warnings; the existing large-bundle warning remains.
- Live API reports the full graph. “All lights in the room turn off” seeds 3,377 R1–R6 neurons, reaches 8,538 model neurons and traverses 389,084 unique connections over the default six steps; output remains “No defensible behavioural prediction.” API turnaround was about 1.05 seconds locally, not a cross-device guarantee.
- Neuron 10013 (MBON01), absent from the prior graph, loaded from neuPrint: 5,047 source nodes, 5,046 parent edges, zero dropped nodes and zero invented edges.
- Browser verification covers full-catalogue search, source detail rendering and simulation. No maze or unrelated UI feature was added.

## Reproduce

From `backend/`, after installing project dependencies:

```sh
.venv/bin/python -m scripts.download_full_dataset
.venv/bin/python -m scripts.build_full_dataset
HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 .venv/bin/python -m pytest -q
```

Existing overview bundles must be built first using the README setup. The full loader fails explicitly if its artifacts are missing or corrupt; it does not fall back to the old subset. Generated tables and arrays live in ignored `data/full-cns/`; rebuilding or copying them is necessary on another machine. Live skeleton retrieval still requires the existing neuPrint configuration.

Raw electron-microscopy imagery, every synapse's spatial location, unclassified segmentation fragments, and all skeleton files have **not** been downloaded or modeled. “Full” here means the complete annotated neuron catalogue and all connections between those neurons in the stated official export, not every byte of the research archive or a complete functioning biological fly.
