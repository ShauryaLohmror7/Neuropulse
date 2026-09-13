import numpy as np

from app.api.state import get_circuit
from app.simulation.graph import ConnectomeGraph
from app.simulation.parameters import PropagationParameters
from app.simulation.propagation import propagate


def test_full_catalogue_and_uncapped_populations():
    c = get_circuit()
    assert c.graph.n_nodes == 166700
    assert c.graph.n_edges == 25582938
    assert int(c.graph.weights.sum(dtype=np.float64)) == 124177617
    assert len(c.seed_sets["visual_luminance:all"]) == 3377
    assert len(c.seed_sets["visual_motion:all"]) == 13580
    assert len(c.doc["somas"]["bodyIds"]) == 139662
    assert all(b in c.graph.index for values in c.seed_sets.values() for b in values)
    assert c.graph.weights.min() == 1


def test_no_default_fanout_or_weak_edge_cap_and_visual_budget_independent():
    g = ConnectomeGraph.from_edges([(1, i, 1) for i in range(2, 202)])
    p = PropagationParameters(steps=2, use_neurotransmitter_sign=False)
    a = propagate(g, {1: 1}, params=p, max_pulses=0)
    b = propagate(g, {1: 1}, params=p, max_pulses=10000)
    assert a.metrics.connections_considered == 200
    assert a.metrics.connections_traversed == 200
    assert a.metrics.total_synapses_traversed == 200
    assert len(a.activations) == 201
    assert a.activations == b.activations
    assert a.metrics.connections_traversed == b.metrics.connections_traversed
    assert a.metrics.pulses_omitted > 0
    assert not a.pulses and b.pulses
