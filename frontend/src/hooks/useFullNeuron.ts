import { useEffect } from 'react'
import { loadFullNeuron } from '../lib/fullNeuron'
import { useStore } from '../lib/store'
import type { SceneData } from './useSceneData'

export function useFullNeuron(data:SceneData|null) {
  const id=useStore(s=>s.hoveredBodyId)
  const retry=useStore(s=>s.detailRetry)
  useEffect(()=>{
    if(!data || id===null) return
    const controller=new AbortController()
    const timeout=window.setTimeout(()=>controller.abort(),120000)
    let cancelled=false
    useStore.getState().setDetail(null,'loading',null)
    loadFullNeuron(id,data.originNm,controller.signal).then(detail=>{
      if(!cancelled) useStore.getState().setDetail(detail,'ready',null)
    }).catch(e=>{
      if(!cancelled) useStore.getState().setDetail(null,'error',controller.signal.aborted ? 'The source request timed out. Retry to request verified geometry again.' : (e as Error).message)
    }).finally(()=>clearTimeout(timeout))
    return ()=>{cancelled=true;clearTimeout(timeout);controller.abort()}
  },[id,retry,data])
}
