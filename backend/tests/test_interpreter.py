import json

import pytest
import requests
from fastapi import HTTPException
from pydantic import ValidationError

from app.api.routes import SequenceRequest, SimulateRequest, simulate, simulate_sequence
from app.config import Settings
from app.experience import interpreter as module
from app.experience.embeddings import LexicalIndex
from app.experience.interpreter import Reading, compile_reading, from_ticket, interpret


def reading(text, stimulus="mechano_antennal", **changes):
    cue = {
        "stimulus": stimulus,
        "source_quote": text,
        "status": "present",
        "basis": "explicit",
        "assumption": "",
        "direction": None,
        "timing": "pulse",
    }
    cue.update(changes)
    return Reading(summary="A described sensory event.", cues=[cue], unmodeled=[], questions=[])


def test_supported_cues_cannot_supply_neurons_or_behavior():
    r = reading("a brush grazes the left feeler", direction="left")
    exp = compile_reading("a brush grazes the left feeler", r, "test")
    assert exp.components[0].stimulus == "mechano_antennal"
    assert exp.components[0].direction == "left"
    assert exp.components[0].body_ids == []
    assert exp.components[0].mapping_quality == "APPROXIMATE_MAPPING"
    for key in ["state_hunger", "dopamine", "pIP10", "sexual_thoughts"]:
        with pytest.raises(ValidationError):
            reading("a fly", stimulus=key)
    with pytest.raises(ValidationError):
        reading("touch", body_ids=[123])
    with pytest.raises(ValidationError):
        Reading(summary="scene", cues=[], unmodeled=[], questions=[], behavior="mate")


def test_negation_hypothetical_and_missing_evidence_do_not_seed():
    for status in ["absent", "hypothetical", "uncertain"]:
        exp = compile_reading("no contact", reading("no contact", status=status), "test")
        assert not exp.components
        assert exp.unmapped
    with pytest.raises(ValueError):
        compile_reading("nothing touches it", reading("a tap"), "test")
    with pytest.raises(ValueError):
        compile_reading("rain", reading("rain", basis="inferred"), "test")


def test_multisensory_reading_preserves_side_timing_and_unmodeled_context():
    text = "A female crosses its view while a brush repeatedly touches its left antenna"
    r = Reading(
        summary="Motion and repeated antennal contact.",
        cues=[
            reading(
                "A female crosses its view",
                "visual_motion",
                basis="inferred",
                assumption="Assuming the female is visible.",
            ).cues[0],
            reading(
                "a brush repeatedly touches its left antenna", direction="left", timing="repeated"
            ).cues[0],
        ],
        unmodeled=["Reproductive state is not modeled."],
        questions=["Is a courtship song audible?"],
    )
    exp = compile_reading(text, r, "test")
    assert [c.stimulus for c in exp.components] == ["visual_motion", "mechano_antennal"]
    assert exp.components[0].direction is None
    assert exp.components[1].input_steps == [0, 2, 4]
    assert exp.unmapped[0].note == "Reproductive state is not modeled."


def test_missing_key_and_provider_failure_use_visible_local_fallback(monkeypatch):
    monkeypatch.setattr(module, "get_settings", lambda: Settings(_env_file=None, gemini_api_key=""))
    monkeypatch.setattr(
        module.requests, "post", lambda *a, **k: pytest.fail("No key must mean no external request")
    )
    result = interpret("something touches its antenna", "llm", LexicalIndex())
    assert "not configured" in result["notice"]
    assert result["experience"].components
    monkeypatch.setattr(
        module, "get_settings", lambda: Settings(_env_file=None, gemini_api_key="test-secret")
    )

    def failure(*a, **k):
        raise requests.Timeout("DO NOT EXPOSE THIS PROVIDER DETAIL")

    monkeypatch.setattr(module.requests, "post", failure)
    result = interpret("something touches its antenna", "llm", LexicalIndex())
    assert "local parser" in result["notice"]
    assert "DO NOT" not in result["notice"]
    assert (
        from_ticket(result["ticket"], result["experience"].raw_text).interpreter_notice
        == result["notice"]
    )


