import numpy as np
import pandas as pd
import pytest
from app.connectome.detail import encode_forest


def forest():
    # Two disconnected trees and an isolated source node. Deliberately unordered rows.
    return pd.DataFrame(
        [
            [30, 100, 200, 300, 2, 10],
            [10, 99, 200, 300, 3, -1],
            [80, 2, 4, 6, 1, 70],
            [70, 2, 3, 6, 1, -1],
            [90, 9, 9, 9, 0, -1],
        ],
        columns=["rowId", "x", "y", "z", "radius", "link"],
    )


def test_every_source_node_and_edge_retained_without_bridges():
    df = forest()
    origin = [381728, 313344, 558592]
    binary, stats, _ = encode_forest(df, origin, [8, 8, 8])
    nodes = np.frombuffer(binary, dtype="<f4", count=len(df) * 6).reshape(-1, 6)
    edges = np.frombuffer(binary, dtype="<u4", offset=len(df) * 24).reshape(-1, 2)
    assert stats["nodeCount"] == 5 and stats["componentCount"] == 3
    assert stats["nodesDropped"] == stats["edgesInvented"] == 0
    assert edges.tolist() == [[1, 0], [3, 2]]
    restored = nodes[:, :3].astype("float64") * 1000 + origin
    assert np.max(np.abs(restored - df[["x", "y", "z"]].values * 8)) < 0.04
    assert np.isclose(nodes[0, 4], 0.008) and np.isclose(nodes[2, 4], 0.008)
    assert nodes[0, 5] != nodes[2, 5] != nodes[4, 5]
    assert stats["isolatedNodes"] == 1


@pytest.mark.parametrize("fault", ["cycle", "dangling", "duplicate", "nonfinite"])
def test_invalid_source_is_rejected_instead_of_repaired(fault):
    df = forest()
    if fault == "cycle":
        df.loc[1, "link"] = 30
    if fault == "dangling":
        df.loc[0, "link"] = 12345
    if fault == "duplicate":
        df.loc[0, "rowId"] = 10
    if fault == "nonfinite":
        df.loc[0, "x"] = float("nan")
    with pytest.raises(ValueError):
        encode_forest(df, [0, 0, 0], [8, 8, 8])


def test_no_assumed_voxel_scale():
    with pytest.raises(ValueError):
        encode_forest(forest(), [0, 0, 0], [8, 8, 9])


def test_real_bundle_activity_references_only_real_nodes_and_edges():
    from app.api.state import get_circuit
    from app.simulation.propagation import propagate

    circuit = get_circuit()
    seed = circuit.seed_sets["visual_looming:L"][0]
    result = propagate(circuit.graph, {seed: 0.9})
    graph = circuit.graph
    assert result.activations
    assert all(a.body_id in circuit.node_meta for a in result.activations)
    for p in result.pulses:
        mask = (graph.sources == graph.index[p.source]) & (graph.targets == graph.index[p.target])
        assert graph.weights[mask].tolist() == [p.weight]
