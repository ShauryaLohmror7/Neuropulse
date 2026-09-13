import numpy as np

from app.experience.parser import compile_experience
from app.simulation.graph import ConnectomeGraph
from app.simulation.parameters import PropagationParameters
from app.simulation.propagation import propagate


def test_approach_clause_and_sustained_taste_are_both_retained():
    from app.api.routes import SimulateRequest, simulate

    result = simulate(SimulateRequest(text="two flies approach while eating sugar"))
    components = {c.stimulus: c for c in result.experience.components}
    assert set(components) == {"visual_looming", "gustatory_labellar"}
    assert components["visual_looming"].mapping_quality == "APPROXIMATE_MAPPING"
    assert "two separate objects" in components["visual_looming"].caveat
    assert components["gustatory_labellar"].input_steps == [0, 1, 2, 3, 4]
    escape = next(c for c in result.response.channels if c.key == "escape_takeoff")
    assert escape.neurons_activated == 2 and escape.peak_activation >= 0.09
    assert result.response.confidence != "NONE"


def test_repeated_lights_have_explicit_timing_and_do_not_invent_action():
    from app.api.routes import SimulateRequest, simulate

    result = simulate(SimulateRequest(text="lights repeatedly turn on and off"))
    c = result.experience.components[0]
    assert c.stimulus == "visual_luminance" and c.input_steps == [0, 2, 4]
    assert c.neuron_count == 3377
    assert [s.step for s in result.result.steps if s.input_neurons] == [0, 2, 4]
    assert result.response.interpretation_kind == "sensory_only"
    assert result.response.headline == "Repeated visual response"
    assert result.response.confidence == "NONE"
    assert len(result.response.output_evidence) == 8
    assert any("ON/OFF" in note for note in result.response.limitations)


def test_scheduled_input_changes_actual_states_without_changing_wiring():
    graph = ConnectomeGraph.from_edges([(1, 2, 1), (2, 3, 1)])
    weights = graph.weights.copy()
    p = PropagationParameters(steps=6, use_neurotransmitter_sign=False)
    one = propagate(graph, {1: 0.8}, params=p)
    repeated = propagate(
        graph, {1: 0.8}, params=p, input_schedule={0: {1: 0.8}, 2: {1: 0.8}, 4: {1: 0.8}}
    )
    a = next(a for a in one.activations if a.body_id == 1)
    b = next(a for a in repeated.activations if a.body_id == 1)
    assert b.history[2] > a.history[2] and b.history[4] > a.history[4]
    assert np.array_equal(weights, graph.weights)


def test_rejected_ranked_clause_is_reported_instead_of_silently_dropped():
    class Index:
        name = "test"

        def rank(self, text):
            return [("state_hunger", 0.81)]

    result = compile_experience("some uncertain hunger context", index=Index())
    assert not result.components
    assert any(u.text == "some uncertain hunger context" for u in result.unmapped)


def test_silenced_inputs_cannot_be_reinjected_by_a_schedule():
    from app.simulation.lesion import lesion_and_compare

    graph = ConnectomeGraph.from_edges([(1, 2, 1), (2, 3, 1)])
    result = lesion_and_compare(graph, {1: 0.8}, [1], input_schedule={0: {1: 0.8}, 2: {1: 0.8}})
    assert not result.lesioned.activations


def test_touch_reads_real_grooming_markers_without_forcing_an_action():
    from app.api.routes import SimulateRequest, simulate

    single = simulate(SimulateRequest(text="something touches its antenna"))
    repeated = simulate(SimulateRequest(text="something repeatedly touches its antenna"))
    channel = next(c for c in single.response.channels if c.key == "antennal_grooming")
    assert set(channel.body_ids) == {10587, 12894, 14537, 15653, 36541, 524190}
    assert 0 < channel.peak_activation < 0.09
    assert single.response.interpretation_kind == "partial_marker"
    assert single.response.confidence == "NONE"
    assert single.response.headline == "Antennal grooming circuit responded"
    assert repeated.response.headline == "Antennal grooming tendency (modeled)"
    assert repeated.response.confidence == "MODERATE"
    silenced = simulate(
        SimulateRequest(text="something repeatedly touches its antenna", lesion=channel.body_ids)
    )
    missing = next(c for c in silenced.response.channels if c.key == "antennal_grooming")
    assert missing.neurons_activated == 0
    assert not next(
        c for c in silenced.response.output_evidence if c["label"] == "Antennal grooming"
    )["engaged"]