def test_gemini_transport_and_signed_receipts(monkeypatch):
    text = "A brush grazes the left feeler"
    monkeypatch.setattr(
        module, "get_settings", lambda: Settings(_env_file=None, gemini_api_key="test-secret")
    )

    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {
                            "parts": [
                                {"text": "internal reasoning is not a scene", "thought": True},
                                {"text": reading(text, direction="left").model_dump_json()},
                            ]
                        },
                    }
                ]
            }

    def post(url, **kwargs):
        assert (
            url
            == "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent"
        )
        assert kwargs["headers"] == {"x-goog-api-key": "test-secret"}
        assert kwargs["json"]["generationConfig"]["responseMimeType"] == "application/json"
        assert (
            kwargs["json"]["generationConfig"]["responseJsonSchema"]["additionalProperties"]
            is False
        )
        assert kwargs["json"]["contents"][0]["parts"][0]["text"] == text
        assert "tools" not in kwargs["json"]
        assert kwargs["allow_redirects"] is False
        return Response()

    monkeypatch.setattr(module.requests, "post", post)
    result = interpret(text, "llm", LexicalIndex())
    assert result["notice"] is None
    assert result["experience"].parser.startswith("gemini:")
    assert "test-secret" not in json.dumps(result, default=str)
    assert from_ticket(result["ticket"], text) == result["experience"]
    for ticket, other_text in [
        (result["ticket"] + "a", text),
        (result["ticket"], "different input"),
        ("garbage", text),
    ]:
        with pytest.raises(ValueError):
            from_ticket(ticket, other_text)


@pytest.mark.parametrize(
    "payload",
    [
        {"candidates": [{"finishReason": "MAX_TOKENS", "content": {"parts": []}}]},
        {"promptFeedback": {"blockReason": "SAFETY"}},
        {
            "candidates": [
                {"finishReason": "STOP", "content": {"parts": [{"text": '{"bogus":true}'}]}}
            ]
        },
    ],
)
def test_refused_incomplete_invalid_readings_fall_back(monkeypatch, payload):
    monkeypatch.setattr(
        module, "get_settings", lambda: Settings(_env_file=None, gemini_api_key="test-secret")
    )

    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return payload

    monkeypatch.setattr(module.requests, "post", lambda *a, **k: Response())
    result = interpret("something touches its antenna", "llm", LexicalIndex())
    assert result["notice"]
    assert result["experience"].parser == "lexical-fallback"


def test_receipts_drive_real_graph_and_sequence_does_not_reinterpret(monkeypatch):
    text = "a brush repeatedly touches its left feeler"
    monkeypatch.setattr(
        module,
        "_llm_compile",
        lambda text: compile_reading(
            text, reading(text, direction="left", timing="repeated"), "test"
        ),
    )
    monkeypatch.setattr(
        module, "get_settings", lambda: Settings(_env_file=None, gemini_api_key="test-secret")
    )
    receipt = interpret(text, "llm", LexicalIndex())
    rest = interpret("", "local", LexicalIndex())
    monkeypatch.setattr(
        module, "_llm_compile", lambda text: pytest.fail("Never reinterpret past events")
    )
    result = simulate(SimulateRequest(text=text, interpretation_ticket=receipt["ticket"]))
    assert result.experience.components[0].neuron_count > 0
    assert result.result.metrics.neurons_activated > 0
    sequence = simulate_sequence(
        SequenceRequest(
            events=[text, ""], interpretation_tickets=[receipt["ticket"], rest["ticket"]]
        )
    )
    assert sequence.sequence["carried_active"] > 0
    assert not sequence.experience.components
    with pytest.raises(HTTPException) as exc:
        simulate(SimulateRequest(text="changed", interpretation_ticket=receipt["ticket"]))
    assert exc.value.status_code == 409
    with pytest.raises(ValidationError):
        SequenceRequest(events=[text, ""], interpretation_tickets=[receipt["ticket"]])


def test_reviewed_scene_restores_held_contact_but_never_absent_or_enclosed_contact():
    from app.experience.interpreter import _review_scene

    for text, expected in [
        ("the fly is held in a hand", {"mechano_body"}),
        ("the fly is captured in a jar", set()),
        ("the fly is not held in a hand", set()),
        ("if the fly is held in a hand", set()),
    ]:
        empty = compile_reading(
            text,
            Reading(summary=text, cues=[], unmodeled=["Restraint mechanics."], questions=[]),
            "test",
        )
        result = _review_scene(empty)
        assert {c.stimulus for c in result.components} == expected
        if expected:
            assert result.components[0].temporal_pattern == "sustained"
            assert result.components[0].mapping_quality == "APPROXIMATE_MAPPING"
            assert result.parser.endswith("+reviewed-scene")
