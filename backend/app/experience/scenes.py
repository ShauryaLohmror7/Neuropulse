"""Disclosed scene assumptions, kept separate from measured sensory mappings.

These are bounded scenario interpretations, not a biological behavior generator.
Never seed motor/reward neurons merely because an intended action was named.
"""

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class ScenePlan:
    label: str
    cues: tuple[str, ...]
    assumptions: str
    missing: str


def interpret_scene(clause: str) -> ScenePlan | None:
    # Conservative clause-wide handling: do not turn absent/hypothetical events into input.
    if re.search(
        r"\b(no|not|never|without|isn't|doesn't|stops?|stopped|if|imagine)\b", clause, re.I
    ):
        return None
    if re.search(r"\b(rain|raining|rainfall|raindrops|downpour)\b", clause, re.I):
        sheltered = bool(
            re.search(r"\b(indoors|inside|shelter\w*|window|outside the room)\b", clause, re.I)
        )
        return ScenePlan(
            "Rain around the fly",
            ()
            if sheltered
            else ("something repeatedly touches its body", "the air is humid continuously"),
            "Shelter is mentioned, so rain outside is not injected as contact or local humidity."
            if sheltered
            else "Assuming the fly is exposed: droplets create repeated body contact and the local air is humid. No wind, cooling or darkness is assumed.",
            "Droplet size, impact force, body location and whether the fly is airborne are unspecified. Water physics and protective movements are not modeled.",
        )
    if re.search(r"\b(captured|caught|trapped|restrained|grabbed|held)\b", clause, re.I):
        enclosure = bool(re.search(r"\b(jar|bottle|room|box|cage|container)\b", clause, re.I))
        contact = bool(
            re.search(r"\b(grabbed|held|restrained|web|hand|fingers|net|touch\w*)\b", clause, re.I)
        )
        return ScenePlan(
            "Capture or restraint",
            ("something continuously touches its body",) if contact or not enclosure else (),
            "An enclosure alone does not imply physical contact; no contact input is invented."
            if enclosure and not contact
            else "Interpreting capture as ongoing physical contact with the body. The exact contact locations and force are unknown.",
            "Movement restriction, injury and escape attempts need a physical body/environment model. This simulation does not calculate whether escape succeeds.",
        )
    if re.search(
        r"\b(mate|mating|courtship|reproduce|reproduction|sex|aggression|aggressive|fight|fighting)\b",
        clause,
        re.I,
    ):
        moving = bool(
            re.search(r"\b(approach\w*|comes?|coming|moving|chases?|chasing)\b", clause, re.I)
        )
        social = bool(re.search(r"\b(fly|flies|female|male|mate|partner|rival)\b", clause, re.I))
        # Hearing courtship song already has a specific, supported auditory mapping.
        if re.search(r"\b(song|hears?|sound|buzz\w*|pheromone|acetate)\b", clause, re.I):
            return None
        if social:
            return ScenePlan(
                "Social encounter",
                ("something moving",) if moving else (),
                "Assuming the other fly is visible: its approach is represented as visual motion. Mating intent is not treated as an imminent collision."
                if moving
                else "Social intent alone does not specify a sensory stimulus. No sexual or aggression neurons are directly forced on.",
                "The other fly's sex, chemical cues, contact, motion geometry and the modeled male's internal state determine the response. Courtship, aggression and reproductive state are not resolved by this scene approximation.",
            )
    return None
