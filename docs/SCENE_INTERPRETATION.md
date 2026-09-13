# Situation interpretation — first implementation

This is a bounded, local scenario layer on top of the existing semantic sensory compiler. It is not a general-purpose biological predictor or a new trained model. The original words, inferred cues, assumptions and remaining gaps are returned separately and displayed in the UI. Inferred cues carry approximate mapping quality and capped heuristic confidence; motor neurons are never seeded because an action word appeared.

Current scenarios:

- Social approach with mating/aggression context: visible movement is assumed, not looming threat or a specific pheromone. Courtship and aggression are not directly forced on. A social intention without a sensory cue requests more detail.
- Rain: exposed conditions imply repeated body contact and sustained humidity. Mentioned shelter/enclosures suppress that assumption. Wind, temperature and light changes are not automatically added.
- Capture: physical restraint implies sustained body contact. An enclosure without contact produces a targeted question instead. Collision mechanics and escape success are not modeled.

At the current defaults, “another fly comes to mate” reaches 20,785 model neurons through visual input, “it starts raining” reaches 6,225, and “the fly is captured” reaches 6,095. These examples produce sensory responses, not validated mating, rain-avoidance or escape predictions. “Captured in a jar” does not fabricate contact and asks whether the fly is physically held/touching something or only enclosed.

The scene rules do not model continuous neural state, synaptic learning, general behavior selection or the maze controller. Those remain separate unfinished work. Unsupported language remains possible. Negated/hypothetical scenes are not expanded by these rules; the underlying compiler retains its existing conservative negation handling.

Validation: 51 backend tests pass, including cue composition, disclosed assumptions, no forced sexual/escape output, enclosure/shelter distinctions, and preservation of explicit cues in separate clauses. Production build passes.

Browser verification confirmed the social-encounter assumptions are visible during playback with no runtime errors.
