"""Structured output of the experience compiler."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.experience.ontology import MappingQuality, Modality

Direction = Literal["left", "right", "front", "back", "above", "below", "bilateral"]


class ExperienceComponent(BaseModel):
    """One biological stimulus extracted from the user's sentence."""

    modality: Modality
    stimulus: str = Field(description="Ontology concept key, e.g. 'visual_looming'.")
    label: str
    direction: Direction | None = None
    intensity: float = Field(default=0.7, ge=0.0, le=1.0)
    confidence: float = Field(
        default=0.0, ge=0.0, le=1.0, description="How sure the parser is this was described."
    )
    mapping_quality: MappingQuality
    source_clause: str
    evidence: str
    caveat: str | None = None
    temporal_pattern: Literal["pulse", "repeated", "sustained"] = "pulse"
    input_steps: list[int] = Field(default_factory=lambda: [0])
    timing_note: str = "One input pulse at model step 0; model steps are not seconds."
    #: Real neurons this component will stimulate. Filled by the mapper.
    body_ids: list[int] = Field(default_factory=list)
    neuron_count: int = 0
    seed_types: list[str] = Field(default_factory=list)


class UnmappedContent(BaseModel):
    """Semantic content we recognised but will not inject into the simulation."""

    text: str
    reason: str
    concept: str | None = None
    label: str | None = None
    note: str | None = None


class CompiledExperience(BaseModel):
    raw_text: str
    components: list[ExperienceComponent] = Field(default_factory=list)
    unmapped: list[UnmappedContent] = Field(default_factory=list)
    parser: str = Field(description="Which semantic backend produced this.")
    clauses: list[str] = Field(default_factory=list)
    note: str | None = None

    @property
    def modalities(self) -> list[str]:
        return sorted({c.modality for c in self.components})
