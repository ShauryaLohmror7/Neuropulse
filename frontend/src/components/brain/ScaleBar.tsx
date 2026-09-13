import { useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/** Physical scene scale at the orbit pivot, not a decorative ruler. */
export function ScaleBar() {
  const controls=useThree(s=>s.controls)
  const last=useRef(0)
  const [ruler,setRuler]=useState({width:70,um:100})
  useFrame(({camera,size,clock})=>{
    if(clock.elapsedTime-last.current<0.2) return
    last.current=clock.elapsedTime
    const pivot=(controls as unknown as {target?:THREE.Vector3})?.target
    if(!pivot || !(camera instanceof THREE.PerspectiveCamera)) return
    const depth=pivot.clone().sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3()))
    const umPerPixel=2*depth*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/size.height
    if(umPerPixel<=0) return
    const choices=[1,2,5,10,20,50,100,200,500,1000]
    const um=choices.reduce((best,n)=>Math.abs(n/umPerPixel-75)<Math.abs(best/umPerPixel-75)?n:best)
    const width=Math.round(um/umPerPixel)
    setRuler(prev=>prev.width===width && prev.um===um ? prev : {width,um})
  })
  return <Html fullscreen calculatePosition={(_, __, size)=>[size.width/2,size.height/2]} zIndexRange={[2,0]} style={{pointerEvents:'none'}}><div className="physical-scale"><div style={{width:ruler.width}}/><span>{ruler.um} μm <small>at focal plane</small></span></div></Html>
}
