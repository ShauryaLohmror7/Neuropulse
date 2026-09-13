import {useEffect,useRef} from 'react'
import {type Cell,type Maze} from './engine'
export interface ArenaState {deadEnd?:Cell;deadEndAt?:number;cell:Cell;previous:Cell;movedAt:number;heading:number;trail:Cell[];rock:Cell|null;rockAt:number;sugar:boolean;running:boolean;interval:number}
/** Procedural pixel artwork. Every sprite is decorative, not measured anatomy. */
export function PixelMaze({maze,state,onThrow}:{maze:Maze;state:React.RefObject<ArenaState>;onThrow:(cell:Cell)=>void}) {
 const canvas=useRef<HTMLCanvasElement>(null)
 useEffect(()=>{
  const el=canvas.current;if(!el)return;const ctx=el.getContext('2d');if(!ctx)return
  const unit=20,pad=18,w=maze.size*unit+pad*2;el.width=w;el.height=w
  let frame=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches
  const draw=(time:number)=>{
   const s=state.current;ctx.imageSmoothingEnabled=false;ctx.fillStyle='#0b171e';ctx.fillRect(0,0,w,w)
   for(let y=0;y<maze.size;y++)for(let x=0;x<maze.size;x++){
    const px=pad+x*unit,py=pad+y*unit,wall=maze.walls[y*maze.size+x]
    if(wall){ctx.fillStyle='#172f38';ctx.fillRect(px,py,unit,unit);ctx.fillStyle='#2b5155';ctx.fillRect(px,py,unit,3);ctx.fillStyle='#08161f';ctx.fillRect(px,py+unit-4,unit,4);ctx.fillRect(px+unit-3,py,3,unit)
     if((x*13+y*7)%5===0){ctx.fillStyle='#508c6a';ctx.fillRect(px+3,py+4,6,2);ctx.fillStyle='#79bd88';ctx.fillRect(px+4,py+3,2,2)}
    }else{ctx.fillStyle=(x+y)%2?'#10232d':'#112630';ctx.fillRect(px,py,unit,unit);ctx.fillStyle='#1c343c';ctx.fillRect(px+5,py+13,2,1)}
   }
   for(const [i,c] of s.trail.entries()){ctx.globalAlpha=.15+.5*i/Math.max(1,s.trail.length);ctx.fillStyle='#79dcdb';ctx.fillRect(pad+c.x*unit+8,pad+c.y*unit+8,4,4)}ctx.globalAlpha=1
   ctx.strokeStyle='#63e4bd';ctx.lineWidth=1;ctx.strokeRect(pad+maze.start.x*unit+3,pad+maze.start.y*unit+3,14,14)
   if(s.deadEnd&&time-(s.deadEndAt??0)<1600){const dx=pad+(s.deadEnd.x+.5)*unit,dy=pad+(s.deadEnd.y+.5)*unit;ctx.strokeStyle='#ec9d9b';ctx.lineWidth=2;ctx.strokeRect(dx-8,dy-8,16,16);ctx.fillStyle='#ffc3b7';ctx.font='7px monospace';ctx.textAlign='center';ctx.fillText('DEAD END',dx,dy-12)}
   const gx=pad+(maze.goal.x+.5)*unit,gy=pad+(maze.goal.y+.5)*unit
   ctx.fillStyle='#4b4035';ctx.fillRect(gx-8,gy+4,16,5);ctx.fillStyle='#f6d491';ctx.fillRect(gx-6,gy-6,12,12);ctx.fillStyle='#fff3cd';ctx.fillRect(gx-6,gy-6,12,3);ctx.fillStyle='#c19254';ctx.fillRect(gx+3,gy-3,3,9)
   for(let i=0;i<5;i++){const t=reduced?i:time*.0005+i;ctx.fillStyle='#e5bf7a';ctx.globalAlpha=.25;ctx.fillRect(gx+Math.round(Math.sin(t*2)*14),gy-8-Math.round((t%2)*12),2,2)}ctx.globalAlpha=1
   if(s.rock&&time-s.rockAt<6500){const age=Math.min(1,(time-s.rockAt)/500),rx=pad+(s.rock.x+.5)*unit,ry=pad+(s.rock.y+.5)*unit
    const ax=rx+(1-age)*90,ay=ry-(1-age)*120;ctx.fillStyle='#667286';ctx.fillRect(ax-6,ay-5,12,10);ctx.fillStyle='#b7bac9';ctx.fillRect(ax-4,ay-5,7,3);ctx.fillStyle='#384454';ctx.fillRect(ax-4,ay+3,9,3)
    if(age<1){ctx.fillStyle='#ceadc7';ctx.fillRect(ax+8,ay-12,3,7)}
   }
   const t=reduced?1:Math.min(1,(time-s.movedAt)/Math.max(80,s.interval*.82)),ease=t*t*(3-2*t)
   const fx=pad+(s.previous.x+(s.cell.x-s.previous.x)*ease+.5)*unit,fy=pad+(s.previous.y+(s.cell.y-s.previous.y)*ease+.5)*unit
   ctx.save();ctx.translate(Math.round(fx),Math.round(fy));ctx.rotate(s.heading*Math.PI/2)
   ctx.fillStyle='#050d14';ctx.fillRect(-7,1,14,8)
   const wiggle=!reduced&&s.running?Math.floor(time/70)%2:0
   ctx.strokeStyle='#b5c2bc';ctx.lineWidth=1
   for(const side of [-1,1])for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(side*3,i*3-3);ctx.lineTo(side*(7+wiggle),i*4-6);ctx.lineTo(side*9,i*5-6+wiggle);ctx.stroke()}
   ctx.globalAlpha=.8;ctx.fillStyle='#c8eeed';ctx.fillRect(-8,-2,6,9+wiggle);ctx.fillRect(3,-2,6,9+wiggle);ctx.fillStyle='#739da7';ctx.fillRect(-7,0,2,7);ctx.fillRect(5,0,2,7);ctx.globalAlpha=1
   ctx.fillStyle='#7b725f';ctx.fillRect(-3,-3,6,11);ctx.fillStyle='#d1b984';ctx.fillRect(-2,-2,4,3);ctx.fillStyle='#333f42';ctx.fillRect(-3,3,6,2);ctx.fillRect(-2,7,4,2)
   ctx.fillStyle='#f17c78';ctx.fillRect(-4,-7,3,4);ctx.fillRect(1,-7,3,4);ctx.fillStyle='#fae3bd';ctx.fillRect(-1,-6,2,4);ctx.restore()
   if(s.sugar){ctx.fillStyle='#c3f5ce';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText('SUGAR FOUND',w/2,11)}
   frame=requestAnimationFrame(draw)
  };frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame)
 },[maze,state])
 return <canvas ref={canvas} className="pixel-arena" aria-label={`${maze.name}: pixel-art fly maze. Use Throw pebble to add an obstacle, or click an empty corridor.`} onClick={e=>{const r=e.currentTarget.getBoundingClientRect();const size=maze.size*20+36;onThrow({x:Math.floor(((e.clientX-r.left)/r.width*size-18)/20),y:Math.floor(((e.clientY-r.top)/r.height*size-18)/20)})}}/>
}
