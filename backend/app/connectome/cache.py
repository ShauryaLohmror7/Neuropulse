"""On-disk cache for queried MaleCNS data, with provenance attached.

Every cached artifact is a JSON document of the form::

    {"provenance": {...}, "payload": {...}}

so that a reader can always answer "where did this neuron come from?".
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import orjson

from app.config import get_settings
from app.connectome.provenance import Provenance


def cache_key(*parts: Any) -> str:
    raw = "|".join(str(p) for p in parts)
    return hashlib.sha1(raw.encode()).hexdigest()[:16]


def _path(namespace: str, name: str) -> Path:
    settings = get_settings()
    d = settings.cache_dir / namespace
    d.mkdir(parents=True, exist_ok=True)
    return d / f"{name}.json"


def write(namespace: str, name: str, payload: Any, provenance: Provenance) -> Path:
    p = _path(namespace, name)
    doc = {"provenance": provenance.model_dump(), "payload": payload}
    p.write_bytes(orjson.dumps(doc, option=orjson.OPT_SERIALIZE_NUMPY))
    return p


def read(namespace: str, name: str) -> tuple[Any, dict] | None:
    p = _path(namespace, name)
    if not p.exists():
        return None
    doc = json.loads(p.read_bytes())
    return doc["payload"], doc["provenance"]


def exists(namespace: str, name: str) -> bool:
    return _path(namespace, name).exists()
