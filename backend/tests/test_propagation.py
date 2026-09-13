"""Unit tests for the propagation model.

These use small hand-built graphs (clearly synthetic, test-only fixtures) to
verify the *mechanics* of the model. They make no biological claim.
"""

from __future__ import annotations

import numpy as np
import pytest

from app.simulation.graph import ConnectomeGraph
from app.simulation.parameters import PropagationParameters
from app.simulation.lesion import lesion_and_compare
from app.simulation.propagation import propagate


def chain_graph(n: int = 5, weight: float = 50.0) -> ConnectomeGraph:
    edges = [(i, i + 1, weight) for i in range(n - 1)]
    meta = {i: {"type": f"T{i}", "region": f"R{i}"} for i in range(n)}
    return ConnectomeGraph.from_edges(edges, meta)


def test_chain_propagates_one_hop_per_step():
    g = chain_graph(5)
    p = PropagationParameters(steps=6, decay=1.0, self_decay=0.5, activation_threshold=0.01,
                              min_edge_weight=1, refractory_steps=0)
    r = propagate(g, {0: 1.0}, params=p)
    step_of = {a.body_id: a.step for a in r.activations}
    assert step_of[0] == 0
    for i in range(1, 5):
        assert step_of[i] == i, step_of
    assert r.metrics.propagation_depth == 4
    assert r.metrics.neurons_activated == 5


def test_decay_reduces_downstream_activation():
    g = chain_graph(4)
    p = PropagationParameters(steps=4, decay=0.5, self_decay=0.0, activation_threshold=0.001,
                              min_edge_weight=1, refractory_steps=0)
    r = propagate(g, {0: 1.0}, params=p)
    acts = {a.body_id: a.activation for a in r.activations}
    assert acts[1] > acts[2] > acts[3]


def test_threshold_halts_cascade():
    g = chain_graph(6)
    p = PropagationParameters(steps=6, decay=0.2, self_decay=0.0, activation_threshold=0.05,
                              min_edge_weight=1, refractory_steps=0)
    r = propagate(g, {0: 1.0}, params=p)
    assert r.metrics.propagation_depth < 5


def test_min_edge_weight_filters_weak_connections():
    g = ConnectomeGraph.from_edges([(0, 1, 100.0), (0, 2, 2.0)], {i: {} for i in range(3)})
    p = PropagationParameters(steps=2, min_edge_weight=10, activation_threshold=0.001,
                              refractory_steps=0)
    r = propagate(g, {0: 1.0}, params=p)
    ids = {a.body_id for a in r.activations}
    assert ids == {0, 1}


def test_top_k_caps_fanout():
    edges = [(0, i, float(100 - i)) for i in range(1, 20)]
    g = ConnectomeGraph.from_edges(edges, {i: {} for i in range(20)})
    p = PropagationParameters(steps=1, top_k_edges=3, min_edge_weight=1,
                              activation_threshold=0.0001, refractory_steps=0)
    r = propagate(g, {0: 1.0}, params=p)
    assert r.metrics.neurons_activated == 4  # seed + 3


def test_determinism():
    g = chain_graph(8)
    p = PropagationParameters(steps=5, min_edge_weight=1)
    a = propagate(g, {0: 1.0}, params=p)
    b = propagate(g, {0: 1.0}, params=p)
    assert a.model_dump() == b.model_dump()


def test_inhibitory_sign_from_neurotransmitter():
    meta = {
        0: {"predictedNt": "acetylcholine", "predictedNtConfidence": 0.99},
        1: {"predictedNt": "gaba", "predictedNtConfidence": 0.99},
        2: {"predictedNt": "acetylcholine", "predictedNtConfidence": 0.99},
        3: {},
    }
    # 0 -> 1 (GABAergic) -> 3, and 2 -> 3 excitatory
    g = ConnectomeGraph.from_edges([(0, 1, 100.0), (1, 3, 100.0), (2, 3, 100.0)], meta)
    p = PropagationParameters(steps=3, min_edge_weight=1, activation_threshold=0.001,
                              refractory_steps=0, use_neurotransmitter_sign=True)
    r = propagate(g, {0: 1.0, 2: 1.0}, params=p)
    signs = {(x.source, x.target): x.sign for x in r.pulses}
    assert signs[(1, 3)] == -1
    assert signs[(0, 1)] == 1
    cov = g.nt_coverage()
    assert cov["withConfidentNt"] == 3 and cov["inhibitory"] == 1


