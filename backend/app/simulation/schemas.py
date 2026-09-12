"""Pydantic types shared by the simulation layer and the HTTP API."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class NeuronActivation(BaseModel):
    body_id: int
    activation: float
    step: int = Field(description="Step at which this neuron first crossed threshold.")


class PulseEvent(BaseModel):
    """One signal transmission along a real synaptic connection.

    This is what the renderer animates: a pulse leaving ``source`` at ``step``
    and arriving at ``target``.
    """

    step: int
    source: int
    target: int
    weight: float = Field(description="Real synapse count for this connection.")
    amplitude: float = Field(description="Modelled signal amplitude carried by this pulse.")
    sign: Literal[-1, 1] = Field(default=1, description="+1 excitatory, -1 inhibitory (NT-derived).")
    modality: str | None = Field(
        default=None, description="Sensory stream this pulse descends from, when unambiguous."
    )


class StepSummary(BaseModel):
    step: int
    newly_activated: int
    active_total: int
    mean_activation: float
    pulses: int


class SimulationMetrics(BaseModel):
    neurons_activated: int
    connections_traversed: int
    propagation_depth: int
    regions_reached: list[str]
    modalities: list[str]
    total_synapses_traversed: int
    nt_coverage: dict[str, Any] = Field(default_factory=dict)


class PropagationResult(BaseModel):
    metrics: SimulationMetrics
    steps: list[StepSummary]
    activations: list[NeuronActivation]
    pulses: list[PulseEvent]
    seeds: dict[str, list[int]] = Field(
        default_factory=dict, description="Seed bodyIds keyed by modality."
    )
    model_note: str = (
        "Connectivity, synapse counts and neuron annotations are real MaleCNS v1.0 data. "
        "Activation values are produced by a simplified deterministic propagation model "
        "and are not predicted firing rates."
    )
