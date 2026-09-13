import type { Provenance } from '../types/connectome'
import type { CircuitNode } from '../types/circuit'

export interface FullNeuronManifest {
  formatVersion: number; bodyId: number; dataset: string; stride: number; nodeBytes: number
  byteLength: number; sha256: string; binaryUrl: string
  annotation: CircuitNode; provenance: Provenance
  transform: {origin_nm:number[]; scale_from_nm:number; units:string}
  stats: {
    nodeCount:number; edgeCount:number; componentCount:number; isolatedNodes:number
    sourceNodesRetained:number; sourceEdgesRetained:number; nodesDropped:number; edgesInvented:number
    maxCoordinateErrorNm:number; maxGeodesic:number; cableLengthUm:number
    bounds:{min:number[];max:number[]}
  }
}
export interface FullNeuron { manifest:FullNeuronManifest; nodes:Float32Array; edges:Uint32Array }
const cache = new Map<number,FullNeuron>()
const BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000/api'

export async function loadFullNeuron(id:number, origin:number[], signal:AbortSignal):Promise<FullNeuron> {
  const cached=cache.get(id)
  if(cached && cached.manifest.transform.origin_nm.every((n,i)=>n===origin[i])) return cached
  const response=await fetch(`${BASE}/neurons/${id}/detail`,{signal})
  if(!response.ok) throw new Error(response.status===404 ? 'This body ID is not in the real circuit.' : 'Full-detail source unavailable. No substitute geometry is shown.')
  const manifest=await response.json() as FullNeuronManifest
  if(manifest.formatVersion!==1 || manifest.bodyId!==id || manifest.dataset!=='male-cns:v1.0' || manifest.stride!==6 || manifest.transform.scale_from_nm!==0.001 || !manifest.transform.origin_nm.every((n,i)=>n===origin[i])) throw new Error('Dataset, identity or coordinate-frame verification failed.')
  const s=manifest.stats
  if(s.nodesDropped!==0 || s.edgesInvented!==0 || s.sourceNodesRetained!==s.nodeCount || s.sourceEdgesRetained!==s.edgeCount || manifest.nodeBytes!==s.nodeCount*24 || manifest.byteLength!==s.nodeCount*24+s.edgeCount*8 || manifest.byteLength>256*1024*1024) throw new Error('Full-detail topology manifest is inconsistent.')
  const binary=await fetch(`${BASE}/neurons/${id}/detail.bin`,{signal})
  if(!binary.ok) throw new Error('Unable to download the verified skeleton.')
  const buffer=await binary.arrayBuffer()
  if(buffer.byteLength!==manifest.byteLength) throw new Error('Incomplete skeleton download.')
  const digest=await crypto.subtle.digest('SHA-256',buffer)
  const checksum=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('')
  if(checksum!==manifest.sha256) throw new Error('Skeleton checksum failed. Geometry was not displayed.')
  const nodes=new Float32Array(buffer,0,s.nodeCount*6)
  const edges=new Uint32Array(buffer,manifest.nodeBytes,s.edgeCount*2)
  if(!nodes.every(Number.isFinite) || !edges.every(n=>n<s.nodeCount)) throw new Error('Invalid source coordinates or node links.')
  const data={manifest,nodes,edges}
  cache.set(id,data)
  while(cache.size>3) cache.delete(cache.keys().next().value!)
  return data
}
