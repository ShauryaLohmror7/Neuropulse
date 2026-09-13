"""Infer a *modelled* behavioural tendency from which real output neurons activate.

This module never asks a language model what a fly would do.  It reads the
propagation result, checks which annotated descending and motor neurons crossed
threshold, and reports the behaviours those specific cells are known from the
published literature to drive.

Everything it produces is MODELLED / INFERRED:

  * The neuron identities and their annotations are real MaleCNS v1.0 data.
  * Whether those neurons "activate" comes from our simplified propagation model.
  * The neuron -> behaviour links are citations to published physiology in other
    animals of the same species, not observations of this connectome.

A prediction is therefore a statement of the form: "the simplified model drove
the cells that the literature associates with X".  It is not a statement that a
fly given this experience would do X.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, Mapping, Sequence

from pydantic import BaseModel, Field

EvidenceTier = Literal["STRONG", "MODERATE", "WEAK"]


@dataclass(frozen=True)
class ResponseChannel:
    """A behaviour with identified command/motor neurons in this dataset."""

    key: str
    label: str
    #: Exact MaleCNS `type` values. Verified present in male-cns:v1.0.
    marker_types: tuple[str, ...]
    evidence_tier: EvidenceTier
    evidence: str
    #: If True, a left/right imbalance in these cells implies a direction.
    directional: bool = False
    #: Behaviours this one competes with, for conflict reporting.
    opposes: tuple[str, ...] = ()


CHANNELS: tuple[ResponseChannel, ...] = (
    ResponseChannel(
        key="escape_takeoff",
        label="Escape takeoff",
        marker_types=("DNp01",),
        evidence_tier="STRONG",
        evidence=(
            "DNp01 is the Giant Fibre, the best-characterised command neuron in the fly. It "
            "receives looming input from LC4 and LPLC2 and drives the short-mode escape takeoff "
            "(von Reyn et al. 2014, 2017; Ache et al. 2019). Its LC4/LPLC2 input is present in "
            "this connectome."
        ),
        directional=True,
        opposes=("feeding_proboscis", "courtship_song"),
    ),
    ResponseChannel(
        key="escape_generic",
        label="Escape / avoidance manoeuvre",
        marker_types=("DNp02", "DNp04", "DNp06", "DNp11"),
        evidence_tier="MODERATE",
        evidence=(
            "DNp02, DNp04, DNp06 and DNp11 are looming-responsive descending neurons implicated "
            "in escape and avoidance manoeuvres, including the slower long-mode escape "
            "(Namiki et al. 2018; Ache et al. 2019). Their individual behavioural roles are less "
            "completely resolved than DNp01's."
        ),
        directional=True,
        opposes=("feeding_proboscis",),
    ),
    ResponseChannel(
        key="steering_turn",
        label="Steering / turn",
        marker_types=("DNa01", "DNa02"),
        evidence_tier="STRONG",
        evidence=(
            "DNa01 and DNa02 are steering descending neurons: their left/right activity "
            "difference correlates with and drives turning during walking "
            "(Rayshubskiy et al. 2020; Chen et al. 2018)."
        ),
        directional=True,
    ),
    ResponseChannel(
        key="freeze_stop",
        label="Freezing / stopping",
        marker_types=("DNp09",),
        evidence_tier="MODERATE",
        evidence=(
            "DNp09 activation drives freezing and locomotor arrest in response to threat "
            "(Zacarias et al. 2018)."
        ),
        opposes=("escape_takeoff",),
    ),
    ResponseChannel(
        key="backward_walking",
        label="Backward walking",
        marker_types=("MDN",),
        evidence_tier="STRONG",
        evidence=(
            "The Moonwalker Descending Neuron (MDN) is sufficient and necessary for backward "
            "walking (Bidaye et al. 2014)."
        ),
    ),
    ResponseChannel(
        key="courtship_song",
        label="Courtship song",
        marker_types=("pIP10",),
        evidence_tier="STRONG",
        evidence=(
            "pIP10 is a male-specific descending neuron that drives courtship song "
            "(von Philipsborn et al. 2011). MaleCNS is a male nervous system, so this pathway "
            "is anatomically present."
        ),
        opposes=("escape_takeoff",),
    ),
    ResponseChannel(
        key="feeding_proboscis",
        label="Proboscis extension (feeding)",
        marker_types=("MN9", "MN11D", "MN11V", "MN12D"),
        evidence_tier="MODERATE",
        evidence=(
            "MN9 and the other proboscis motor neurons (subclass 'pm' in MaleCNS) drive "
            "proboscis extension; MN9 in particular is required for the proboscis extension "
            "response to sugar (Gordon & Scott 2009)."
        ),
        opposes=("escape_takeoff", "escape_generic"),
    ),
)

BY_KEY = {c.key: c for c in CHANNELS}


class ChannelReadout(BaseModel):
    """What the model actually did to one behavioural channel's neurons."""

    key: str
    label: str
    evidence_tier: EvidenceTier
    evidence: str
    neurons_in_circuit: int = Field(description="Marker neurons present in this subgraph.")
    neurons_activated: int
    mean_activation: float
    peak_activation: float
    earliest_step: int | None
    left_activation: float = 0.0
    right_activation: float = 0.0
    direction: str | None = Field(
        default=None, description="'left'/'right' when a lateral imbalance is meaningful."
    )
    body_ids: list[int] = Field(default_factory=list)


