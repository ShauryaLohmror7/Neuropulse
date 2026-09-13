import json
from copy import deepcopy
from types import SimpleNamespace as NS

import pytest
import requests
from pydantic import SecretStr

from app.simulation import action_hypothesis as ai
from app.simulation.response import ModelledResponse


def envelope(confidence='NONE', text='Rain hits the fly'):
    return NS(experience=NS(raw_text=text, components=[]), result=NS(activations=[NS(body_id=7)]), sequence=None, lesion=None,
              response=ModelledResponse(headline='Sensory response', confidence=confidence, output_evidence=[{'label':'Antennal grooming','body_ids':[7,8],'reached':1,'peak':0.04,'engaged':False}]))


@pytest.fixture
def provider(monkeypatch):
    monkeypatch.setattr(ai, 'get_settings', lambda: NS(gemini_api_key=SecretStr('test-secret'), neuropulse_llm_model='test-model'))
    calls=[]
    def post(*args, **kwargs):
        calls.append(kwargs)
        output={'kind':'suggested_action','action':'Move away from the impacts.','activity_observation':'Neuron 7 was reached in the model.','evidence_body_ids':[7], 'rationale':'This is a scene-based hypothesis.', 'assumptions':['A dry area is nearby.']}
        return NS(raise_for_status=lambda: None, json=lambda: {'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':json.dumps(output)}]}}]})
    monkeypatch.setattr(ai.requests,'post',post)
    return calls


def test_suggestion_is_separate_and_sends_only_actual_activity(provider):
    e=envelope(); before=deepcopy(e.response.model_dump()); activations=deepcopy(e.result.activations)
    ai.attach_hypothesis(e,{7:{'type':'JO-A2','class':'mechanosensory'},8:{'type':'NOT_ACTIVE'}},True)
    payload=json.loads(provider[0]['json']['contents'][0]['parts'][0]['text'])
    assert payload['activated_types_top_30']==[['JO-A2',1]]
    assert 'NOT_ACTIVE' not in json.dumps(payload)
    assert e.result.activations==activations
    after=e.response.model_dump(); after['ai_hypothesis']=None
    assert after==before
    assert e.response.ai_hypothesis['basis']=='activity_informed'
    assert e.response.ai_hypothesis['evidence_body_ids']==[7]


@pytest.mark.parametrize('enabled,confidence,text', [(False,'NONE','rain'),(True,'MODERATE','rain'),(True,'NONE','')])
def test_no_external_call_when_disabled_resolved_or_settling(provider,enabled,confidence,text):
    e=envelope(confidence,text); ai.attach_hypothesis(e,{},enabled)
    assert not provider
    assert e.response.ai_hypothesis is None


def test_provider_failure_preserves_result_and_hides_secret(monkeypatch,provider):
    def fail(*a,**kw): raise requests.Timeout('test-secret')
    monkeypatch.setattr(ai.requests,'post',fail)
    e=envelope(); ai.attach_hypothesis(e,{},True)
    assert e.response.headline=='Sensory response'
    assert e.response.ai_hypothesis is None
    assert 'test-secret' not in e.response.ai_notice


def test_malformed_suggestion_is_rejected(monkeypatch,provider):
    monkeypatch.setattr(ai.requests,'post',lambda *a,**k: NS(raise_for_status=lambda:None,json=lambda:{'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':'{"action":"Escape"}'}]}}]}))
    e=envelope();ai.attach_hypothesis(e,{},True)
    assert e.response.ai_hypothesis is None and e.response.ai_notice


def test_clarification_is_an_explicit_kind():
    result=ai.ActionHypothesis(kind='clarification',action='What is physically happening?',activity_observation='No interpretable scene.',evidence_body_ids=[],rationale='No present sensory event is specified.',assumptions=[])
    assert result.kind=='clarification'


def test_same_scene_without_signals_rejects_claimed_neural_support(provider):
    e=envelope(); e.result.activations=[]
    ai.attach_hypothesis(e,{},True)
    assert len(provider)==1
    assert e.response.ai_hypothesis is None
    assert e.response.ai_notice


@pytest.mark.parametrize('ids',[[8],[]])
def test_unreached_or_missing_activity_citation_is_rejected(monkeypatch,provider,ids):
    output={'kind':'suggested_action','action':'Move away.','activity_observation':'A model response.', 'evidence_body_ids':ids,'rationale':'A guess.','assumptions':[]}
    monkeypatch.setattr(ai.requests,'post',lambda *a,**k:NS(raise_for_status=lambda:None,json=lambda:{'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':json.dumps(output)}]}}]}))
    e=envelope(); ai.attach_hypothesis(e,{},True)
    assert e.response.ai_hypothesis is None
    assert e.response.ai_notice


def test_zero_activity_cannot_be_labeled_activity_informed(monkeypatch,provider):
    output={'kind':'suggested_action','action':'Seek cover.','activity_observation':'No simulated activity.', 'evidence_body_ids':[],'rationale':'Scene-only guess.','assumptions':[]}
    monkeypatch.setattr(ai.requests,'post',lambda *a,**k:NS(raise_for_status=lambda:None,json=lambda:{'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':json.dumps(output)}]}}]}))
    e=envelope(); e.result.activations=[]; ai.attach_hypothesis(e,{},True)
    assert e.response.ai_hypothesis['basis']=='scene_only'
    assert 'No simulated activity supports' in e.response.ai_hypothesis['evidence_level']
