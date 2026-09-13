"""Tests for the experience compiler.

These run against whichever local semantic backend is available; the assertions
are about *behaviour we require* (the right modality fires, nonsense is refused,
unsupported state is never injected), not about exact similarity numbers.
"""

from __future__ import annotations

import pytest

from app.experience.parser import compile_experience, extract_direction, extract_intensity, split_clauses
from app.experience.ontology import BY_KEY


@pytest.fixture(scope="module")
def compile_():
    from app.experience.embeddings import get_index

    idx = get_index()
    if idx.name.startswith("lexical"):
        pytest.skip("embedding backend unavailable; semantic assertions need it")

    def run(text: str):
        return compile_experience(text, index=idx)

    return run


def keys(result) -> set[str]:
    return {c.stimulus for c in result.components}


# --- clause / attribute mechanics (no model needed) ------------------------

def test_split_clauses_on_while():
    cs = split_clauses("A fly smells fruit while a shadow approaches from the left.")
    assert len(cs) == 2


def test_split_clauses_on_commas_and_and():
    cs = split_clauses("It smells food, feels a vibration, and sees motion on its right.")
    assert len(cs) >= 3


def test_direction_is_clause_local():
    # "left" belongs to the looming clause, not the odour clause.
    assert extract_direction("a dark object approaches from its left") == "left"
    assert extract_direction("a hungry fly smells ripe fruit") is None


def test_intensity_scales_with_language():
    fast = extract_intensity("a large object approaches very rapidly")
    slow = extract_intensity("a faint distant smell")
    assert fast > 0.8 and slow < 0.5


# --- semantic behaviour ----------------------------------------------------

def test_multimodal_demo_sentence(compile_):
    r = compile_("A hungry fly smells ripe fruit while a dark object rapidly approaches from its left.")
    assert "visual_looming" in keys(r)
    assert "olfactory_fruit" in keys(r)
    looming = next(c for c in r.components if c.stimulus == "visual_looming")
    assert looming.direction == "left"
    assert looming.intensity > 0.7


def test_hunger_is_recognised_but_never_injected(compile_):
    r = compile_("A hungry fly smells ripe fruit.")
    assert "state_hunger" not in keys(r)
    assert any(u.concept == "state_hunger" for u in r.unmapped)
    assert BY_KEY["state_hunger"].mapping_quality == "UNSUPPORTED"


def test_nonsense_produces_no_stimulus(compile_):
    r = compile_("The fly worries about its taxes.")
    assert not r.components
    assert r.note and "No direct sensory mapping" in r.note


def test_paraphrases_reach_looming(compile_):
    for text in [
        "Something huge is rushing toward the fly.",
        "A shadow rapidly expands above it.",
        "A dark object gets closer extremely fast.",
    ]:
        assert "visual_looming" in keys(compile_(text)), text


def test_touch_is_lateralised(compile_):
    r = compile_("Something suddenly touches the fly's left antenna.")
    c = next(c for c in r.components if c.stimulus == "mechano_antennal")
    assert c.direction == "left"
    assert c.mapping_quality == "SUPPORTED_REAL_MAPPING"


def test_negation_is_not_injected(compile_):
    r = compile_("Nothing touches the fly's antenna.")
    assert "mechano_antennal" not in keys(r)
    assert any(u.reason == "NEGATED" for u in r.unmapped)


def test_sweet_taste_is_flagged_approximate(compile_):
    r = compile_("The fly lands on a sweet surface and begins tasting sugar.")
    gust = [c for c in r.components if c.modality == "gustation"]
    assert gust, "expected a gustatory component"
    assert all(c.mapping_quality == "APPROXIMATE_MAPPING" for c in gust)
    assert all(c.caveat for c in gust)


def test_three_modalities_from_one_sentence(compile_):
    r = compile_("The fly smells food, feels a vibration underneath it, and sees motion on its right.")
    assert len(r.modalities) >= 3


def test_empty_input_is_safe(compile_):
    r = compile_("")
    assert not r.components


def test_banana_proximity_does_not_invent_an_odor(compile_):
    result = compile_("The fly worries about university admissions while sitting beside a banana.")
    assert not result.components
    assert any(u.reason == "CONTEXT_WITHOUT_SENSORY_CUE" for u in result.unmapped)
    assert any(u.reason == "NO_SENSORY_MATCH" for u in result.unmapped)
