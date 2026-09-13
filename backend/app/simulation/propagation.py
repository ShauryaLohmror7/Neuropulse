"""Deterministic activity propagation over a real connectome subgraph.

Model (explicitly simplified — see module docstring of the package):

    drive_t[target]  = Σ_edges  activation_{t-1}[source] · ŵ(source→target) · sign(source) · decay
    activation_t     = clip( self_decay · activation_{t-1} + drive_t , 0, max )

with a threshold for "counts as activated", a short refractory window, a
per-neuron top-k on outgoing edges and a synapse-count floor.  There is no
randomness: the same input always yields the same cascade, which matters for a
reproducible demo.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable, Mapping
from dataclasses import dataclass

import numpy as np

from app.simulation.graph import ConnectomeGraph
from app.simulation.parameters import DEFAULT_PARAMETERS, PropagationParameters
from app.simulation.schemas import (
    NeuronActivation,
    PropagationResult,
    PulseEvent,
    SimulationMetrics,
    StepSummary,
)


@dataclass
class NeuralState:
    """Full internal dynamical state. This is not learned synaptic memory."""

    activity: np.ndarray
    refractory: np.ndarray
    modalities: np.ndarray


def propagate(
    graph: ConnectomeGraph,
    seeds: Mapping[int, float],
    *,
    params: PropagationParameters = DEFAULT_PARAMETERS,
    seed_modalities: Mapping[int, str] | None = None,
    max_pulses: int = 12000,
    input_schedule: Mapping[int, Mapping[int, float]] | None = None,
    initial_state: NeuralState | None = None,
    capture_state: Callable[[NeuralState], None] | None = None,
) -> PropagationResult:
    """Run the cascade.

    Parameters
    ----------
    seeds:
        ``bodyId -> initial activation`` for the sensory neurons the experience
        stimulates.
    seed_modalities:
        ``bodyId -> modality`` so pulses can inherit which sensory stream they
        descend from (used for colour in the renderer).
    """
    n = graph.n_nodes
    act = np.zeros(n, dtype=np.float32)
    first_step = np.full(n, -1, dtype=np.int32)
    refractory = np.zeros(n, dtype=np.int32)
    peak = np.zeros(n, dtype=np.float32)
    if initial_state is not None:
        if any(
            x.shape != (n,)
            for x in (initial_state.activity, initial_state.refractory, initial_state.modalities)
        ):
            raise ValueError("Neural state must match the graph node ordering and size")
        act = initial_state.activity.copy()
        refractory = initial_state.refractory.copy()
        peak = act.copy()
        first_step[act > params.activation_threshold] = 0

    src, tgt, nw, raw_w = graph.transmission_edges(
        params.weight_normalisation, top_k=params.top_k_edges, min_weight=params.min_edge_weight
    )
    signs = (
        graph.nt_signs(confidence_floor=params.nt_confidence_floor)
        if params.use_neurotransmitter_sign
        else np.ones(n, dtype=np.float32)
    )

    scheduled = {}
    for step, values in (input_schedule or {}).items():
        if step < 0 or step > params.steps:
            continue
        pairs = [
            (graph.index[int(b)], float(v)) for b, v in values.items() if int(b) in graph.index
        ]
        scheduled[step] = (
            np.array([i for i, _ in pairs], dtype=np.int32),
            np.array([v for _, v in pairs], dtype=np.float32),
        )
    # --- seed ---------------------------------------------------------
    modality_of = np.array([""] * n, dtype=object)
    if initial_state is not None:
        modality_of = initial_state.modalities.copy()
    seed_indices: list[int] = []
    seeds_by_modality: dict[str, list[int]] = defaultdict(list)
    for body_id, drive in seeds.items():
        i = graph.node_index(int(body_id))
        if i is None:
            continue
        act[i] = max(act[i], min(float(drive), params.max_activation))
        peak[i] = act[i]
        first_step[i] = 0
        seed_indices.append(i)
        m = (seed_modalities or {}).get(int(body_id), "")
        modality_of[i] = m
        if m:
            seeds_by_modality[m].append(int(body_id))

    pulses: list[PulseEvent] = []
    step_summaries: list[StepSummary] = []
    active_mask = act > params.activation_threshold
    step_summaries.append(
        StepSummary(
            step=0,
            newly_activated=int(active_mask.sum()),
            active_total=int(active_mask.sum()),
            mean_activation=float(act[active_mask].mean()) if active_mask.any() else 0.0,
            pulses=0,
            input_neurons=len(seed_indices),
        )
    )

    history = [act.copy()]
    emissions: dict[int, list[int]] = defaultdict(list)
    edge_traversed = np.zeros(len(src), dtype=bool)
    significant_total = 0

    for step in range(1, params.steps + 1):
        emitting = act > params.activation_threshold
        if not emitting.any():
            if capture_state is None and not any(k >= step for k in scheduled):
                break

        # Signal leaving each emitting neuron along each surviving edge.
        edge_active = emitting[src]
        if (
            capture_state is None
            and not edge_active.any()
            and not any(k >= step for k in scheduled)
        ):
            break
        edge_traversed |= edge_active
        active_raw = raw_w[edge_active]
        es, et, ew = src[edge_active], tgt[edge_active], nw[edge_active]
        for source in np.unique(es):
            emissions[int(source)].append(step - 1)
        amp = act[es] * ew * params.decay
        esign = signs[es]
        contrib = np.where(esign < 0, -amp * params.inhibition_strength, amp)

        drive = np.zeros(n, dtype=np.float32)
        np.add.at(drive, et, contrib)

        prev_act = act.copy()
        new_act = params.self_decay * act + drive
        # Refractory neurons cannot be re-driven this step.
        new_act = np.where(refractory > 0, params.self_decay * act, new_act)
        if step in scheduled:
            input_idx, input_values = scheduled[step]
            new_act[input_idx] = np.maximum(new_act[input_idx], input_values)
        act = np.clip(new_act, 0.0, params.max_activation)
        peak = np.maximum(peak, act)
        history.append(act.copy())

        newly = (act > params.activation_threshold) & (first_step < 0)
        first_step = np.where(newly, step, first_step)

        # Inherit modality label from the strongest upstream contributor.
        if newly.any():
            best: dict[int, tuple[float, int]] = {}
            candidates = newly[et]
            for s_i, t_i, a_i in zip(es[candidates], et[candidates], amp[candidates]):
                if newly[t_i]:
                    cur = best.get(int(t_i))
                    if cur is None or a_i > cur[0]:
                        best[int(t_i)] = (float(a_i), int(s_i))
            for t_i, (_a, s_i) in best.items():
                inherited = modality_of[s_i]
                modality_of[t_i] = inherited if inherited else "mixed"

        # Record pulses (only excitation/inhibition that actually mattered).
        significant = np.abs(amp) > params.activation_threshold * 0.5
        significant_total += int(significant.sum())
        if len(pulses) < max_pulses:
            idxs = np.flatnonzero(significant)
            if len(idxs) > max_pulses - len(pulses):
                # keep the strongest
                idxs = idxs[np.argsort(-np.abs(amp[idxs]))][: max_pulses - len(pulses)]
            for k in idxs:
                s_i, t_i = int(es[k]), int(et[k])
                pulses.append(
                    PulseEvent(
                        step=step,
                        source=int(graph.body_ids[s_i]),
                        target=int(graph.body_ids[t_i]),
                        weight=float(active_raw[k]),
                        amplitude=round(float(abs(amp[k])), 5),
                        sign=-1 if signs[s_i] < 0 else 1,
                        modality=(modality_of[s_i] or None),
                    )
                )

        refractory = np.maximum(refractory - 1, 0)
        just_fired = (prev_act <= params.activation_threshold) & (act > params.activation_threshold)
        refractory = np.where(just_fired, params.refractory_steps, refractory)

        active_now = act > params.activation_threshold
        step_pulses = sum(1 for p in pulses if p.step == step)
        step_summaries.append(
            StepSummary(
                step=step,
                newly_activated=int(newly.sum()),
                active_total=int(active_now.sum()),
                mean_activation=float(act[active_now].mean()) if active_now.any() else 0.0,
                pulses=step_pulses,
                cumulative_connections=int(edge_traversed.sum()),
                input_neurons=len(scheduled[step][0]) if step in scheduled else 0,
            )
        )

    activated_idx = np.flatnonzero(first_step >= 0)
    activations = [
        NeuronActivation(
            carried=bool(
                initial_state is not None
                and initial_state.activity[i] > params.activation_threshold
                and int(graph.body_ids[i]) not in seeds
            ),
            body_id=int(graph.body_ids[i]),
            modality=modality_of[i] or None,
            activation=round(float(peak[i]), 5),
            step=int(first_step[i]),
            history=[float(state[i]) for state in history],
            emission_steps=emissions.get(int(i), []),
        )
        for i in activated_idx
    ]

    regions: set[str] = set()
    for i in activated_idx:
        meta = graph.node_meta[i] if i < len(graph.node_meta) else {}
        for key in ("region", "roi", "primaryRoi"):
            v = meta.get(key)
            if v:
                regions.add(str(v))
                break

    total_syn = raw_w[edge_traversed].sum(dtype=np.float64)
    metrics = SimulationMetrics(
        neurons_activated=len(activations),
        connections_traversed=int(edge_traversed.sum()),
        connections_considered=len(src),
        pulses_omitted=significant_total - len(pulses),
        propagation_depth=int(first_step.max()) if len(activated_idx) else 0,
        regions_reached=sorted(regions),
        modalities=sorted({m for m in modality_of if m}),
        total_synapses_traversed=int(total_syn),
        nt_coverage=graph.nt_coverage(confidence_floor=params.nt_confidence_floor)
        if params.use_neurotransmitter_sign
        else {"applied": False},
    )

    if capture_state is not None:
        capture_state(NeuralState(act.copy(), refractory.copy(), modality_of.copy()))
    return PropagationResult(
        metrics=metrics,
        steps=step_summaries,
        activations=activations,
        pulses=pulses,
        seeds={k: v for k, v in seeds_by_modality.items()},
    )
