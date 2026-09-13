"""NEUROPULSE HTTP API."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.state import CircuitMissingError, get_circuit, get_semantic_index
from app.experience.mapper import map_to_neurons, seed_drive
from app.experience.ontology import MODALITY_COLOUR, ONTOLOGY
from app.experience.parser import compile_experience
from app.experience.schemas import CompiledExperience
from app.simulation.lesion import lesion_and_compare
from app.simulation.parameters import DEFAULT_PARAMETERS, PropagationParameters
from app.simulation.propagation import propagate
from app.simulation.response import ModelledResponse, infer_response
from app.simulation.schemas import PropagationResult

log = logging.getLogger(__name__)
router = APIRouter()


class CompileRequest(BaseModel):
    text: str = Field(max_length=600)


class SimulateRequest(BaseModel):
    text: str = Field(max_length=600)
    parameters: PropagationParameters | None = None
    lesion: list[int] = Field(default_factory=list)


class SimulationEnvelope(BaseModel):
    experience: CompiledExperience
    result: PropagationResult
    response: ModelledResponse
    rendered_activated: int = Field(
        description="Activated neurons that have real morphology in the scene."
    )
    circuit: dict[str, Any]
    lesion: dict[str, Any] | None = None


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


@router.post("/compile")
def compile_only(req: CompileRequest) -> CompiledExperience:
    c = _circuit()
    exp = compile_experience(req.text, index=get_semantic_index())
    return map_to_neurons(exp, c.seed_sets, c.node_meta)


@router.post("/simulate")
def simulate(req: SimulateRequest) -> SimulationEnvelope:
    c = _circuit()
    params = req.parameters or DEFAULT_PARAMETERS

    exp = compile_experience(req.text, index=get_semantic_index())
    map_to_neurons(exp, c.seed_sets, c.node_meta)
    drive, modality = seed_drive(exp)

    graph = c.graph
    lesion_info: dict[str, Any] | None = None
    if req.lesion:
        cmp_ = lesion_and_compare(graph, drive, req.lesion, params=params,
                                  seed_modalities=modality)
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
        result = propagate(graph, drive, params=params, seed_modalities=modality)

    response = infer_response(result.activations, c.node_meta)
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
    )


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
        raise HTTPException(status_code=503, detail="Verified full-detail morphology is unavailable. The overview remains a labeled LOD; no synthetic replacement was made.") from e


@router.get('/neurons/{body_id}/detail')
def neuron_detail(body_id: int):
    manifest, _ = _detail(body_id)
    return manifest


@router.get('/neurons/{body_id}/detail.bin')
def neuron_detail_binary(body_id: int):
    from fastapi.responses import FileResponse
    manifest, path = _detail(body_id)
    return FileResponse(path, media_type='application/octet-stream', headers={'ETag': f'"{manifest["sha256"]}"'})
