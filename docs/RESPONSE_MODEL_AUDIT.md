# Sensory interpretation and response audit

The complete annotated MaleCNS graph is loaded, but graph coverage and behavioral validity are different. The current system is a deterministic, simplified propagation model with a curated sensory compiler and eight literature-linked output channels. It is not a trained, validated decoder of arbitrary fly behavior.

## Repaired examples

`two flies approach while eating sugar` previously lost the approach clause silently. An explicit, disclosed approach-to-looming interpretation now retains that visual cue alongside the taste input. The ongoing eating cue is maintained at model steps 0–4, then released. In the regression run, 1,497 neurons were reached, including both DNp01 markers (peak 0.1464). Existing, unchanged output criteria report a modeled escape-takeoff tendency. The parser does not resolve two separate retinal objects or know their size/speed; that assumption is surfaced in the UI.

`lights repeatedly turn on and off` previously became a single pulse. It now schedules repeated generic light-change inputs at model steps 0, 2 and 4, followed by propagation through step 10. The regression run reaches 13,635 neurons. No monitored output marker crosses the activity threshold, so the result reports a repeated visual response with unresolved action, rather than implying no behavior occurs. This does not implement polarity-specific ON/OFF dynamics or measured flicker frequency. Three events and their spacing are explicit demonstration assumptions.

Single-input behavior remains unchanged unless the approach parser rule adds a previously missing interpretation. Rejected clauses are now surfaced even when candidate scores passed retrieval but failed later mapping checks. Input timing is visible in the decomposition panel and timeline. Scheduled drive is part of the actual calculation, not just an animation. Lesion runs filter scheduled input as well as initial input.

## Better explanations

Result cards show what the network actually reached, actual per-channel marker counts/peaks, the monitored output circuits, and input-specific limitations. A nonengaged output is not reported as evidence of doing nothing. Marker engagement criteria were not lowered to produce more dramatic results.

Neuron descriptions fall back to known class and superclass roles. For example, 104287023 is an untyped but gustatory-annotated neuron: the card explains taste sensing while retaining uncertainty about specific tastant preference. Body ID is a secondary identifier, and morphology counts are labeled as skeleton points/segments. Why the neuron was reached is shown directly. Representative pathway cards include inputs from each mapped component and preferentially select named cells; all real cells remain searchable.

The same sensory phrases can map to the same annotated populations. This is expected from the current broad sensory encoder and is explained in the UI. No random highlighting was introduced to create apparent variety.

## Research boundary

[Shiu et al., Nature 2024](https://www.nature.com/articles/s41586-024-07763-9) demonstrated a connectome-based leaky integrate-and-fire model with experimental validation for feeding and antennal-grooming circuits. Its identified taste inputs and validation are not automatically transferable to this MaleCNS application. [Connectome-constrained visual modeling](https://www.nature.com/articles/s41586-024-07939-3) likewise uses functional/task constraints to predict visual responses. NEUROPULSE has not reproduced either model's validation. A faithful general behavior predictor requires further sensory encoding, dynamical calibration and independent behavioral benchmarks—not simply importing more neurons or relabeling uncertain outputs.

Validation: 45 backend tests, six frontend engine/explanation tests, production build, and live browser/API checks. Model counts above are deterministic examples for the current defaults, not physiological measurements or calibrated probabilities.


## Antennal grooming and activity visibility

Added an eighth output channel for DNg62, DNge011, DNge012 and DNge078, with type-level functional support from [Distributed control circuits across a brain-and-cord connectome](https://www.nature.com/articles/s41586-026-10735-w). This is a cross-dataset functional association, not independent behavioral validation of this MaleCNS model. Eight matching neurons exist in this catalogue. A single antennal touch reaches six (10587, 12894, 14537, 15653, 36541, 524190), peak 0.0859; the result now identifies the partial grooming-circuit response. Repeated touch reaches the same six, peak 0.1437, and meets the unchanged action criteria. Silencing these reached markers removes grooming engagement. No simulation parameters or source connections were changed for this feature.

Any reached output channel below engagement criteria can now be described as a partial circuit response, while confidence remains NONE. Unsupported inputs skip playback and no longer show a fictitious pathway chart or “Propagation complete.”

The activity renderer applies a square-root display contrast curve, modality-colored soma halos and a 0.5–4× visibility control. Zero activity remains zero. Morphology fronts follow existing cable geometry; there are no new cells, repeated fake emissions or anatomical bridges. The settled summary remains static.