def test_low_confidence_nt_is_not_signed():
    meta = {0: {"predictedNt": "gaba", "predictedNtConfidence": 0.2}, 1: {}}
    g = ConnectomeGraph.from_edges([(0, 1, 50.0)], meta)
    p = PropagationParameters(steps=1, min_edge_weight=1, activation_threshold=0.001,
                              nt_confidence_floor=0.5)
    r = propagate(g, {0: 1.0}, params=p)
    assert all(x.sign == 1 for x in r.pulses)


def test_modality_labels_propagate():
    g = chain_graph(4)
    p = PropagationParameters(steps=4, min_edge_weight=1, activation_threshold=0.001,
                              refractory_steps=0)
    r = propagate(g, {0: 1.0}, params=p, seed_modalities={0: "vision"})
    assert r.seeds["vision"] == [0]
    assert all(x.modality in ("vision", None) for x in r.pulses)
    assert "vision" in r.metrics.modalities


def test_convergence_of_two_modalities_marks_mixed():
    #   vision(0) ->  2
    # olfaction(1) ->  2 -> 3
    g = ConnectomeGraph.from_edges(
        [(0, 2, 100.0), (1, 2, 10.0), (2, 3, 100.0)], {i: {} for i in range(4)}
    )
    p = PropagationParameters(steps=3, min_edge_weight=1, activation_threshold=0.001,
                              refractory_steps=0)
    r = propagate(g, {0: 1.0, 1: 1.0}, params=p,
                  seed_modalities={0: "vision", 1: "olfaction"})
    mods = r.metrics.modalities
    assert "vision" in mods and "olfaction" in mods


def test_lesion_removes_downstream():
    g = chain_graph(5)
    p = PropagationParameters(steps=6, min_edge_weight=1, activation_threshold=0.001,
                              decay=1.0, self_decay=0.5, refractory_steps=0)
    cmp_ = lesion_and_compare(g, {0: 1.0}, [2], params=p)
    assert cmp_.normal.metrics.neurons_activated == 5
    assert cmp_.lesioned.metrics.neurons_activated == 2  # 0 and 1 only
    assert set(cmp_.lost_neurons) == {2, 3, 4}
    assert cmp_.delta_neurons_activated == -3


def test_graph_without_is_non_destructive():
    g = chain_graph(4)
    before = g.n_edges
    g.without([1])
    assert g.n_edges == before


def test_weight_normalisation_modes_are_bounded():
    edges = [(0, 2, 10.0), (1, 2, 30.0)]
    g = ConnectomeGraph.from_edges(edges, {i: {} for i in range(3)})
    for mode in ("target_input", "source_output", "log"):
        s, t, w = g.normalised_weights(mode, min_weight=1)
        assert np.all(w > 0) and np.all(w <= 1.0 + 1e-6), mode


def test_empty_seed_produces_empty_result():
    g = chain_graph(3)
    r = propagate(g, {}, params=PropagationParameters(steps=3, min_edge_weight=1))
    assert r.metrics.neurons_activated == 0
    assert r.pulses == []


def test_recorded_history_captures_activity_after_last_new_neuron():
    # Two cells, one directed edge. Exact recurrence with no refractory:
    # seed: 1, .5, .25, .125; target: 0, 1, 1, .75.
    g = chain_graph(2)
    p = PropagationParameters(steps=3, decay=1, self_decay=.5,
                              activation_threshold=.01, min_edge_weight=1,
                              refractory_steps=0)
    r = propagate(g, {0: 1}, params=p)
    by_id = {a.body_id: a for a in r.activations}
    assert by_id[0].history == pytest.approx([1, .5, .25, .125])
    assert by_id[1].history == pytest.approx([0, 1, 1, .75])
    assert by_id[0].emission_steps == [0, 1, 2]
    assert by_id[1].emission_steps == []  # no outgoing edge
    assert r.metrics.propagation_depth == 1
    assert len(r.steps) == 4  # playback must not stop at depth 1
    for step in r.steps:
        assert step.active_total == sum(a.history[step.step] > p.activation_threshold for a in r.activations)
