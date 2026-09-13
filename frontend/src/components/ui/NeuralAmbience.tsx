import { lazy, Suspense, useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useStore } from '../../lib/store'

const NeuroNoise=lazy(()=>import('@paper-design/shaders-react').then(m=>({default:m.NeuroNoise})))

/** Decorative Paper shader discovered on 21st.dev. Never represents neuron activity. */
export function NeuralAmbience() {
  const cinematic=useStore(s=>s.cinematic)
  const reduced=useReducedMotion()
  const [visible,setVisible]=useState(!document.hidden)
  useEffect(()=>{
    const update=()=>setVisible(!document.hidden)
    document.addEventListener('visibilitychange',update)
    return ()=>document.removeEventListener('visibilitychange',update)
  },[])
  if(!cinematic) return null
  return <div className="neural-ambience" aria-hidden="true">
    <Suspense fallback={null}><NeuroNoise width="100%" height="100%" colorFront="#b3ffe0" colorMid="#7e65d7" colorBack="#080f1b" brightness={0.025} contrast={0.55} scale={0.72} speed={reduced || !visible ? 0 : 0.22} frame={1200} minPixelRatio={1} maxPixelCount={160000}/></Suspense>
  </div>
}
