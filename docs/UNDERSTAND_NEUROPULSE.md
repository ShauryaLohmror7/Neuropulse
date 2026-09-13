# Understanding NEUROPULSE

NEUROPULSE lets you explore real fruit-fly wiring and watch a simplified model respond to a written sensory scenario.

## Whose brain is this?

The anatomy comes from the MaleCNS research collaboration, not from an AI-generated brain image. Researchers reconstructed neurons from electron microscopy. Their dataset supplies neuron IDs, shapes, annotations, and connections. We built software that retrieves, prepares and renders that geometry, with our own interface, cameras, colors and signal shaders. The outer fly body is contextual artwork.

The full dataset contains approximately **166,700 neurons across the brain and ventral nerve cord**. Our app uses `male-cns:v1.0`, the latest release listed as of September 13, 2026 (released June 8, 2026).

- **166,700 annotated neurons** and **25,582,938 directed connections** in the full loaded model graph.
- **1,498 circuit skeletons** displayed in the overview.
- **4,200 context skeletons**, sampled to show surrounding anatomy.
- These skeleton overview subsets overlap. All 139,662 supplied soma positions are displayed; all annotated neuron IDs are searchable and their source skeletons can be requested on demand. Graph computation uses the full annotated neuron graph.
- Full-detail selection preserves every node and parent link supplied for that individual skeleton, including disconnected components. It does not repair missing biological reconstruction.

Sources: [release notes](https://male-cns.janelia.org/release/), [dataset scope and images](https://male-cns.janelia.org/media/), [available geometry and data](https://male-cns.janelia.org/download/).

## What happens after I type?

1. **Interpret words.** A pretrained MiniLM sentence-embedding model matches clauses to a curated sensory vocabulary. We did not train a new biological brain model. Unsupported content is reported rather than assigned invented neurons.
2. **Choose inputs.** Each supported concept has real neuron IDs collected from dataset annotations. Explicit left/right words narrow the population. Otherwise both sides are selected when available. These are curated mappings, not observations of which individual cells respond.
3. **Calculate activity.** A deterministic graph model transmits activation along retained real connections, using connection weights, decay, thresholds and available neurotransmitter predictions. It computes normalized activity, not voltage or firing rates.
4. **Play the result.** Brightness follows recorded model states. Traveling fronts move along real cables, but their within-cell direction and speed are illustrative.
5. **Read possible action.** Annotated output populations are checked against model thresholds and existing behavioral associations. A suggested action is an inference, not validated behavior prediction.

## Your lights-off example

“All lights in the room turn off” maps to “Luminance change.” In the current default circuit it selects 3,377 real R1–R6 photoreceptor IDs and reaches 8,538 neurons in the model. No output channel clears its threshold, so the result is “No defensible behavioural prediction.” The model currently groups light increases and decreases together; it does not model the distinct electrical responses to lights switching on versus off.

## Reading the interface

- **Fly / Brain:** changes framing; dragging never opens the inspector.
- **Model playback:** the activity calculated at each discrete step.
- **Pathway summary:** a frozen view of each reached neuron's highest activity, so you can inspect it. Not ongoing firing.
- **Pathway cards:** example input, relay and output neurons from this particular run; not every reached cell.
- **Plain-language description:** a curated explanation of known cell types, with research links. Unknown functions are explicitly labeled.
- **Explore real neurons:** searches all 166,700 loaded IDs, showing up to 60 matches and prioritizing reached cells. “Anatomy” does not mean activated.
- **Full detail:** all original source nodes and cable links for one neuron; the count of source nodes is not a count of neurons.
- **Sci-fi glow:** changes styling only. Model values and anatomical coordinates stay identical.

## Describing your contribution publicly

A defensible description is: “I built an interactive explorer of real MaleCNS fly-neuron reconstructions, with natural-language sensory mapping, a connectome-constrained propagation demo, and explainable neuron inspection.” Credit the MaleCNS researchers for the data and the pretrained model authors for MiniLM.

Avoid claiming to have reconstructed the original brain, simulated all its neurons, recorded electrical activity, or accurately predicted arbitrary fly behavior.

## A useful next feature

**Compare two experiences:** display shared and differing modeled pathways for two prompts, with neuron counts, mapping explanations and output differences. For example, compare lights switching off with a looming object. This is a proposed next feature, not implemented in this pass.
