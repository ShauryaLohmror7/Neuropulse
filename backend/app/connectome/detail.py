"""Unpruned, unhealed skeleton forests, registered to the circuit origin.

Unlike display LOD, this path retains ALL source nodes/components and every
existing parent link. It rejects corrupt topology instead of silently repairing it.
"""
from __future__ import annotations

import hashlib
import json
import threading
from pathlib import Path

import numpy as np
import pandas as pd
from neuprint import fetch_meta, fetch_skeleton

from app.api.state import get_circuit
from app.config import get_settings
from app.connectome.client import get_client
from app.connectome.provenance import Provenance

_LOCK = threading.Lock()
FORMAT_VERSION = 1


def encode_forest(df: pd.DataFrame, origin_nm: list[float], voxel_nm: list[float]):
    """Encode source nodes and edges without filtering, resampling or bridging.

    Nodes: little-endian float32 x,y,z,radius,root-distance,component (scene µm).
    Edges: little-endian uint32 parent-index,child-index after the node buffer.
    Coordinates are float32 for WebGL; measured round-trip error is disclosed.
    """
    cols = ['rowId', 'x', 'y', 'z', 'radius', 'link']
    source = df[cols].to_numpy(dtype=np.float64)
    if not len(source) or not np.isfinite(source).all():
        raise ValueError('Empty or non-finite source skeleton')
    ids = source[:, 0].astype(np.int64)
    parents = source[:, 5].astype(np.int64)
    if not np.array_equal(ids, source[:, 0]) or not np.array_equal(parents, source[:, 5]):
        raise ValueError('Non-integer source node identities')
    if len(set(ids)) != len(ids):
        raise ValueError('Duplicate source node identities')
    voxel = np.asarray(voxel_nm, dtype=np.float64)
    if voxel.shape != (3,) or not np.all(voxel > 0) or not np.all(voxel == voxel[0]):
        raise ValueError('Verified isotropic nanometre voxel metadata is required')
    if np.any(source[:, 4] < 0):
        raise ValueError('Negative skeleton radius')
    lookup = {int(r): i for i, r in enumerate(ids)}
    children: list[list[int]] = [[] for _ in ids]
    roots = []
    edges = []
    for i, parent in enumerate(parents):
        if parent == -1:
            roots.append(i)
        elif int(parent) not in lookup:
            raise ValueError('Source skeleton contains a dangling parent link')
        else:
            j = lookup[int(parent)]
            children[j].append(i)
            edges.append((j, i))
    xyz_nm = source[:, 1:4] * voxel
    scene_xyz = (xyz_nm - np.asarray(origin_nm, dtype=np.float64)) / 1000
    nodes = np.zeros((len(ids), 6), dtype='<f4')
    nodes[:, :3] = scene_xyz
    nodes[:, 3] = source[:, 4] * voxel[0] / 1000
    visited = np.zeros(len(ids), dtype=bool)
    distances = np.zeros(len(ids), dtype=np.float64)
    component_sizes = []
    for component, root in enumerate(roots):
        stack = [root]
        size = 0
        while stack:
            i = stack.pop()
            if visited[i]:
                raise ValueError('Source skeleton is not a forest')
            visited[i] = True
            nodes[i, 5] = component
            size += 1
            for child in children[i]:
                distances[child] = distances[i] + np.linalg.norm(scene_xyz[child] - scene_xyz[i])
                stack.append(child)
        component_sizes.append(size)
    if not visited.all():
        raise ValueError('Source skeleton contains a cycle or rootless component')
    nodes[:, 4] = distances
    edge_buffer = np.asarray(edges, dtype='<u4').reshape(-1, 2)
    binary = nodes.tobytes() + edge_buffer.tobytes()
    roundtrip_error = float(np.abs(nodes[:, :3].astype(np.float64) * 1000 + origin_nm - xyz_nm).max())
    stats = {
        'nodeCount': len(ids), 'edgeCount': len(edges), 'componentCount': len(roots),
        'componentSizes': sorted(component_sizes, reverse=True),
        'isolatedNodes': sum(size == 1 for size in component_sizes),
        'sourceNodesRetained': len(ids), 'sourceEdgesRetained': len(edges),
        'nodesDropped': 0, 'edgesInvented': 0, 'simplifyEpsilonNm': 0, 'twigPruneNm': 0,
        'maxCoordinateErrorNm': roundtrip_error,
        'maxGeodesic': float(distances.max()),
        'bounds': {'min': nodes[:, :3].min(axis=0).tolist(), 'max': nodes[:, :3].max(axis=0).tolist()},
        'cableLengthUm': float(sum(np.linalg.norm(scene_xyz[b] - scene_xyz[a]) for a,b in edges)),
    }
    return binary, stats, hashlib.sha256(source.astype('<f8').tobytes()).hexdigest()


