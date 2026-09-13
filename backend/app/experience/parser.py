"""Compile a natural-language experience into biological stimulus components.

Pipeline
--------
1. Clause decomposition — split on conjunctions and punctuation, because one
   sentence usually describes several simultaneous stimuli.
2. Semantic classification — score each clause against the ontology's phrase
   bank using a local embedding model (or the deterministic fallback).
3. Attribute extraction — direction, intensity and negation, from explicit
   spatial/degree language only.
4. Honest gating — a concept is only emitted above a confidence floor, and
   concepts whose mapping quality is UNSUPPORTED are reported as recognised
   context rather than injected into the simulation.

There is no generative model anywhere in this path. The compiler can say
"I did not find a mappable stimulus", and frequently should.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

from app.experience.embeddings import SemanticIndex, get_index
from app.experience.ontology import BY_KEY, StimulusConcept
from app.experience.scenes import interpret_scene
from app.experience.schemas import (
    CompiledExperience,
    Direction,
    ExperienceComponent,
    UnmappedContent,
)

log = logging.getLogger(__name__)

#: Below this similarity a clause is treated as describing nothing we support.
ACCEPT_FLOOR = 0.80
#: A second concept in the same clause must be close to the best to also fire.
SECOND_MARGIN = 0.965
#: Context-only concepts (hunger, arousal) need a clearer statement before we
#: even mention them, otherwise they attach themselves to any sentence about food.
UNSUPPORTED_FLOOR = 0.845

_CLAUSE_SPLIT = re.compile(
    r"""
    \s*(?:
        [;,.]|
        \bwhile\b|\bwhilst\b|\bwhereas\b|\bas\b(?=\s)|
        \band\s+(?:simultaneously|at\s+the\s+same\s+time|also|then)\b|
        \b(?:and|but|then)\b(?=\s+(?:a|an|the|it|its|something|suddenly|there|is|are|sees|smells|feels|hears|tastes|lands|senses))|
        \bsimultaneously\b|\bmeanwhile\b|\bat\s+the\s+same\s+time\b
    )\s*
    """,
    re.IGNORECASE | re.VERBOSE,
)

DIRECTION_PATTERNS: list[tuple[str, Direction]] = [
    (r"\b(left|port|sinister)\b", "left"),
    (r"\b(right|starboard)\b", "right"),
    (r"\b(above|overhead|from\s+the\s+top|upward|up\b|ceiling|sky)\b", "above"),
    (r"\b(below|beneath|underneath|under\b|downward|ground|floor|substrate)\b", "below"),
    (r"\b(behind|from\s+the\s+rear|backward|back\s+of)\b", "back"),
    (r"\b(ahead|in\s+front|frontal|forward|approaching\s+head[- ]on)\b", "front"),
    (r"\b(both\s+sides|all\s+around|surrounding|everywhere)\b", "bilateral"),
]

INTENSITY_UP = re.compile(
    r"\b(rapidly|rapid|fast|quickly|sudden|suddenly|violent|violently|huge|enormous|large|"
    r"massive|intense|strong|strongly|very|extremely|bright|loud|sharp|hard|abrupt|immediately)\b",
    re.IGNORECASE,
)
INTENSITY_DOWN = re.compile(
    r"\b(slight|slightly|faint|faintly|weak|weakly|gentle|gently|slow|slowly|small|tiny|"
    r"subtle|mild|distant|barely|softly|soft)\b",
    re.IGNORECASE,
)
# A fruit object is not itself evidence that an olfactory stimulus was described.
# Keep semantic retrieval, but gate this common false positive on an actual odor cue.
ODOR_CUE = re.compile(
    r"\b(smell\w*|smelt|odor\w*|odour\w*|scent\w*|aroma\w*|fragra\w*|"
    r"stench|stink\w*|pungent|whiff|sniff\w*|volatile\w*|vapou?r\w*|fumes?|plume)\b",
    re.IGNORECASE,
)

NEGATION = re.compile(
    r"\b(no|not|nothing|never|without|absent|lacks?|isn't|doesn't|cannot|can't)\b", re.IGNORECASE
)


@dataclass
class ClauseMatch:
    clause: str
    concept: StimulusConcept
    score: float


def split_clauses(text: str) -> list[str]:
    parts = [c.strip() for c in _CLAUSE_SPLIT.split(text) if c and c.strip()]
    parts = [p for p in parts if len(p) > 2]
    return parts or [text.strip()]


def extract_direction(clause: str) -> Direction | None:
    """Direction from *this clause only*.

    Deliberately no sentence-wide fallback: in "smells fruit while something
    approaches from the left", the "left" belongs to the looming object, not to
    the odour. A clause with no stated side yields ``None``, which the mapper
    reads as bilateral — both antennae, both eyes — which is the honest default.
    """
    for pattern, direction in DIRECTION_PATTERNS:
        if re.search(pattern, clause, re.IGNORECASE):
            return direction
    return None


def extract_intensity(clause: str) -> float:
    base = 0.68
    base += 0.11 * len(INTENSITY_UP.findall(clause))
    base -= 0.16 * len(INTENSITY_DOWN.findall(clause))
    return round(min(max(base, 0.15), 1.0), 3)


def is_negated(clause: str) -> bool:
    return bool(NEGATION.search(clause))


def compile_experience(
    text: str,
    *,
    index: SemanticIndex | None = None,
    accept_floor: float = ACCEPT_FLOOR,
) -> CompiledExperience:
    """Turn one English sentence into structured biological stimuli."""
    text = (text or "").strip()
    idx = index or get_index()
    clauses = split_clauses(text)

    components: dict[str, ExperienceComponent] = {}
    unmapped: list[UnmappedContent] = []
    seen_unsupported: set[str] = set()
    scene_interpretations = []
    interpreted_clauses = []
    for original in clauses:
        plan = interpret_scene(original)
        if plan:
            question = {
                "Social encounter": "Does the fly see the other fly moving, hear a courtship song, or make physical contact?",
                "Rain around the fly": "Do the droplets actually hit the fly, or is it sheltered from the rain?",
                "Capture or restraint": "Is the fly physically held or touching something, or simply enclosed in a container?",
            }[plan.label]
            scene_interpretations.append(
                {
                    "label": plan.label,
                    "original": original,
                    "assumptions": plan.assumptions,
                    "missing": plan.missing,
                    "question": question,
                }
            )
            interpreted_clauses.extend((original, cue, plan.assumptions) for cue in plan.cues)
            unmapped.append(
                UnmappedContent(
                    text=original,
                    reason="SCENE_CONTEXT_NOT_SIMULATED",
                    label=plan.label,
                    note=plan.missing,
                )
            )
        else:
            interpreted_clauses.append((original, original, None))

    for original, clause, scene_assumption in interpreted_clauses:
        ranked = idx.rank(clause)
        approach_cue = bool(
            re.search(r"\b(approach(?:es|ing)?|approaching|comes? closer)\b", clause, re.I)
            and re.search(
                r"\b(flies|fly|objects?|shadows?|predators?|hands?|balls?|birds?|something|someone)\b",
                clause,
                re.I,
            )
        )
        if approach_cue:
            ranked = [("visual_looming", 0.97)] + [
                (k, s) for k, s in ranked if k != "visual_looming"
            ]
        if not ranked:
            continue
        top_score = ranked[0][1]

        if top_score < accept_floor:
            unmapped.append(
                UnmappedContent(
                    text=clause,
                    reason="NO_SENSORY_MATCH",
                    note=(
                        "No supported biological stimulus matched this clause "
                        f"(best similarity {top_score:.2f} < {accept_floor:.2f})."
                    ),
                )
            )
            continue

        negated = is_negated(clause)
        accepted = 0
        for key, score in ranked[:3]:
            if score < accept_floor:
                break
            if accepted >= 1 and score < top_score * SECOND_MARGIN:
                break
            concept = BY_KEY[key]

            if concept.mapping_quality == "UNSUPPORTED":
                if score < UNSUPPORTED_FLOOR:
                    continue
                if key not in seen_unsupported:
                    seen_unsupported.add(key)
                    unmapped.append(
                        UnmappedContent(
                            text=clause,
                            reason="RECOGNISED_BUT_NOT_SIMULATED",
                            concept=key,
                            label=concept.label,
                            note=concept.caveat or concept.evidence,
                        )
                    )
                accepted += 1
                continue

            if negated:
                unmapped.append(
                    UnmappedContent(
                        text=clause,
                        reason="NEGATED",
                        concept=key,
                        label=concept.label,
                        note="Described as absent; no stimulus injected.",
                    )
                )
                accepted += 1
                continue

            if concept.key == "olfactory_fruit" and not ODOR_CUE.search(clause):
                unmapped.append(
                    UnmappedContent(
                        text=clause,
                        reason="CONTEXT_WITHOUT_SENSORY_CUE",
                        concept=key,
                        label="Fruit / food context",
                        note="An object or proximity to food does not establish an odor stimulus. No olfactory input injected.",
                    )
                )
                accepted += 1
                continue

            direction = extract_direction(original) if concept.population.lateralised else None
            intensity = extract_intensity(original)
            confidence = round(_calibrate(score, accept_floor), 3)
            if scene_assumption:
                confidence = min(confidence, 0.6)

            existing = components.get(key)
            if existing and existing.confidence >= confidence:
                accepted += 1
                continue

            repeated = bool(
                re.search(
                    r"\b(repeatedly|repeating|flashing|flicker\w*|blinking|again and again|on and off)\b",
                    clause,
                    re.I,
                )
            )
            sustained = bool(
                re.search(
                    r"\b(eating|feeding|drinking|continuously|constant|ongoing|sustained|keeps)\b",
                    clause,
                    re.I,
                )
            )
            pattern = "repeated" if repeated else "sustained" if sustained else "pulse"
            timing = {
                "pulse": ([0], "One input pulse at model step 0; model steps are not seconds."),
                "repeated": (
                    [0, 2, 4],
                    "Three repeated input events at model steps 0, 2 and 4. Illustrative timing: frequency and event count were not measured. Light ON/OFF-specific physiology is not reproduced.",
                ),
                "sustained": (
                    [0, 1, 2, 3, 4],
                    "Input maintained through model steps 0–4, then released. Illustrative duration, not a measured feeding or stimulus time.",
                ),
            }[pattern]
            caveat = concept.caveat
            quality = concept.mapping_quality
            if scene_assumption:
                quality = "APPROXIMATE_MAPPING"
                caveat = " ".join(x for x in [scene_assumption, caveat] if x)
            if approach_cue and key == "visual_looming":
                quality = "APPROXIMATE_MAPPING"
                caveat = "Approach is interpreted as an expanding visual image. Object identity, number, size and speed are not resolved; two approaching flies are not encoded as two separate objects."
            components[key] = ExperienceComponent(
                modality=concept.modality,
                stimulus=concept.key,
                label=concept.label,
                direction=direction,
                intensity=intensity,
                confidence=confidence,
                mapping_quality=quality,
                temporal_pattern=pattern,
                input_steps=timing[0],
                timing_note=timing[1],
                source_clause=original,
                evidence=concept.evidence,
                caveat=caveat,
            )
            accepted += 1

        if accepted == 0:
            unmapped.append(
                UnmappedContent(
                    text=clause,
                    reason="NO_SENSORY_MATCH",
                    note="No supported sensory interpretation survived the mapping checks; this clause was not simulated.",
                )
            )

    note = None
    if not components:
        note = (
            "No direct sensory mapping found. NEUROPULSE only stimulates populations this "
            "connectome actually annotates, so nothing was injected."
        )

    return CompiledExperience(
        raw_text=text,
        components=sorted(components.values(), key=lambda c: -c.confidence),
        unmapped=unmapped,
        parser=idx.name,
        clauses=clauses,
        note=note,
        scene_interpretations=scene_interpretations,
    )


def _calibrate(score: float, floor: float) -> float:
    """Rescale a raw similarity into a readable confidence above the accept floor."""
    span = max(1.0 - floor, 1e-6)
    return min(max((score - floor) / span, 0.0), 1.0) * 0.55 + 0.45
