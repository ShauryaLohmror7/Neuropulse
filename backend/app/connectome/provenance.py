"""Provenance records for every piece of biological data we cache.

NEUROPULSE renders and reasons over real neurons.  Anything we draw on screen
must be traceable back to a specific dataset, query and fetch time so that a
scientist can audit the claim.  This module defines that record and helpers to
attach it to cached artifacts.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field

DATASET_CITATION = (
    "Janelia FlyEM / MaleCNS project. Adult male Drosophila melanogaster "
    "central nervous system connectome, MaleCNS v1.0. https://male-cns.janelia.org/ "
    "Served via neuPrint (https://neuprint.janelia.org), dataset 'male-cns:v1.0'."
)

MappingQuality = Literal[
    "SUPPORTED_REAL_MAPPING",
    "APPROXIMATE_MAPPING",
    "UNSUPPORTED",
]


class Provenance(BaseModel):
    """Where a cached artifact came from."""

    dataset: str = Field(description="neuPrint dataset name, e.g. 'male-cns'.")
    dataset_version: str = Field(description="Dataset version tag, e.g. 'v1.0'.")
    server: str = Field(description="neuPrint server URL the data was fetched from.")
    source_query: str = Field(description="Human-readable description or Cypher of the query.")
    fetched_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    neuprint_python_version: str | None = None
    citation: str = DATASET_CITATION
    notes: str | None = None
    extra: dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def build(
        cls,
        *,
        dataset: str,
        server: str,
        source_query: str,
        notes: str | None = None,
        **extra: Any,
    ) -> "Provenance":
        name, _, version = dataset.partition(":")
        try:  # pragma: no cover - trivial
            import neuprint

            npv = neuprint.__version__
        except Exception:  # pragma: no cover
            npv = None
        return cls(
            dataset=name,
            dataset_version=version or "unspecified",
            server=server,
            source_query=source_query,
            neuprint_python_version=npv,
            notes=notes,
            extra=extra,
        )
