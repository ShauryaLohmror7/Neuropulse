"""Virtual lesion: silence neurons in the computational graph and re-run.

This is a *computational perturbation of a connectivity model*.  It shows how
signal flow through the measured wiring diagram changes when nodes are removed.
It is not a prediction of what a real fly would do, and it is not an analogue of
an experimental silencing experiment.
"""

from __future__ import annotations

from typing import Mapping, Sequence

from pydantic import BaseModel

from app.simulation.graph import ConnectomeGraph
from app.simulation.parameters import DEFAULT_PARAMETERS, PropagationParameters
from app.simulation.propagation import propagate
from app.simulation.schemas import PropagationResult


class LesionComparison(BaseModel):
    lesioned_body_ids: list[int]
    normal: PropagationResult
    lesioned: PropagationResult
    delta_neurons_activated: int
    delta_connections_traversed: int
    delta_propagation_depth: int
    lost_neurons: list[int]
    gained_neurons: list[int]
    regions_lost: list[str]
    caveat: str = (
        "Computational perturbation of the connectivity model only. Removing nodes from a "
        "graph is not equivalent to silencing neurons in a living animal."
    )


def lesion_and_compare(
    graph: ConnectomeGraph,
    seeds: Mapping[int, float],
    body_ids: Sequence[int],
    *,
    params: PropagationParameters = DEFAULT_PARAMETERS,
    seed_modalities: Mapping[int, str] | None = None,
) -> LesionComparison:
    normal = propagate(graph, seeds, params=params, seed_modalities=seed_modalities)
    injured = graph.without(body_ids)
    remaining_seeds = {b: v for b, v in seeds.items() if int(b) not in {int(x) for x in body_ids}}
    lesioned = propagate(injured, remaining_seeds, params=params, seed_modalities=seed_modalities)

    normal_ids = {a.body_id for a in normal.activations}
    lesioned_ids = {a.body_id for a in lesioned.activations}
    return LesionComparison(
        lesioned_body_ids=[int(b) for b in body_ids],
        normal=normal,
        lesioned=lesioned,
        delta_neurons_activated=lesioned.metrics.neurons_activated - normal.metrics.neurons_activated,
        delta_connections_traversed=(
            lesioned.metrics.connections_traversed - normal.metrics.connections_traversed
        ),
        delta_propagation_depth=(
            lesioned.metrics.propagation_depth - normal.metrics.propagation_depth
        ),
        lost_neurons=sorted(normal_ids - lesioned_ids),
        gained_neurons=sorted(lesioned_ids - normal_ids),
        regions_lost=sorted(
            set(normal.metrics.regions_reached) - set(lesioned.metrics.regions_reached)
        ),
    )
