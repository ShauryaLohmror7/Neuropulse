"""neuPrint connection management for the MaleCNS v1.0 dataset.

Hard rule for this project: if we cannot reach the real dataset, we raise.  We
never fall back to synthetic neurons, because every visual in NEUROPULSE is
presented to the viewer as real biology.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from neuprint import Client, fetch_meta, set_default_client

from app.config import get_settings

log = logging.getLogger(__name__)


class ConnectomeAuthError(RuntimeError):
    """No usable neuPrint token was supplied."""


class ConnectomeDatasetError(RuntimeError):
    """The requested dataset is not available on the server."""


@dataclass(frozen=True)
class DatasetInfo:
    """Summary of the live dataset, straight from the server's :Meta node."""

    dataset: str
    uuid: str | None
    last_database_edit: str | None
    total_pre_count: int | None
    total_post_count: int | None
    primary_rois: tuple[str, ...]
    all_rois_count: int
    neuroglancer_info: dict[str, Any] | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "dataset": self.dataset,
            "uuid": self.uuid,
            "last_database_edit": self.last_database_edit,
            "total_pre_count": self.total_pre_count,
            "total_post_count": self.total_post_count,
            "primary_roi_count": len(self.primary_rois),
            "primary_rois": list(self.primary_rois),
            "all_rois_count": self.all_rois_count,
        }


@lru_cache(maxsize=1)
def get_client() -> Client:
    """Return a cached, authenticated neuPrint client for the configured dataset."""
    settings = get_settings()
    token = settings.neuprint_token.strip()
    if not token:
        raise ConnectomeAuthError(
            "NEUPRINT_TOKEN is not set. Obtain a token from "
            f"{settings.neuprint_server} (avatar menu -> Account) and place it in "
            "backend/.env as NEUPRINT_TOKEN=... . NEUROPULSE intentionally has no "
            "mock-data fallback."
        )
    client = Client(
        settings.neuprint_server,
        dataset=settings.neuprint_dataset,
        token=token,
    )
    set_default_client(client)
    log.info("Connected to %s dataset=%s", settings.neuprint_server, settings.neuprint_dataset)
    return client


def available_datasets() -> dict[str, Any]:
    """List datasets the server exposes (used for diagnostics)."""
    settings = get_settings()
    token = settings.neuprint_token.strip()
    if not token:
        raise ConnectomeAuthError("NEUPRINT_TOKEN is not set.")
    # neuprint-python validates the dataset name at construction time, so we
    # build the probe against the configured dataset and fall back to a known
    # dataset only to enumerate what the server offers.
    try:
        probe = Client(settings.neuprint_server, dataset=settings.neuprint_dataset, token=token)
    except RuntimeError as e:
        # The message already enumerates the datasets; surface it verbatim.
        raise ConnectomeDatasetError(str(e)) from e
    return probe.fetch_datasets()


def verify_dataset() -> DatasetInfo:
    """Confirm the configured dataset exists and return its live metadata.

    Raises :class:`ConnectomeDatasetError` when the configured dataset is not
    present, listing what the server actually offers.
    """
    settings = get_settings()
    wanted = settings.neuprint_dataset
    datasets = available_datasets()
    if wanted not in datasets:
        raise ConnectomeDatasetError(
            f"Dataset {wanted!r} is not available on {settings.neuprint_server}. "
            f"Server offers: {sorted(datasets)}"
        )

    client = get_client()
    meta = fetch_meta(client=client)
    primary = tuple(meta.get("primaryRois") or ())
    all_rois = meta.get("roiInfo") or meta.get("rois") or {}
    return DatasetInfo(
        dataset=wanted,
        uuid=meta.get("uuid"),
        last_database_edit=meta.get("lastDatabaseEdit"),
        total_pre_count=meta.get("totalPreCount"),
        total_post_count=meta.get("totalPostCount"),
        primary_rois=primary,
        all_rois_count=len(all_rois) if hasattr(all_rois, "__len__") else 0,
    )
