import { NeuronExplanation } from './NeuronExplanation'
import type { SceneData } from '../hooks/useSceneData'
import { useStore } from '../lib/store'

export function NeuronDetailPanel({data}:{data:SceneData|null}) {
  const {hoveredBodyId,detail,detailStatus,detailError,isolateNeuron,setHovered,setView,toggleIsolate,retryDetail,toggleInspector,sim}=useStore()
  const node=data?.circuitDoc.nodes.find(n=>n.bodyId===hoveredBodyId)
  if(hoveredBodyId===null && sim) return null
  if(hoveredBodyId===null) return <div className="detail-invitation"><span className="eyebrow">GO BEYOND THE OVERVIEW</span><button disabled={!data?.circuitDoc.nodes.some(n=>n.bodyId===19034)} onClick={()=>{setHovered(19034);setView('brain')}}>Explore one real neuron <span>↗</span></button><p>Unpruned morphology · every source branch</p></div>
  const stats=detail?.manifest.stats
  const activation=sim?.result.activations.find(a=>a.body_id===hoveredBodyId)
  return <section className="detail-card" aria-label="Full-detail neuron">
    <header><div className="eyebrow">{detailStatus==='ready' ? 'SOURCE GEOMETRY VERIFIED' : 'SOURCE SKELETON'}</div><button aria-label="Close full-detail neuron" onClick={()=>setHovered(null)}>×</button></header>
    <h3>{node?.type ?? hoveredBodyId}<span>{node?.side ? `${node.side} hemisphere` : ''}</span></h3>
    <div className="detail-identity">BODY ID {hoveredBodyId} <span>MaleCNS v1.0</span></div>
    {node && <NeuronExplanation node={node} sim={sim}/>}
    <div className="detail-status" role="status">{detailStatus==='loading' ? <><i className="pulse-dot"/>Retrieving original skeleton…</> : detailStatus==='error' ? detailError : <><i className="live-dot"/>All source nodes. All source connections.</>}</div>
    {stats && <><div className="detail-numbers"><div><b>{stats.nodeCount.toLocaleString()}</b><span>source nodes</span></div><div><b>{stats.edgeCount.toLocaleString()}</b><span>cable segments</span></div><div><b>{stats.componentCount}</b><span>components</span></div></div><p className="detail-note">No pruning. No invented bridges. {stats.componentCount>1 ? 'Disconnected fragments remain separate.' : 'One connected source skeleton.'}</p><div className="detail-mode"><button aria-pressed={!isolateNeuron} onClick={()=>{if(isolateNeuron)toggleIsolate()}}>In the brain</button><button aria-pressed={isolateNeuron} onClick={()=>{if(!isolateNeuron)toggleIsolate()}}>Solo neuron</button></div><p className="detail-note">{activation ? `Reached at model step ${activation.step}. Activity is simulated.` : 'Selected anatomy only. This highlight does not claim activation.'}</p><details><summary>Geometry verification</summary><p className="detail-note">All {stats.sourceNodesRetained.toLocaleString()} source nodes retained. {stats.edgesInvented} invented edges. Coordinate encoding error ≤ {stats.maxCoordinateErrorNm.toFixed(4)} nm. SHA-256 verified in your browser.</p><code>{detail!.manifest.sha256}</code><p className="detail-note">Full source skeleton, not proof that the biological neuron was reconstructed without omissions.</p></details></>}
    {detailStatus==='error' && <button className="text-button" onClick={retryDetail}>Retry source request ↻</button>}
    <button className="detail-evidence" onClick={toggleInspector}>Inspect data & evidence ↗</button>
  </section>
}
