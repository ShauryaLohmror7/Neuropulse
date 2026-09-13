from app.api.routes import SimulateRequest, simulate


def test_clear_outcomes_follow_model_evidence_not_just_input_words():
    grooming = simulate(SimulateRequest(text="something repeatedly touches its antenna"))
    assert "antenna cleaning" in grooming.response.plain_language
    assert "unvalidated model hypothesis" in grooming.response.plain_language
    visual = simulate(SimulateRequest(text="lights repeatedly turn on and off"))
    assert visual.response.interpretation_kind == "sensory_only"
    assert "cannot yet translate" in visual.response.plain_language
    assert visual.response.confidence == "NONE"
    absent = simulate(SimulateRequest(text="nothing touches its antenna"))
    assert absent.response.interpretation_kind == "no_input"
    assert "not evidence that a real fly would do nothing" in absent.response.plain_language
    assert absent.result.metrics.neurons_activated == 0


def test_quiet_systems_are_reported_without_claiming_unused_brain():
    result = simulate(SimulateRequest(text="something touches its antenna"))
    assert sum(system["total"] for system in result.systems) == result.circuit["neurons"]
    assert any(system["reached"] == 0 for system in result.systems)
    assert all(system["reached"] <= system["total"] for system in result.systems)
