"""NEUROPULSE backend entrypoint."""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")

app = FastAPI(
    title="NEUROPULSE",
    description=(
        "Connectome-constrained experience simulation on the MaleCNS v1.0 Drosophila "
        "connectome. Neuron identities, connectivity, synapse counts, annotations and 3D "
        "morphology are real data from https://male-cns.janelia.org/ served via neuPrint. "
        "Activation dynamics and behavioural inference are explicitly modelled."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.on_event("startup")
def _warm() -> None:
    """Load the circuit and semantic index up front so the first click is fast."""
    from app.api.state import CircuitMissingError, get_circuit, get_semantic_index

    settings = get_settings()
    settings.ensure_dirs()
    try:
        get_circuit()
    except CircuitMissingError as e:
        logging.warning("circuit not available: %s", str(e).splitlines()[0])
    try:
        get_semantic_index()
    except Exception as e:  # pragma: no cover
        logging.warning("semantic index unavailable: %s", str(e)[:200])
