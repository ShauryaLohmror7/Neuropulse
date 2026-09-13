import { lazy, Suspense, useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

const NeuroNoise=lazy(()=>import('@paper-design/shaders-react').then(m=>({default:m.NeuroNoise})))
const GrainGradient=lazy(()=>import('@paper-design/shaders-react').then(m=>({default:m.GrainGradient})))

/** Paper shader families featured on 21st.dev. Decorative only, never activity. */
export function NeuralAmbience({ variant='neural' }: {variant?:'neural'|'silk'}) {
  const reduced=useReducedMotion()
  const [visible,setVisible]=useState(!document.hidden)
  useEffect(()=>{
    const update=()=>setVisible(!document.hidden)
    document.addEventListener('visibilitychange',update)
    return ()=>document.removeEventListener('visibilitychange',update)
  },[])
  const speed=reduced || !visible ? 0 : 0.16
  return <div className={variant==='neural'?'neural-ambience':'silk-ambience'} aria-hidden="true">
    <Suspense fallback={null}>{variant==='neural'
      ? <NeuroNoise width="100%" height="100%" colorFront="#e8c988" colorMid="#7e9985" colorBack="#151a16" brightness={0.08} contrast={0.65} scale={0.85} speed={speed} frame={1200} minPixelRatio={0.5} maxPixelCount={110000}/>
      : <GrainGradient width="100%" height="100%" colorBack="#0b1010" colors={['#a88b5f','#345e54','#182929']} shape="wave" softness={0.8} intensity={0.3} noise={0.13} speed={speed*0.6} scale={1.25} minPixelRatio={0.5} maxPixelCount={90000}/>
    }</Suspense>
  </div>
}
