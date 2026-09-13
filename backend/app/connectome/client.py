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

import requests
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


def _dataset_listing_is_healthy(server: str, token: str) -> bool:
    """Is /api/dbmeta/datasets responding?

    neuprint-python calls this endpoint inside ``Client.__init__`` purely to
    validate the dataset name. It has been observed returning 500 while every
    endpoint we actually need (cypher, skeletons, ROI meshes) stays healthy, so
    we probe it rather than letting a server-side fault block the whole app.
    """
    try:
        r = requests.get(
            f"{server}/api/dbmeta/datasets",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        return r.status_code == 200
    except requests.RequestException:
        return False


def _verify_dataset_by_query(server: str, token: str, dataset: str) -> bool:
    """Confirm the dataset exists by running a trivial query against it.

    This is a stronger check than the name listing: if a cypher query against
    this dataset returns rows, the dataset is unquestionably present and we are
    authenticated for it.
    """
    try:
        r = requests.post(
            f"{server}/api/custom/custom",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"cypher": "MATCH (n:Neuron) RETURN n.bodyId AS b LIMIT 1", "dataset": dataset},
            timeout=30,
        )
        if r.status_code != 200:
            return False
        return bool(r.json().get("data"))
    except (requests.RequestException, ValueError):
        return False


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

    server = settings.neuprint_server
    dataset = settings.neuprint_dataset

    if not _dataset_listing_is_healthy(server, token):
        # Server-side fault on the listing endpoint only. Prove the dataset is
        # really there with a live query, then seed the library's cache so the
        # constructor does not have to call the broken endpoint.
        if not _verify_dataset_by_query(server, token, dataset):
            raise ConnectomeDatasetError(
                f"{server}/api/dbmeta/datasets is failing AND a direct query against "
                f"{dataset!r} returned nothing. The dataset may be unavailable, or the "
                "token may no longer be valid. NEUROPULSE has no mock-data fallback."
            )
        log.warning(
            "neuPrint /api/dbmeta/datasets is returning an error; verified %s by direct "
            "query instead and seeding the dataset cache.",
            dataset,
        )
        Client.DATASETS_CACHE[server] = {dataset: {"verified_by": "direct cypher query"}}

    client = Client(server, dataset=dataset, token=token)
    set_default_client(client)
    log.info("Connected to %s dataset=%s", server, dataset)
    return client


def available_datasets() -> dict[str, Any]:
    """List datasets the server exposes (used for diagnostics)."""
    settings = get_settings()
    token = settings.neuprint_token.strip()
    if not token:
        raise ConnectomeAuthError("NEUPRINT_TOKEN is not set.")
    # get_client() already handles the case where the listing endpoint is down,
    # seeding the cache from a verified direct query.
    return get_client().fetch_datasets()


def verify_dataset() -> DatasetInfo:
    """Confirm the configured dataset exists and return its live metadata.

    Raises :class:`ConnectomeDatasetError` when the configured dataset is not
    present, listing what the server actually offers.
    """
    settings = get_settings()
    wanted = settings.neuprint_dataset
    client = get_client()  # raises if the dataset cannot be reached at all
    datasets = client.fetch_datasets()
    if wanted not in datasets:
        raise ConnectomeDatasetError(
            f"Dataset {wanted!r} is not available on {settings.neuprint_server}. "
            f"Server offers: {sorted(datasets)}"
        )

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
