# Live input audit

20 inputs tested through the running HTTP API using Gemini interpretation and the full annotated graph. These are software outputs, not biological validation. No API failures or local-parser fallbacks occurred.

API interpretation + simulation: median 2.41 s; range 1.54–4.65 s. Playback is additional.

| Input | Output category | Displayed outcome | Neurons reached |
|---|---|---|---:|
| Something repeatedly touches the fly’s left antenna. | Modeled action | Antennal grooming tendency (modeled) | 207 |
| Something touches its antenna. | Partial markers; action unresolved | Neural response · movement unresolved | 340 |
| A dark object rapidly expands in front of the fly. | Modeled action | Escape takeoff tendency (modeled) | 826 |
| The fly tastes sugar with its mouthparts. | Sensory activity; action unresolved | Taste on the labellum response | 511 |
| The fly smells ripe banana. | Sensory activity; action unresolved | Ripe / fermenting fruit odour response | 2,505 |
| The lights repeatedly turn on and off. | Sensory activity; action unresolved | Repeated visual response | 14,287 |
| All the lights in the room turn off. | Sensory activity; action unresolved | Light-change response | 8,827 |
| Raindrops repeatedly hit the fly’s body in humid air. | Sensory activity; action unresolved | Body / leg touch + Humidity change response | 6,225 |
| A female fly approaches to mate. | Partial markers; action unresolved | Neural response · movement unresolved | 25,479 |
| Two flies approach while it is eating sugar. | Partial markers; action unresolved | Neural response · movement unresolved | 24,931 |
| The fly hears a courtship song. | Sensory activity; action unresolved | Vibration / sound response | 242 |
| A breeze blows across its antennae. | Sensory activity; action unresolved | Airflow / gravity response | 1,442 |
| The air around the fly suddenly becomes hot. | Sensory activity; action unresolved | Temperature change response | 176 |
| The temperature suddenly drops around the fly. | Sensory activity; action unresolved | Temperature change response | 176 |
| The fly is held in a hand. | Sensory activity; action unresolved | Body / leg touch response | 6,095 |
| The fly is captured in a jar. | No supported present input | Situation recognized · sensory details needed | 0 |
| Nothing touches its antenna and there is no sound. | No supported present input | Situation recognized · sensory details needed | 0 |
| What if it started raining tomorrow? | No supported present input | Situation recognized · sensory details needed | 0 |
| The fly remembers where it found sugar yesterday. | No supported present input | Situation recognized · sensory details needed | 0 |
| It smells ripe fruit while something repeatedly touches its left antenna. | Modeled action | Antennal grooming tendency (modeled) | 2,714 |

## Readiness verdict

Ready for a scoped experimental connectome demo. Not ready as a general fly-behavior predictor: only 3/20 tested inputs produced an action hypothesis, covering grooming and escape. Thirteen produced neural activity without a resolved action. Four descriptions supplied no supported present cue (jar without specified contact, absent stimulus, hypothetical rain, and recalled sugar).

Heat and cold currently map to the same broad temperature input and both reach 176 neurons: this model does not distinguish warm/cold selectivity. Activity alone is not behavioral validation.

## Browser checks

A separate mixed smell + repeated antenna touch run produced a grooming hypothesis with 2,714 reached neurons. Mint-green olfactory and amber tactile activity were visibly distinct. ORN_VA2 (18147) opened verified full source geometry with its odor-sensing role and explicit input-selection explanation. Additional downstream/output checks are recorded in PROGRESS.md.

The audit found and fixed two presentation problems: the legend now shows the actual modalities in the current run, and the viewer toolbar no longer overlaps the neuron card header. The explanation now has an explicit “Why it is highlighted” heading; downstream cells cite an actual recorded incoming signal when available. Exact type-specific function remains unknown for some cells; the app retains that limitation.

Raw results: [input-audit.json](input-audit.json).
