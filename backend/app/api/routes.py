"""NEUROPULSE HTTP API."""

from __future__ import annotations

import logging
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator

from app.api.state import CircuitMissingError, get_circuit, get_semantic_index
from app.experience.interpreter import from_ticket, interpret, interpreter_status
from app.experience.mapper import map_to_neurons, scheduled_drive, seed_drive
from app.experience.ontology import MODALITY_COLOUR, ONTOLOGY
from app.experience.parser import compile_experience
from app.experience.schemas import CompiledExperience
from app.simulation.lesion import lesion_and_compare
from app.simulation.parameters import DEFAULT_PARAMETERS, PropagationParameters
from app.simulation.propagation import NeuralState, propagate
from app.simulation.response import ModelledResponse, infer_response
from app.simulation.schemas import PropagationResult
from app.simulation.systems import system_activity

log = logging.getLogger(__name__)
router = APIRouter()


class CompileRequest(BaseModel):
    text: str = Field(max_length=600)


class SimulateRequest(BaseModel):
    ai_action_fallback: bool = False
    interpretation_ticket: str | None = Field(default=None, max_length=60000)
    text: str = Field(max_length=600)
    parameters: PropagationParameters | None = None
    lesion: list[int] = Field(default_factory=list)


class SimulationEnvelope(BaseModel):
    experience: CompiledExperience
    result: PropagationResult
    response: ModelledResponse
    rendered_activated: int = Field(
        description="Activated neurons with preloaded overview skeletons; excludes the separate full soma layer."
    )
    circuit: dict[str, Any]
    lesion: dict[str, Any] | None = None
    sequence: dict[str, Any] | None = None
    systems: list[dict[str, Any]] = Field(default_factory=list)


def _circuit():
    try:
        return get_circuit()
    except CircuitMissingError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.get("/health")
def health() -> dict[str, Any]:
    out: dict[str, Any] = {"status": "ok"}
    try:
        c = get_circuit()
        out["circuit"] = {
            "neurons": c.graph.n_nodes,
            "edges": c.graph.n_edges,
            "rendered": len(c.rendered_ids),
            "dataset": c.provenance.get("dataset"),
            "datasetVersion": c.provenance.get("dataset_version"),
        }
    except CircuitMissingError as e:
        out["status"] = "degraded"
        out["circuit_error"] = str(e)
    try:
        out["parser"] = get_semantic_index().name
    except Exception as e:  # pragma: no cover
        out["parser_error"] = str(e)[:200]
    out["interpreter"] = interpreter_status()
    return out


@router.get("/ontology")
def ontology() -> dict[str, Any]:
    """The supported sensory vocabulary, with mapping quality and evidence."""
    return {
        "concepts": [
            {
                "key": c.key,
                "modality": c.modality,
                "label": c.label,
                "description": c.description,
                "mappingQuality": c.mapping_quality,
                "evidence": c.evidence,
                "caveat": c.caveat,
                "examplePhrases": c.phrases[:4],
            }
            for c in ONTOLOGY
        ],
        "modalityColours": MODALITY_COLOUR,
    }


@router.get("/provenance")
def provenance() -> dict[str, Any]:
    c = _circuit()
    return {
        "provenance": c.provenance,
        "transform": c.doc.get("transform"),
        "counts": c.doc.get("counts"),
        "policy": c.doc.get("policy"),
    }


class InterpretRequest(CompileRequest):
    mode: Literal["local", "llm"] = "local"


@router.get("/interpreter")
def interpreter_info():
    return interpreter_status()


@router.post("/interpret")
def interpret_input(req: InterpretRequest):
    return interpret(req.text, req.mode, index=get_semantic_index())


def _experience(req):
    if req.interpretation_ticket:
        try:
            return from_ticket(req.interpretation_ticket, req.text)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
    return compile_experience(req.text, index=get_semantic_index())


