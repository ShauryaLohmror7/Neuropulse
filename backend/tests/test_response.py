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


def test_new_readouts_require_actual_marker_activity():
    meta={1:{'type':'DNg11'},2:{'type':'DNg13'},3:{'type':'DNg97'},4:{'type':'DNg100'}}
    for body_id,key in [(1,'front_leg_rubbing'),(2,'stride_steering'),(3,'forward_walking')]:
        result=infer_response([SimpleNamespace(body_id=body_id,activation=.4,step=2)],meta)
        assert result.confidence!='NONE'
        assert next(c for c in result.channels if c.key==key).body_ids==[body_id]
    quiet=infer_response([],meta)
    assert quiet.confidence=='NONE'
    assert all(c.neurons_activated==0 for c in quiet.channels)


def test_proboscis_motors_are_not_all_extension_markers():
    meta={1:{'type':'MN9'},2:{'type':'MN11D'}}
    result=infer_response([SimpleNamespace(body_id=2,activation=.8,step=1)],meta)
    feeding=next(c for c in result.channels if c.key=='feeding_proboscis')
    assert feeding.neurons_in_circuit==1
    assert feeding.neurons_activated==0
    assert result.confidence=='NONE'
