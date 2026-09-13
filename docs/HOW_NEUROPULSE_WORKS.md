# Explaining NEUROPULSE

## A 30-second explanation

“I built an interactive explorer of a real male fruit-fly connectome. Gemini interprets a written situation into supported sensory cues. Python selects real annotated neurons and propagates simplified activity through the measured wiring. A literature-based readout checks selected action-associated neurons, while a 3D interface shows the source anatomy and calculated activity. It is an experimental connectome simulation, not a validated digital fly.”

## The parts of the product

| Layer | What we use | What it does |
|---|---|---|
| Interface | React, TypeScript, Vite, Zustand | Inputs, results, state and controls |
| 3D | Three.js, React Three Fiber, GLSL shaders | Renders dataset skeletons, measured somata and simulated activity |
| UI motion | Framer Motion, Paper Shaders | Transitions and decorative backgrounds; not brain signals |
| API | Python, FastAPI, Pydantic, Uvicorn | Validates requests and serves computation/data |
| Network calculations | NumPy and SciPy sparse matrices | Propagates activity through the full annotated graph |
| Source data | MaleCNS v1.0, neuPrint / neuprint-python | Annotated neurons, synaptic connectivity and source skeletons |
| Language AI | Optional Google Gemini; local sentence-transformer/lexical fallback | Extracts sensory cues; never invents neuron IDs or chooses the action |
| Action interpretation | Curated Python readouts | Checks activity in literature-associated cell types using explicit model thresholds |

We did not train a new biological brain model or a behavioral predictor. Gemini is a pretrained LLM. The propagation dynamics, timing, thresholds and readout rules are our modeling choices. Retained neural state is not learned biological memory.

## The fly brain, briefly

| Structure | Broad biological role | What our app does |
|---|---|---|
| Optic lobes | Process visual information from the eyes | Supports selected motion, looming and light-change populations; no complete retina or visual scene |
| Antennal lobes | Early odor processing | Maps selected odor cues to annotated sensory populations |
| Mushroom bodies | Major circuits for associative learning and memory | Wiring is present; biological learning has not been implemented |
| Central complex | Orientation and navigation-related processing | Wiring is present; no validated navigation controller |
| Gnathal/subesophageal regions | Include important taste and feeding-related circuits | Broad taste inputs; MN9 feeding-initiation readout |
| Descending neurons and ventral nerve cord | Link brain signals to body-control circuitry | Selected output markers; no physical body or full motor controller |

Sources: [MaleCNS](https://male-cns.janelia.org/), [optic lobes](https://www.janelia.org/project-team/flyem/optic-lobe), [mushroom bodies](https://www.janelia.org/lab/rubin-lab/our-research/anatomical-and-behavioral-analyses-brain-areas/learning-and-memory), [central complex](https://www.janelia.org/publication/feature-detection-and-orientation-tuning-drosophila-central-complex), [feeding-model paper](https://www.nature.com/articles/s41586-024-07763-9).

## Numbers and claims

166,700 annotated neurons and 25,582,938 directed edges are in the graph. The 3D overview uses sampled skeletons; selecting an individual cell requests its full supplied source skeleton. All graph nodes being present does not mean every biological function is implemented.

Colors represent source cell identity or the modeled sensory stream—not recorded firing. Moving fronts illustrate propagation; their within-cell direction and speed are presentation choices.

Say “real connectome anatomy with experimental simulated activity.” Do not say “we recreated a living fly brain,” “90% accurate,” or “the AI knows the correct response to any situation.”
