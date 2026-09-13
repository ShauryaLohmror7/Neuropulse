import test from 'node:test'
import assert from 'node:assert/strict'
import {explainNeuron,neuronDisplayName} from '../src/lib/neuronExplanation.ts'

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
 assert.match(info.text,/type-specific function is not established/)
})
