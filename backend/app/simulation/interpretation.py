"""Describe actual model results without converting missing evidence to 'no behavior'."""

from app.simulation.response import CHANNELS, ENGAGEMENT_ACTIVATION, ENGAGEMENT_FRACTION


def explain_result(response, experience, result, node_meta):
    activations = {a.body_id: a for a in result.activations}
    summaries = []
    for c in experience.components:
        ids = [b for b in c.body_ids if b in activations]
        types = sorted({node_meta[b].get("type") for b in ids if node_meta[b].get("type")})
        named = ", ".join(types[:4]) or "class-annotated sensory neurons"
        summaries.append(
            f"{c.label}: {len(ids):,} real input neurons reached ({named}); {c.temporal_pattern} input."
        )
    seeds = {b for c in experience.components for b in c.body_ids}
    downstream = sum(a.body_id not in seeds for a in result.activations)
    if summaries:
        summaries.append(
            f"The full-graph model reached {downstream:,} additional neurons downstream, traversing {result.metrics.connections_traversed:,} connections."
        )
    response.neural_summary = summaries
    response.neural_summary = [
        f"Scene assumption — {scene['assumptions']}" for scene in experience.scene_interpretations
    ] + summaries
    response.output_evidence = [
        {
            "label": c.label,
            "marker_types": list(next(ch.marker_types for ch in CHANNELS if ch.key == c.key)),
            "reached": c.neurons_activated,
            "available": c.neurons_in_circuit,
            "peak": c.peak_activation,
            "engaged": bool(
                c.neurons_in_circuit
                and c.neurons_activated / c.neurons_in_circuit >= ENGAGEMENT_FRACTION
                and c.peak_activation >= ENGAGEMENT_ACTIVATION
            ),
            "body_ids": c.body_ids,
        }
        for c in sorted(response.channels, key=lambda c: (-c.peak_activation, -c.neurons_activated))
    ]
    response.limitations = [u.note or u.reason for u in experience.unmapped]
    if any(c.temporal_pattern != "pulse" for c in experience.components):
        response.limitations.append(
            "Timing uses explicit illustrative model steps, not measured seconds or stimulus frequency."
        )
    keys = {c.stimulus for c in experience.components}
    if "visual_luminance" in keys:
        response.limitations.append(
            "Uniform light changes do not specify a movement direction. The model has no calibrated ON/OFF retinal dynamics or flicker-to-behavior decoder."
        )
    if any(c.modality == "gustation" for c in experience.components):
        response.limitations.append(
            "Taste neurons are class-annotated; sugar-versus-bitter selectivity is not established by the current MaleCNS mapping."
        )
    if response.confidence == "NONE":
        response.interpretation_kind = "sensory_only" if summaries else "no_input"
        if not summaries:
            response.headline = "No supported sensory input was simulated"
            response.detail = "The sentence did not resolve to a supported input population. The unhandled clauses are shown below."
            if experience.scene_interpretations:
                response.headline = "Situation recognized · sensory details needed"
                response.detail = " ".join(
                    scene["question"] for scene in experience.scene_interpretations
                )
        else:
            modes = {c.modality for c in experience.components}
            if "visual_looming" in keys and "gustation" in modes:
                response.headline = "Approach and taste signals reached the network"
            elif "visual_luminance" in keys:
                response.headline = (
                    "Repeated visual response"
                    if any(c.temporal_pattern == "repeated" for c in experience.components)
                    else "Light-change response"
                )
            else:
                response.headline = (
                    " + ".join(dict.fromkeys(c.label for c in experience.components)) + " response"
                )
            reached = sum(c.neurons_activated for c in response.channels)
            response.detail = f"{len(result.activations):,} neurons responded in the model. {reached} monitored output markers crossed the activity threshold, but no behavior channel met the engagement criteria. The action is unresolved—not a prediction that the fly does nothing."
            partial = [c for c in response.channels if c.neurons_activated]
            if partial:
                strongest = max(partial, key=lambda c: c.peak_activation)
                response.interpretation_kind = "partial_marker"
                response.headline = "Neural response · movement unresolved"
                response.detail = (
                    f"{strongest.neurons_activated}/{strongest.neurons_in_circuit} monitored "
                    f"{strongest.label.lower()} neurons responded, with peak model activity "
                    f"{strongest.peak_activation:.3f}. This identifies a possible action pathway; "
                    "its response remains below this model's action criteria. It does not establish "
                    "that the movement occurred, or that the fly would do nothing."
                )
    if response.interpretation_kind == "no_input":
        response.plain_language = "This description does not provide a supported present stimulus. That is a limit of this model, not evidence that a real fly would do nothing."
    elif response.interpretation_kind == "sensory_only":
        reached_labels = list(dict.fromkeys(
            c.label.lower() for c in experience.components
            if any(b in activations for b in c.body_ids)
        ))
        if reached_labels:
            cues = "; ".join(reached_labels)
            spread = (
                f"Activity spread to {downstream:,} additional neurons through the recorded wiring."
                if downstream else "Activity stayed within the selected input neurons."
            )
            response.plain_language = (
                f"The simulation registered {cues}. {spread} "
                "No monitored movement pathway met the action criteria, so a specific movement is not predicted."
            )
        else:
            response.plain_language = (
                "The selected sensory inputs did not produce above-threshold activity in this run. "
                "No movement is predicted from this result."
            )
    elif response.interpretation_kind == "partial_marker":
        strongest = max(
            (c for c in response.channels if c.neurons_activated),
            key=lambda c: c.peak_activation,
        )
        response.plain_language = (
            f"Activity reached {strongest.neurons_activated} of the "
            f"{strongest.neurons_in_circuit} monitored neurons associated with "
            f"{strongest.label.lower()}. This pathway responded below the model's action criteria; "
            "the result does not establish that the fly performs this movement."
        )
    else:
        actions = {
            "front_leg_rubbing": "The model recruited a pathway associated with rubbing the front legs together during grooming.",
            "stride_steering": "The model recruited a pathway associated with adjusting leg strides during a walking turn. The actual turn direction is not resolved.",
            "forward_walking": "The model recruited a walking-promotion pathway. Forward movement is a hypothesis; the body is not simulated.",
            "antennal_grooming": "The model suggests antenna cleaning: a movement that removes material from the antennae.",
            "escape_takeoff": "The model suggests a rapid takeoff away from a possible threat.",
            "escape_generic": "The model suggests an avoidance movement in response to the input.",
            "steering_turn": "The model suggests a change in movement direction.",
            "freeze_stop": "The model suggests stopping movement or freezing.",
            "backward_walking": "The model suggests walking backward.",
            "courtship_song": "The model suggests recruitment of a courtship-song pathway; successful mating is not simulated.",
            "feeding_proboscis": "The model suggests extending the mouthparts for feeding; actual ingestion is not simulated.",
        }
        channel = next(
            (c for c in response.channels if c.label.lower() in response.headline.lower()), None
        )
        response.plain_language = (
            actions.get(
                channel.key if channel else "",
                "A monitored action circuit met the model's activity criteria.",
            )
            + " This is an unvalidated model hypothesis, not an observed action."
        )
    return response
