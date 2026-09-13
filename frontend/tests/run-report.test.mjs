import test from 'node:test'
import assert from 'node:assert/strict'
import {runMarkdown,runRecord} from '../src/lib/runReport.ts'

const sim={
 interpretation_ticket:'must-not-export', api_key:'must-not-export',
 circuit:{dataset:'MaleCNS v1.0',neurons:166700,edges:25582938},
 experience:{raw_text:'A touch',parser:'gemini:test',components:[]},
 response:{headline:'Circuit response',plain_language:'Action remains unresolved.',detail:'Two cells responded.',neural_summary:[],limitations:['Not measured firing.'],disclaimer:'Not an observed fly action.'},
 result:{metrics:{neurons_activated:2,connections_traversed:1},activations:[{body_id:100},{body_id:200}],model_note:'Illustrative model timing.'},
 lesion:null,
}
test('exports retain actual IDs and scientific boundaries while excluding transport fields',()=>{
 const record=runRecord(sim)
 assert.deepEqual(record.result.activations.map(a=>a.body_id),[100,200])
 assert.equal(record.sequence,null)
 assert.doesNotMatch(JSON.stringify(record),/must-not-export/)
 const readable=runMarkdown(sim)
 assert.match(readable,/166,700/)
 assert.match(readable,/Action remains unresolved/)
 assert.match(readable,/Not an observed fly action/)
 assert.match(readable,/Fresh run/)
})
test('sequence exports disclose retained-state mode',()=>{
 const sequence={...sim,sequence:{note:'Activity persists; weights do not learn.'}}
 assert.match(runMarkdown(sequence),/Continue sequence/)
 assert.match(runMarkdown(sequence),/weights do not learn/)
})

test('AI action is exported separately without replacing the computed result',()=>{
 const ai={...sim,response:{...sim.response,ai_hypothesis:{kind:'suggested_action',action:'Seek cover.',rationale:'A scene-based possibility.',evidence_level:'AI hypothesis; movement not established by the simulation.',provider:'Google Gemini',model:'test',assumptions:['Cover is nearby.']}}}
 const text=runMarkdown(ai)
 assert.match(text,/Action remains unresolved/)
 assert.match(text,/AI suggestion · separate from the model result/)
 assert.match(text,/Seek cover/)
 assert.match(text,/movement not established/)
 assert.equal(runRecord(ai).response.headline,sim.response.headline)
})
