import test from 'node:test'
import assert from 'node:assert/strict'
import {explainNeuron,neuronDisplayName} from '../src/lib/neuronExplanation.ts'

test('JO-A2 explains hearing at group level without inventing tuning or courtship',()=>{
 const info=explainNeuron({bodyId:123,type:'JO-A2',class:'mechanosensory'},null)
 assert.match(info.text,/involved in hearing/)
 assert.match(info.basis,/subgroup/)
 assert.match(info.text,/does not establish/)
 assert.ok(info.source)
 const other=explainNeuron({bodyId:124,type:'AMMC-A2',class:'mechanosensory'},null)
 assert.doesNotMatch(other.text,/Johnston/)
})

test('an untyped gustatory neuron has a useful class-level explanation without invented sugar preference',()=>{
 const node={bodyId:104287023,type:null,class:'gustatory',superclass:'cb_sensory',side:'R'}
 const info=explainNeuron(node,null)
 assert.equal(info.title,'A taste-sensing neuron')
 assert.equal(neuronDisplayName(node),'taste-sensing neuron')
 assert.match(info.text,/does not identify whether it prefers sugar/)
 assert.doesNotMatch(info.text,/unresolved specific job/)
})
test('unknown types retain uncertainty rather than acquire an invented function',()=>{
 const info=explainNeuron({bodyId:123,type:null,class:null,superclass:null},null)
 assert.equal(info.coverage,'anatomy')
 assert.match(info.text,/do not identify a specific sensation or movement/)
})

test('downstream explanation cites a recorded incoming signal, never an invented parent',()=>{
 const node={bodyId:200,type:null,class:null,superclass:'cb_intrinsic'}
 const sim={experience:{components:[]},result:{activations:[{body_id:200,step:2}],pulses:[{source:100,target:200,step:2,amplitude:.2,sign:1},{source:999,target:200,step:3,amplitude:1,sign:1}]}}
 const info=explainNeuron(node,sim)
 assert.match(info.role,/neuron 100 at step 2/)
 assert.doesNotMatch(info.role,/999/)
 const absent=explainNeuron(node,{...sim,result:{...sim.result,pulses:[]}})
 assert.doesNotMatch(absent.role,/incoming signal came from/)
})

 test('every full-catalogue neuron has an annotation or research explanation',async()=>{
  const {readFile}=await import('node:fs/promises')
  const catalogue=JSON.parse(await readFile(new URL('../../data/full-cns/catalogue.json',import.meta.url),'utf8'))
  const counts={}
  for(const node of catalogue.nodes){
   const info=explainNeuron(node,null)
   assert.notEqual(info.coverage,'anatomy',`Missing annotation explanation for ${node.bodyId}: ${node.class}/${node.superclass}`)
   assert.ok(info.text.length>60)
   assert.ok(info.source)
   counts[info.coverage]=(counts[info.coverage]??0)+1
  }
  console.log('Full catalogue explanation coverage:',counts)
 })
 test('provisional groups and unassigned cells retain factual boundaries',()=>{
  const provisional=explainNeuron({bodyId:1,superclass:'vnc_sensory_tbc'},null)
  assert.match(provisional.text,/provisional/)
  const unknown=explainNeuron({bodyId:2,type:'unreviewed',pre:7,post:12},null)
  assert.match(unknown.text,/7 presynaptic/)
  assert.match(unknown.text,/12 postsynaptic/)
  assert.equal(unknown.coverage,'anatomy')
  const memory=explainNeuron({bodyId:3,class:'Kenyon_Cell'},null)
  assert.match(memory.text,/does not implement/)
 })
