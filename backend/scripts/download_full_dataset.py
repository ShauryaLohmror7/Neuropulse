import base64
import hashlib
import json
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

folder = Path(__file__).resolve().parents[2] / "data/full-cns/source"
folder.mkdir(parents=True, exist_ok=True)
base = "https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/"
urls = [
    base + n
    for n in (
        "body-annotations-male-cns-v1.0-minconf-0.5.feather",
        "body-neurotransmitters-male-cns-v1.0.feather",
        "body-stats-male-cns-v1.0-minconf-0.5.feather",
        "connectome-weights-male-cns-v1.0-minconf-0.5.feather",
    )
]


def download(url):
    p = folder / url.rsplit("/", 1)[1]
    if p.exists() and p.with_suffix(".source.json").exists():
        info = json.loads(p.with_suffix(".source.json").read_text())
        with p.open("rb") as f:
            valid = hashlib.file_digest(f, "sha256").hexdigest() == info["sha256"]
        if valid:
            return {"file": p.name, "cached": True}
    r = requests.get(url, stream=True, timeout=(15, 90))
    r.raise_for_status()
    tmp = p.with_suffix(".part")
    h = hashlib.sha256()
    md5 = hashlib.md5()
    size = 0
    last = time.monotonic()
    with tmp.open("wb") as f:
        for b in r.iter_content(4 * 1024 * 1024):
            f.write(b)
            h.update(b)
            md5.update(b)
            size += len(b)
            if time.monotonic() - last > 15:
                print(p.name, size // 1048576, "MiB", flush=True)
                last = time.monotonic()
    assert size == int(r.headers.get("Content-Length", size))
    hashes = r.headers.get("x-goog-hash", "")
    expected = next(
        (x.strip()[4:] for x in hashes.split(",") if x.strip().startswith("md5=")), None
    )
    if expected:
        assert base64.b64encode(md5.digest()).decode() == expected
    tmp.replace(p)
    info = {
        "url": url,
        "bytes": size,
        "sha256": h.hexdigest(),
        "serverMd5": expected,
        "md5Verified": bool(expected),
    }
    p.with_suffix(".source.json").write_text(json.dumps(info, indent=2))
    print("DONE", p.name, size, flush=True)
    return info


if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(download, urls):
            print(result, flush=True)
