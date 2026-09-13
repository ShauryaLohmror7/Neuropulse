import { useEffect, useMemo } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore, STEP_DURATION } from '../../lib/store'
import { makeNeuronMaterial } from '../../lib/neuronMaterial'
import { PALETTE } from '../../lib/networkMaterial'
import { neuronPlayback } from '../../lib/playback'
import { modalityIndex } from '../../lib/circuit'

/** Indexed source forest. The only segments are the original parent links. */
export function FullNeuron() {
  const reducedMotion=useReducedMotion()
  const detail=useStore(s=>s.detail)
  const sim=useStore(s=>s.sim)
  const started=useStore(s=>s.simStartedAt)
  const isolate=useStore(s=>s.isolateNeuron)
  const {geometry,pointGeometry,material,signalPoints}=useMemo(()=>{
    const g=new THREE.BufferGeometry()
    if(detail) {
      const count=detail.manifest.stats.nodeCount
      const pos=new Float32Array(count*3), radius=new Float32Array(count), distance=new Float32Array(count)
      for(let i=0;i<count;i++) {
        pos[i*3]=detail.nodes[i*6];pos[i*3+1]=detail.nodes[i*6+1];pos[i*3+2]=detail.nodes[i*6+2]
        radius[i]=detail.nodes[i*6+3];distance[i]=detail.nodes[i*6+4]
      }
      g.setAttribute('position',new THREE.BufferAttribute(pos,3))
      g.setAttribute('aRadius',new THREE.BufferAttribute(radius,1))
      g.setAttribute('aGeodesic',new THREE.BufferAttribute(distance,1))
      g.setIndex(new THREE.BufferAttribute(detail.edges,1))
      g.computeBoundingSphere()
    }
    const m=makeNeuronMaterial({baseColor:'#d3f5ec',activeColor:'#8dceff',baseOpacity:0.8,fogNear:500,fogFar:6500})
    m.depthTest=false
    m.blending=THREE.NormalBlending
    const pointGeometry=new THREE.BufferGeometry()
    if(g.getAttribute('position')) {
      pointGeometry.setAttribute('position',g.getAttribute('position'))
      pointGeometry.setAttribute('aGeodesic',g.getAttribute('aGeodesic'))
    }
    const signalPoints=new THREE.ShaderMaterial({
      uniforms:m.uniforms, transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,
      vertexShader:`
        attribute float aGeodesic;
        uniform float uTime,uIgnition,uActivation,uWaveSpeed,uWaveWidth,uSummary,uCinematic;
        varying float vEnergy;
        void main() {
          float distance=aGeodesic-max(uTime-uIgnition,0.0)*uWaveSpeed;
          float width=max(uWaveWidth*0.45,0.001);
          vEnergy=exp(-distance*distance/(2.0*width*width))*uActivation*uCinematic;
          if(uIgnition<0.0 || uTime<uIgnition || uSummary>0.5) vEnergy=0.0;
          vec4 mv=modelViewMatrix*vec4(position,1.0);
          gl_Position=projectionMatrix*mv;
          gl_PointSize=clamp(6.0*sqrt(max(vEnergy,0.0))*700.0/max(-mv.z,150.0),1.0,12.0);
        }`,
      fragmentShader:`
        uniform vec3 uActiveColor;
        varying float vEnergy;
        void main() {
          float r=length(gl_PointCoord-0.5)*2.0;
          if(r>1.0 || vEnergy<0.015) discard;
          float halo=exp(-r*r*4.0);
          vec3 color=mix(uActiveColor,vec3(0.85,1.0,1.0),exp(-r*r*18.0));
          gl_FragColor=vec4(color*1.8,halo*vEnergy*0.65);
        }`,
    })
    return {geometry:g,pointGeometry,material:m,signalPoints}
  },[detail])
  const signal=useMemo(()=>{
    if(!sim || !detail) return null
    const id=detail.manifest.bodyId
    const a=sim.result.activations.find(n=>n.body_id===id)
    if(!a) return null
    let modality=Object.entries(sim.result.seeds).find(([,ids])=>ids.includes(id))?.[0]
    if(!modality) modality=[...sim.result.pulses].filter(p=>p.target===id).sort((a,b)=>b.amplitude-a.amplitude)[0]?.modality ?? undefined
    return {activation:a,modality}
  },[detail,sim])
  useFrame(({clock})=>{
    const u=material.uniforms
    u.uTime.value=clock.elapsedTime
    const summary=useStore.getState().phase==='settled'
    const step=started===null ? -1 : Math.floor((clock.elapsedTime-started)/STEP_DURATION)
    const sample=signal ? neuronPlayback(signal.activation,step,summary) : null
    u.uSummary.value=summary || reducedMotion ? 1 : 0
    u.uCinematic.value=useStore.getState().cinematic ? 1 : 0
    u.uIgnition.value=sample && sample.ignitionStep>=0 && started!==null ? started+sample.ignitionStep*STEP_DURATION : -1
    u.uActivation.value=sample?.activation ?? 0
    u.uActiveColor.value.copy(PALETTE[modalityIndex(signal?.modality)])
    const extent=Math.max(detail?.manifest.stats.maxGeodesic ?? 1,1)
    u.uWaveSpeed.value=extent/(STEP_DURATION*0.85)
    u.uWaveWidth.value=extent*0.025
    u.uBaseOpacity.value=isolate ? 0.82 : 0.65
  })
  useEffect(()=>()=>{geometry.dispose();pointGeometry.dispose();material.dispose();signalPoints.dispose()},[geometry,pointGeometry,material,signalPoints])
  if(!detail) return null
  return <group name={`full-source-neuron-${detail.manifest.bodyId}`}>
    <lineSegments geometry={geometry} material={material} renderOrder={5} frustumCulled={false}/>
    <points geometry={pointGeometry} material={signalPoints} renderOrder={6} frustumCulled={false}/>
    {/* Original nodes include isolated components with no cable; points keep them visible. */}
    <points geometry={pointGeometry} renderOrder={4} frustumCulled={false}>
      <pointsMaterial color="#d3f5ec" size={0.7} transparent opacity={0.38} depthWrite={false} depthTest={false}/>
    </points>
  </group>
}
