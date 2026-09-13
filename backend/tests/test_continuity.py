import numpy as np
import pytest
from pydantic import ValidationError

from app.api.routes import SequenceRequest, SimulateRequest, simulate, simulate_sequence
from app.simulation.graph import ConnectomeGraph
from app.simulation.parameters import PropagationParameters
from app.simulation.propagation import propagate


def test_split_run_preserves_complete_state_and_refractoriness():
    graph = ConnectomeGraph.from_edges([(1, 2, 3), (2, 3, 2), (3, 1, 1)])
    params = PropagationParameters(steps=6)
    whole = []
    propagate(graph, {1: 0.8}, params=params, capture_state=whole.append)
    first = []
    propagate(
        graph, {1: 0.8}, params=params.model_copy(update={"steps": 2}), capture_state=first.append
    )
    snapshot = first[0].activity.copy()
    last = []
    propagate(
        graph,
        {},
        params=params.model_copy(update={"steps": 4}),
        initial_state=first[0],
        capture_state=last.append,
    )
    np.testing.assert_array_equal(last[0].activity, whole[0].activity)
    np.testing.assert_array_equal(last[0].refractory, whole[0].refractory)
    np.testing.assert_array_equal(first[0].activity, snapshot)
    assert np.array_equal(graph.weights, [3, 2, 1])


def test_subthreshold_and_disconnected_activity_decays_without_frozen_time():
    graph = ConnectomeGraph.from_edges([], node_meta={1: {}})
    captured = []
    propagate(
        graph, {1: 0.02}, params=PropagationParameters(steps=2), capture_state=captured.append
    )
    assert captured[0].activity[0] == pytest.approx(0.02 * 0.55**2)
    next_state = []
    propagate(
        graph,
        {},
        params=PropagationParameters(steps=2),
        initial_state=captured[0],
        capture_state=next_state.append,
    )
    assert next_state[0].activity[0] == pytest.approx(0.02 * 0.55**4)


def test_full_graph_sequence_and_fresh_run_are_isolated():
    before = simulate(SimulateRequest(text="something touches its antenna"))
    seq = simulate_sequence(
        SequenceRequest(events=["something repeatedly touches its antenna", ""])
    )
    assert seq.sequence["events"][1]["carried_active"] > 0
    assert seq.result.activations
    assert not seq.result.seeds
    assert sum(g["total"] for g in seq.systems) == 166700
    assert sum(g["reached"] for g in seq.systems) == seq.result.metrics.neurons_activated
    for i, s in enumerate(seq.result.steps):
        assert sum(g["active_by_step"][i] for g in seq.systems) == s.active_total
    again = simulate(SimulateRequest(text="something touches its antenna"))
    assert again.result == before.result
    assert again.sequence is None
    assert {g["key"] for g in seq.systems} >= {
        "memory_input",
        "memory_output",
        "navigation",
        "dopamine",
    }


def test_sequence_limits_are_explicit():
    with pytest.raises(ValidationError):
        SequenceRequest(events=[])
    with pytest.raises(ValidationError):
        SequenceRequest(events=["x"] * 7)
    with pytest.raises(ValidationError):
        SequenceRequest(events=["x" * 601])
