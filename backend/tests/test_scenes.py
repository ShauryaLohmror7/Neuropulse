from app.api.routes import SimulateRequest, simulate
from app.experience.parser import compile_experience
from app.experience.scenes import interpret_scene


def test_social_approach_is_not_forced_mating_or_escape():
    result = simulate(SimulateRequest(text="another fly comes to mate"))
    assert {c.stimulus for c in result.experience.components} == {"visual_motion"}
    assert result.result.metrics.neurons_activated > 0
    assert result.experience.scene_interpretations
    assert all(c.mapping_quality == "APPROXIMATE_MAPPING" for c in result.experience.components)
    assert all(c.confidence <= 0.6 for c in result.experience.components)
    assert not any(
        c["engaged"]
        for c in result.response.output_evidence
        if c["label"] in ["Courtship song", "Escape takeoff"]
    )
    assert any("internal state" in note for note in result.response.limitations)


def test_rain_discloses_exposure_and_uses_real_contact_and_humidity_inputs():
    exp = compile_experience("it starts raining")
    assert {c.stimulus for c in exp.components} == {"mechano_body", "hygro_change"}
    assert next(c for c in exp.components if c.stimulus == "mechano_body").input_steps == [0, 2, 4]
    assert "Assuming" in exp.scene_interpretations[0]["assumptions"]
    assert not compile_experience("it is raining outside the room").components


def test_capture_does_not_invent_contact_inside_an_enclosure():
    assert not compile_experience("the fly is captured in a jar").components
    held = compile_experience("the fly is held in a hand")
    assert {c.stimulus for c in held.components} == {"mechano_body"}
    assert held.components[0].temporal_pattern == "sustained"


def test_absent_and_hypothetical_scenes_are_not_expanded():
    for clause in [
        "it is not raining",
        "if it starts raining",
        "rain stopped",
        "the fly is not captured",
    ]:
        assert interpret_scene(clause) is None


def test_explicit_cues_in_other_clauses_survive_social_interpretation():
    exp = compile_experience("a female approaches to mate while something touches its left antenna")
    assert {c.stimulus for c in exp.components} == {"visual_motion", "mechano_antennal"}
    assert next(c for c in exp.components if c.stimulus == "mechano_antennal").direction == "left"
    assert (
        next(c for c in exp.components if c.stimulus == "visual_motion").source_clause
        == "a female approaches to mate"
    )