class ModelledResponse(BaseModel):
    """The overall inferred tendency, with its basis fully inspectable."""

    interpretation_kind: Literal["behavioral_marker", "sensory_only", "no_input"] = (
        "behavioral_marker"
    )
    neural_summary: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    output_evidence: list[dict[str, Any]] = Field(default_factory=list)
    headline: str
    detail: str | None = None
    confidence: EvidenceTier | Literal["NONE"] = "NONE"
    channels: list[ChannelReadout] = Field(default_factory=list)
    competing: list[str] = Field(default_factory=list)
    direction: str | None = None
    disclaimer: str = (
        "MODELLED INFERENCE. Neuron identities and connectivity are real MaleCNS v1.0 data; "
        "activation comes from a simplified propagation model, and the neuron-to-behaviour links "
        "are citations to published physiology — not an observation of this animal. This is not "
        "a prediction of what a real fly would do."
    )


#: A channel must reach this fraction of its marker neurons to count as engaged.
ENGAGEMENT_FRACTION = 0.34
#: ...and this activation level, so a trace of leaked signal does not read as a behaviour.
ENGAGEMENT_ACTIVATION = 0.09
#: Lateral imbalance needed before we call a direction.
DIRECTION_RATIO = 1.35


def infer_response(
    activations: Sequence[Any],
    node_meta: Mapping[int, Mapping[str, Any]],
) -> ModelledResponse:
    """Read out behavioural channels from a propagation result.

    ``activations`` is the ``PropagationResult.activations`` list;
    ``node_meta`` maps bodyId -> the neuron's real annotations.
    """
    act_by_id = {int(a.body_id): a for a in activations}

    # Which marker neurons exist in this circuit at all?
    markers: dict[str, list[int]] = {c.key: [] for c in CHANNELS}
    for body_id, meta in node_meta.items():
        t = meta.get("type")
        if not t:
            continue
        for c in CHANNELS:
            if t in c.marker_types:
                markers[c.key].append(int(body_id))

    readouts: list[ChannelReadout] = []
    for c in CHANNELS:
        ids = markers[c.key]
        if not ids:
            continue
        hits = [(b, act_by_id[b]) for b in ids if b in act_by_id]
        left = right = 0.0
        for b, a in hits:
            side = str(node_meta[b].get("side") or node_meta[b].get("somaSide") or "")
            if side == "L":
                left += a.activation
            elif side == "R":
                right += a.activation
        acts = [a.activation for _b, a in hits]
        # Left/right sums report anatomy. They are not a validated motor decoder.
        direction = None
        readouts.append(
            ChannelReadout(
                key=c.key,
                label=c.label,
                evidence_tier=c.evidence_tier,
                evidence=c.evidence,
                neurons_in_circuit=len(ids),
                neurons_activated=len(hits),
                mean_activation=round(sum(acts) / len(acts), 4) if acts else 0.0,
                peak_activation=round(max(acts), 4) if acts else 0.0,
                earliest_step=min((a.step for _b, a in hits), default=None),
                left_activation=round(left, 4),
                right_activation=round(right, 4),
                direction=direction,
                body_ids=sorted(b for b, _a in hits),
            )
        )

    engaged = [
        r
        for r in readouts
        if r.neurons_in_circuit
        and r.neurons_activated / r.neurons_in_circuit >= ENGAGEMENT_FRACTION
        and r.peak_activation >= ENGAGEMENT_ACTIVATION
    ]
    engaged.sort(key=lambda r: (-_tier_rank(r.evidence_tier), -r.peak_activation))

    if not engaged:
        return ModelledResponse(
            headline="No defensible behavioural prediction",
            detail=(
                "No annotated output channel met this model’s engagement thresholds. "
                "Some output neurons may have been reached at subthreshold strength; "
                "that is insufficient to infer a response."
            ),
            confidence="NONE",
            channels=readouts,
        )

    primary = engaged[0]
    competing = _find_conflicts(engaged)

    headline = primary.label
    detail_bits = [
        f"{primary.neurons_activated}/{primary.neurons_in_circuit} "
        f"{'/'.join(BY_KEY[primary.key].marker_types)} activated by step {primary.earliest_step}"
    ]
    if len(engaged) > 1:
        detail_bits.append("also engaged: " + ", ".join(r.label.lower() for r in engaged[1:3]))

    return ModelledResponse(
        headline=f"{headline} tendency (modeled)",
        detail="; ".join(detail_bits),
        confidence=primary.evidence_tier,
        channels=readouts,
        competing=competing,
        direction=primary.direction,
    )


def _tier_rank(t: str) -> int:
    return {"STRONG": 3, "MODERATE": 2, "WEAK": 1}.get(t, 0)


def _find_conflicts(engaged: Sequence[ChannelReadout]) -> list[str]:
    keys = {r.key for r in engaged}
    out: list[str] = []
    for r in engaged:
        for other in BY_KEY[r.key].opposes:
            if other in keys:
                pair = sorted([r.label, BY_KEY[other].label])
                msg = f"{pair[0]} vs {pair[1]}"
                if msg not in out:
                    out.append(msg)
    return out