@router.post("/compile")
def compile_only(req: CompileRequest) -> CompiledExperience:
    c = _circuit()
    exp = compile_experience(req.text, index=get_semantic_index())
    return map_to_neurons(exp, c.seed_sets, c.node_meta)


@router.post("/simulate")
def simulate(req: SimulateRequest) -> SimulationEnvelope:
    from app.simulation.action_hypothesis import attach_hypothesis
    return attach_hypothesis(_simulate(req), _circuit().node_meta, req.ai_action_fallback)


def _simulate(req: SimulateRequest, initial_state=None, capture_state=None) -> SimulationEnvelope:
    c = _circuit()
    params = req.parameters or DEFAULT_PARAMETERS

    exp = _experience(req)
    map_to_neurons(exp, c.seed_sets, c.node_meta)
    drive, modality = seed_drive(exp)
    schedule = scheduled_drive(exp)
    if req.parameters is None and any(c.temporal_pattern != "pulse" for c in exp.components):
        params = DEFAULT_PARAMETERS.model_copy(update={"steps": 10})

    graph = c.graph
    lesion_info: dict[str, Any] | None = None
    if req.lesion:
        cmp_ = lesion_and_compare(
            graph,
            drive,
            req.lesion,
            params=params,
            seed_modalities=modality,
            input_schedule=schedule,
        )
        result = cmp_.lesioned
        lesion_info = {
            "lesionedBodyIds": cmp_.lesioned_body_ids,
            "deltaNeurons": cmp_.delta_neurons_activated,
            "deltaConnections": cmp_.delta_connections_traversed,
            "deltaDepth": cmp_.delta_propagation_depth,
            "lostNeurons": cmp_.lost_neurons[:400],
            "regionsLost": cmp_.regions_lost,
            "caveat": cmp_.caveat,
            "normalMetrics": cmp_.normal.metrics.model_dump(),
        }
    else:
        result = propagate(
            graph,
            drive,
            params=params,
            seed_modalities=modality,
            input_schedule=schedule,
            initial_state=initial_state,
            capture_state=capture_state,
        )

    response = infer_response(result.activations, c.node_meta)
    from app.simulation.interpretation import explain_result

    response = explain_result(response, exp, result, c.node_meta)
    rendered_activated = sum(1 for a in result.activations if a.body_id in c.rendered_ids)

    return SimulationEnvelope(
        experience=exp,
        result=result,
        response=response,
        rendered_activated=rendered_activated,
        circuit={
            "name": c.doc.get("name"),
            "neurons": graph.n_nodes,
            "edges": graph.n_edges,
            "rendered": len(c.rendered_ids),
            "dataset": f"{c.provenance.get('dataset')} {c.provenance.get('dataset_version')}",
        },
        lesion=lesion_info,
        systems=system_activity(result, c.node_meta, params.activation_threshold),
    )


class SequenceRequest(BaseModel):
    ai_action_fallback: bool = False
    interpretation_tickets: list[Annotated[str | None, Field(max_length=60000)]] | None = Field(
        default=None, max_length=6
    )
    events: list[Annotated[str, Field(max_length=600)]] = Field(min_length=1, max_length=6)

    @model_validator(mode="after")
    def matching_tickets(self):
        if self.interpretation_tickets is not None and len(self.interpretation_tickets) != len(
            self.events
        ):
            raise ValueError("Each event needs a matching interpretation ticket or null")
        return self


