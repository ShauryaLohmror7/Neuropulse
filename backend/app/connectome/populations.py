"""Resolve ontology population queries to real MaleCNS bodyIds."""

from __future__ import annotations

import logging
from typing import Any

import pandas as pd
from neuprint import fetch_custom

from app.connectome.client import get_client
from app.connectome.queries import available_keys
from app.experience.ontology import PopulationQuery, StimulusConcept

log = logging.getLogger(__name__)

#: MaleCNS annotates laterality in two fields: `rootSide` for peripheral sensory
#: neurons (which side of the body the axon enters from) and `somaSide` for
#: central and optic-lobe neurons. Coalescing them covers both.
SIDE_EXPR = "coalesce(n.somaSide, n.rootSide)"


def _cypher_for(pop: PopulationQuery, side: str | None) -> str:
    clauses: list[str] = []
    if pop.cell_types:
        clauses.append(f"n.type IN {list(pop.cell_types)!r}")
    if pop.type_regex:
        clauses.append(f"n.type =~ {pop.type_regex!r}")
    if pop.neuron_class:
        clauses.append(f"n.`class` IN {list(pop.neuron_class)!r}")
    if pop.subclass:
        clauses.append(f"n.subclass IN {list(pop.subclass)!r}")
    if pop.exclude_subclass:
        clauses.append(
            f"(n.subclass IS NULL OR NOT n.subclass IN {list(pop.exclude_subclass)!r})"
        )
    if pop.exclude_types:
        clauses.append(f"(n.type IS NULL OR NOT n.type IN {list(pop.exclude_types)!r})")
    if pop.superclass:
        clauses.append(f"n.superclass IN {list(pop.superclass)!r}")
    if pop.entry_nerve:
        clauses.append(f"n.entryNerve IN {list(pop.entry_nerve)!r}")
    if side and pop.lateralised:
        clauses.append(f"{SIDE_EXPR} = {side!r}")

    if not clauses:
        raise ValueError("Refusing to run an unconstrained neuron query.")

    keys = [k for k in available_keys()]
    ret = ", ".join(f"n.`{k}` AS `{k}`" for k in keys)
    return f"""
        MATCH (n:Neuron)
        WHERE {' AND '.join(clauses)}
        RETURN {ret}, {SIDE_EXPR} AS side, n.synweight AS _sw
        ORDER BY _sw DESC
        LIMIT {int(pop.max_neurons)}
    """


def resolve_population(concept: StimulusConcept, side: str | None = None) -> pd.DataFrame:
    """Real neurons matching a concept, optionally restricted to one body side.

    ``side`` is 'L' or 'R' as annotated by ``rootSide`` — the side of the body the
    sensory neuron enters from.
    """
    pop = concept.population
    if pop.max_neurons <= 0:
        return pd.DataFrame()
    df = fetch_custom(_cypher_for(pop, side), client=get_client())
    if "_sw" in df.columns:
        df = df.drop(columns=["_sw"])
    return df.reset_index(drop=True)


def population_summary(concept: StimulusConcept) -> dict[str, Any]:
    """Counts per side — used to verify the ontology against the live dataset."""
    out: dict[str, Any] = {"key": concept.key, "quality": concept.mapping_quality}
    for side in ("L", "R", None):
        try:
            df = resolve_population(concept, side)
            out["both" if side is None else side] = len(df)
            if side is None and len(df):
                out["example_types"] = sorted({str(t) for t in df["type"].dropna()})[:6]
        except Exception as e:  # pragma: no cover - network
            out["error"] = str(e)
    return out
