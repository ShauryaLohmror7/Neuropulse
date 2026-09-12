#!/usr/bin/env python
"""Milestone 1, steps 6-7: prove we are talking to the real MaleCNS v1.0 dataset.

Run:  backend/.venv/bin/python -m scripts.verify_connection
"""

from __future__ import annotations

import json
import sys

from app.config import get_settings
from app.connectome.client import (
    ConnectomeAuthError,
    ConnectomeDatasetError,
    available_datasets,
    verify_dataset,
)


def main() -> int:
    settings = get_settings()
    print(f"server   : {settings.neuprint_server}")
    print(f"dataset  : {settings.neuprint_dataset}")
    print(f"token    : {'present (' + str(len(settings.neuprint_token)) + ' chars)' if settings.neuprint_token else 'MISSING'}")
    print("-" * 60)
    try:
        datasets = available_datasets()
        print("datasets exposed by server:")
        for name, info in sorted(datasets.items()):
            tag = "  <-- target" if name == settings.neuprint_dataset else ""
            print(f"  - {name}{tag}")
            if name == settings.neuprint_dataset:
                for k in ("uuid", "lastmod", "info"):
                    if k in info:
                        print(f"      {k}: {info[k]}")
        print("-" * 60)
        info = verify_dataset()
        print(json.dumps(info.as_dict(), indent=2)[:2000])
        print("-" * 60)
        print("OK: connected to the real MaleCNS dataset.")
        return 0
    except ConnectomeAuthError as e:
        print(f"AUTH FAILURE: {e}", file=sys.stderr)
        return 2
    except ConnectomeDatasetError as e:
        print(f"DATASET FAILURE: {e}", file=sys.stderr)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