@router.post("/simulate-sequence")
def simulate_sequence(req: SequenceRequest) -> SimulationEnvelope:
    # Request-local recomputation avoids hidden shared sessions, lost state and stale tokens.
    # Each prefix is reproduced exactly; full activity/refractory arrays cross boundaries.
    state: NeuralState | None = None
    trace = []
    for event_index, text in enumerate(req.events):
        captured = []
        carried = (
            int((state.activity > DEFAULT_PARAMETERS.activation_threshold).sum())
            if state is not None
            else 0
        )
        ticket = req.interpretation_tickets[event_index] if req.interpretation_tickets else None
        envelope = _simulate(
            SimulateRequest(text=text, interpretation_ticket=ticket), state, captured.append
        )
        state = captured[0]
        trace.append(
            {
                "text": text or "No new stimulus · let activity settle",
                "reached": envelope.result.metrics.neurons_activated,
                "carried_active": carried,
                "steps": len(envelope.result.steps) - 1,
            }
        )
    envelope.sequence = {
        "events": trace,
        "mode": "continuous_state",
        "carried_active": trace[-1]["carried_active"],
        "note": "Activity and refractory state persist between events. Model time advances only when an event runs. Synaptic weights do not learn; this is not biological memory.",
    }
    if len(trace) > 1:
        envelope.response.neural_summary.insert(
            0,
            f"Continuing event {len(trace)}: {trace[-1]['carried_active']:,} neurons entered above threshold from the previous state. Responses may reflect earlier inputs as well as this event.",
        )
        envelope.response.limitations.append(envelope.sequence["note"])
        if not envelope.experience.components and envelope.result.activations:
            if envelope.response.confidence == "NONE":
                envelope.response.interpretation_kind = "sensory_only"
                envelope.response.headline = "Earlier activity is settling"
                envelope.response.plain_language = "Activity from the earlier event is decaying through the model. No new sensory input was added, and no biological learning is implied."
                envelope.response.detail = "No new sensory input was injected. This response comes from the retained neural state; it is not a response to unsupported words."
    from app.simulation.action_hypothesis import attach_hypothesis
    return attach_hypothesis(envelope, _circuit().node_meta, req.ai_action_fallback)


def _detail(body_id: int):
    from app.connectome.detail import get_detail

    if body_id <= 0:
        raise HTTPException(status_code=404, detail="Unknown circuit neuron")
    try:
        return get_detail(body_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail="Body ID is not in this real circuit") from e
    except Exception as e:
        log.warning("Full-detail fetch failed for bodyId=%d: %s", body_id, type(e).__name__)
        raise HTTPException(
            status_code=503,
            detail="Verified full-detail morphology is unavailable. The overview remains a labeled LOD; no synthetic replacement was made.",
        ) from e


@router.get("/neurons/{body_id}/detail")
def neuron_detail(body_id: int):
    manifest, _ = _detail(body_id)
    return manifest


@router.get("/neurons/{body_id}/detail.bin")
def neuron_detail_binary(body_id: int):
    from fastapi.responses import FileResponse

    manifest, path = _detail(body_id)
    return FileResponse(
        path, media_type="application/octet-stream", headers={"ETag": f'"{manifest["sha256"]}"'}
    )


@router.get("/dataset/catalogue")
def full_catalogue():
    from fastapi.responses import FileResponse

    from app.config import REPO_ROOT

    _circuit()
    return FileResponse(REPO_ROOT / "data/full-cns/catalogue.json", media_type="application/json")


@router.get("/neurons/{body_id}/connections")
def neuron_connections(body_id: int, offset: int = 0, limit: int = 8):
    import numpy as np

    if offset < 0 or not 1 <= limit <= 200:
        raise HTTPException(422, "offset must be nonnegative; limit must be 1–200")
    graph = _circuit().graph
    i = graph.node_index(body_id)
    if i is None:
        raise HTTPException(404, "Not an annotated neuron in this dataset")
    incident = np.flatnonzero((graph.sources == i) | (graph.targets == i))
    order = incident[np.argsort(-graph.weights[incident], kind="stable")]
    return {
        "total": len(incident),
        "offset": offset,
        "connections": [
            {
                "source": int(graph.body_ids[graph.sources[k]]),
                "target": int(graph.body_ids[graph.targets[k]]),
                "weight": int(graph.weights[k]),
            }
            for k in order[offset : offset + limit]
        ],
    }
