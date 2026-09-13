"""Map compiled experience components onto real neurons in a cached circuit.

The circuit bundle already contains the seed sets that were resolved from live
MaleCNS annotations at build time, keyed ``"<concept>:<side>"``.  Mapping is
therefore a lookup, not a new query: the neurons an experience stimulates are
exactly the neurons the build script recorded, with full provenance.

Laterality follows the animal, not the screen: a stimulus on the fly's left is
transduced by left-side sensory neurons.  A component with no stated side
stimulates both sides, which is the honest default for an unlocalised stimulus.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

from app.experience.schemas import CompiledExperience

log = logging.getLogger(__name__)

#: Directions that select one body side. "above"/"below"/"front"/"back" carry no
#: left/right information, so they stimulate bilaterally.
SIDE_OF_DIRECTION: dict[str, tuple[str, ...]] = {
    "left": ("L",),
    "right": ("R",),
    "bilateral": ("L", "R"),
}


def sides_for(direction: str | None) -> tuple[str, ...]:
    if direction is None:
        return ("L", "R")
    return SIDE_OF_DIRECTION.get(direction, ("L", "R"))


def map_to_neurons(
    experience: CompiledExperience,
    seed_sets: Mapping[str, Sequence[int]],
    node_meta: Mapping[int, Mapping[str, Any]] | None = None,
) -> CompiledExperience:
    """Attach real bodyIds to every component. Mutates and returns ``experience``."""
    for comp in experience.components:
        ids: list[int] = []
        all_key = f"{comp.stimulus}:all"
        if comp.direction not in ("left", "right") and all_key in seed_sets:
            ids.extend(int(b) for b in seed_sets[all_key])
        else:
            for side in sides_for(comp.direction):
                ids.extend(int(b) for b in seed_sets.get(f"{comp.stimulus}:{side}", []))
        comp.body_ids = sorted(set(ids))
        comp.neuron_count = len(comp.body_ids)
        if node_meta:
            comp.seed_types = sorted(
                {
                    str(node_meta[b].get("type"))
                    for b in comp.body_ids
                    if b in node_meta and node_meta[b].get("type")
                }
            )[:12]
        if not comp.body_ids:
            log.warning("component %s mapped to no neurons in this circuit", comp.stimulus)
    return experience


def seed_drive(experience: CompiledExperience) -> tuple[dict[int, float], dict[int, str]]:
    """Initial activation per neuron, plus the modality each seed belongs to.

    Drive is the component's intensity scaled by parser confidence: a stimulus we
    are less sure was described enters the network more weakly, so uncertainty in
    the language shows up as a dimmer cascade rather than a silent guess.
    """
    drive: dict[int, float] = {}
    modality: dict[int, str] = {}
    for comp in experience.components:
        if not comp.body_ids:
            continue
        level = float(min(comp.intensity * (0.55 + 0.45 * comp.confidence), 1.0))
        for b in comp.body_ids:
            if level > drive.get(b, 0.0):
                drive[b] = level
                modality[b] = comp.modality
    return drive, modality