def get_detail(body_id: int) -> tuple[dict, Path]:
    circuit = get_circuit()
    if body_id not in circuit.node_meta:
        raise KeyError(body_id)
    settings = get_settings()
    dataset = f"{circuit.provenance['dataset']}:{circuit.provenance['dataset_version']}"
    if settings.neuprint_dataset != dataset or settings.neuprint_server != circuit.provenance['server']:
        raise ValueError('Configured data source does not match this circuit')
    origin = circuit.doc['transform']['origin_nm']
    uuid = circuit.provenance.get('extra', {}).get('dataset_uuid')
    # Bind cache to dataset identity AND coordinate frame. Old LOD caches cannot satisfy this request.
    key = hashlib.sha256(json.dumps([FORMAT_VERSION,dataset,uuid,origin,body_id]).encode()).hexdigest()[:24]
    folder = settings.cache_dir / 'full-detail'
    folder.mkdir(parents=True, exist_ok=True)
    manifest_path, binary_path = folder / f'{key}.json', folder / f'{key}.bin'
    with _LOCK:
        if manifest_path.exists() and binary_path.exists():
            manifest = json.loads(manifest_path.read_bytes())
            if hashlib.sha256(binary_path.read_bytes()).hexdigest() == manifest['sha256']:
                return manifest, binary_path
        client = get_client()
        meta = fetch_meta(client=client)
        if not uuid or meta.get('uuid') != uuid:
            raise ValueError('Live dataset UUID does not match circuit provenance')
        units = str(meta.get('voxelUnits', '')).lower()
        if not units.startswith('nano'):
            raise ValueError('Dataset must explicitly report nanometre voxel units')
        voxel = meta.get('voxelSize')
        if voxel is None:
            raise ValueError('Missing voxel size; refusing an assumed conversion')
        df = fetch_skeleton(body_id, heal=False, format='pandas', client=client)
        binary, stats, source_hash = encode_forest(df, origin, voxel)
        provenance = Provenance.build(
            dataset=dataset, server=settings.neuprint_server,
            source_query=f'neuPrint fetch_skeleton(bodyId={body_id}, heal=False, format=pandas); all original nodes and parent links',
            notes='Unpruned, unhealed skeleton forest. All disconnected components preserved separately. Not a neuron surface mesh or proof of complete biological reconstruction.',
            dataset_uuid=uuid, voxel_size_nm=voxel, source_table_sha256=source_hash,
        )
        manifest = {
            'formatVersion': FORMAT_VERSION, 'bodyId': body_id, 'dataset': dataset,
            'provenance': provenance.model_dump(), 'annotation': circuit.node_meta[body_id],
            'stats': stats, 'stride': 6, 'nodeBytes': stats['nodeCount'] * 24,
            'byteLength': len(binary), 'sha256': hashlib.sha256(binary).hexdigest(),
            'transform': {'origin_nm': origin, 'scale_from_nm': 0.001, 'units': 'micrometres'},
            'binaryUrl': f'/neurons/{body_id}/detail.bin',
        }
        # Publish manifest last: readers never observe a half-written artifact.
        tmp = binary_path.with_suffix('.bin.tmp'); tmp.write_bytes(binary); tmp.replace(binary_path)
        tmp = manifest_path.with_suffix('.json.tmp'); tmp.write_text(json.dumps(manifest)); tmp.replace(manifest_path)
        return manifest, binary_path
