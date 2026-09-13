"""Parameters of the propagation model, with the reasoning for each default.

Every value here is a *modelling choice*, not a measured biological constant.
They are tuned so that a cascade through a real MaleCNS subgraph stays legible
on screen (hundreds of neurons over a handful of steps) rather than saturating.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class PropagationParameters(BaseModel):
    """Tunable knobs for :func:`app.simulation.propagation.propagate`."""

    steps: int = Field(
        default=6,
        ge=1,
        le=12,
        description="Number of discrete propagation steps (≈ synaptic hops).",
    )
    decay: float = Field(
        default=0.72,
        gt=0.0,
        le=1.0,
        description="Per-step multiplicative attenuation of transmitted signal.",
    )
    self_decay: float = Field(
        default=0.55,
        ge=0.0,
        le=1.0,
        description="How much of a neuron's own activation persists into the next step.",
    )
    activation_threshold: float = Field(
        default=0.035,
        ge=0.0,
        description="Minimum incoming drive for a neuron to count as activated.",
    )
    max_activation: float = Field(
        default=1.0, gt=0.0, description="Saturating ceiling on activation."
    )
    refractory_steps: int = Field(
        default=1,
        ge=0,
        le=4,
        description=(
            "Steps after firing during which a neuron cannot re-ignite. A coarse stand-in "
            "for refractoriness/adaptation; not a modelled ion channel."
        ),
    )
    top_k_edges: int | None = Field(
        default=None,
        ge=1,
        description="Optional explicit edge cap; null uses every outgoing connection.",
    )
    min_edge_weight: int = Field(
        default=1,
        ge=1,
        description="Synaptic-weight floor; weaker connections are ignored as unreliable.",
    )
    use_neurotransmitter_sign: bool = Field(
        default=True,
        description=(
            "If the dataset provides a neurotransmitter prediction with sufficient "
            "confidence, treat GABA/glutamate as inhibitory and ACh as excitatory. "
            "Neurons without a confident prediction stay excitatory-neutral."
        ),
    )
    nt_confidence_floor: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Minimum NT-prediction confidence before a sign is applied.",
    )
    inhibition_strength: float = Field(
        default=0.85,
        ge=0.0,
        le=2.0,
        description="Scale applied to inhibitory transmission.",
    )
    weight_normalisation: str = Field(
        default="target_input",
        description=(
            "'target_input' divides each edge by the target's total incoming weight "
            "within the subgraph (so a neuron with many inputs needs many of them "
            "active); 'source_output' divides by the source's outgoing total; "
            "'log' uses log1p(weight) normalised per source."
        ),
    )


DEFAULT_PARAMETERS = PropagationParameters()
