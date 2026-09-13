"""Guard against unsupported behavioral claims in the public UI."""
from types import SimpleNamespace
from app.simulation.response import infer_response


def test_reached_but_subthreshold_output_is_explained():
    result = infer_response([SimpleNamespace(body_id=1, activation=0.05, step=1)],
                            {1: {"type": "DNp01", "side": "L"}})
    assert result.confidence == "NONE"
    assert result.channels[0].neurons_activated == 1
    assert "threshold" in result.detail
    assert "did not reach" not in result.detail


def test_lateral_marker_activity_does_not_invent_turn_direction():
    result = infer_response([SimpleNamespace(body_id=1, activation=0.5, step=1)],
                            {1: {"type": "DNp01", "side": "L"}})
    assert result.direction is None
    assert all(c.direction is None for c in result.channels)
    assert "biased" not in result.headline
    assert "modeled" in result.headline
    assert result.channels[0].left_activation == 0.5
