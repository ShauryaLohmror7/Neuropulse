/** Explicit game controller: tabular Q-learning. No biological learning claim.
 * Each maze has independent values; reward is observed only at the sugar tile.
 */
export type Cell = {x:number;y:number}
export type Maze = {id:number;name:string;size:number;walls:boolean[];start:Cell;goal:Cell;optimal:number}
export const DIRECTIONS = [{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}]
export function seeded(seed:number) { let s=seed>>>0; return () => {s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296} }
export function index(m:Maze,c:Cell) {return c.y*m.size+c.x}
export function open(m:Maze,c:Cell) {return c.x>=0&&c.y>=0&&c.x<m.size&&c.y<m.size&&!m.walls[index(m,c)]}
export function shortest(m:Maze) {
  const queue=[{...m.start,d:0}],seen=new Set([index(m,m.start)])
  for(let i=0;i<queue.length;i++){const c=queue[i];if(index(m,c)===index(m,m.goal))return c.d
    for(const d of DIRECTIONS){const n={x:c.x+d.x,y:c.y+d.y};if(open(m,n)&&!seen.has(index(m,n))){seen.add(index(m,n));queue.push({...n,d:c.d+1})}}
  }return -1
}
function makeMaze(id:number,salt=0):Maze {
  const size=9+id*2,random=seeded(183+id*719+salt),walls=Array<boolean>(size*size).fill(true)
  const stack=[{x:1,y:1}];walls[size+1]=false
  while(stack.length){const c=stack[stack.length-1],choices=DIRECTIONS.map(d=>({x:c.x+2*d.x,y:c.y+2*d.y})).filter(n=>n.x>0&&n.y>0&&n.x<size-1&&n.y<size-1&&walls[n.y*size+n.x])
    if(!choices.length){stack.pop();continue}
    const n=choices[Math.floor(random()*choices.length)];walls[((n.y+c.y)/2)*size+(n.x+c.x)/2]=false;walls[n.y*size+n.x]=false;stack.push(n)
  }
  const m:Maze={id,name:['The nursery','Fern corridor','Amber chambers','Twilight garden','The labyrinth'][id],size,walls,start:{x:1,y:1},goal:{x:size-2,y:size-2},optimal:0}
  m.optimal=shortest(m);return m
}
export const MAZES:Maze[]=[]
for(let id=0;id<5;id++){let salt=0,m=makeMaze(id);while(id>0&&m.optimal<=MAZES[id-1].optimal){m=makeMaze(id,++salt)}MAZES.push(m)}
export type Trial={steps:number;success:boolean;training:boolean;deadEnds?:number;backtracks?:number;obstacles?:number;attempt?:number}
export type Memory={q:number[];trials:Trial[];episodes:number;attempts?:number;countsEstimated?:boolean;baseline?:Evaluation;latestTest?:Evaluation;best?:number}
export function fresh(m:Maze):Memory{return {q:Array(m.size*m.size*4).fill(0),trials:[],episodes:0,attempts:0}}
export function chooseDecision(m:Maze,memory:Memory,c:Cell,epsilon:number,random:()=>number) {
  // The controller senses adjacent walls; it does not know the goal route.
  const choices=DIRECTIONS.map((_,i)=>i).filter(i=>open(m,{x:c.x+DIRECTIONS[i].x,y:c.y+DIRECTIONS[i].y}))
  if(random()<epsilon)return {action:choices[Math.floor(random()*choices.length)],reason:choices.length===1?'only-exit':'exploration'}
  const values=choices.map(a=>memory.q[index(m,c)*4+a]);const max=Math.max(...values)
  const best=choices.filter((_,i)=>values[i]===max);return {action:best[Math.floor(random()*best.length)],reason:choices.length===1?'only-exit':best.length>1?'tie':'learned'}
}
export function choose(m:Maze,memory:Memory,c:Cell,epsilon:number,random:()=>number) {
 return chooseDecision(m,memory,c,epsilon,random).action
}
export function advance(m:Maze,memory:Memory,c:Cell,action:number,learn:boolean,blocked?:Cell) {
  const d=DIRECTIONS[action],proposed={x:c.x+d.x,y:c.y+d.y}
  const hit=!open(m,proposed)||!!blocked&&index(m,proposed)===index(m,blocked)
  const next=hit?{...c}:proposed,success=index(m,next)===index(m,m.goal)
  const reward=success?25:hit?-.5:-.04
  if(learn){const slot=index(m,c)*4+action
    const future=success?0:Math.max(...DIRECTIONS.map((_,a)=>open(m,{x:next.x+DIRECTIONS[a].x,y:next.y+DIRECTIONS[a].y})?memory.q[index(m,next)*4+a]:-Infinity))
    memory.q[slot]+=.25*(reward+.97*future-memory.q[slot])
  }
  return {next,success,hit,reward}
}
export function trainEpisode(m:Maze,memory:Memory,random:()=>number):Trial {
 let c={...m.start},previous:Cell|undefined;let deadEnds=0,backtracks=0;const limit=m.size*m.size*12
 for(let step=1;step<=limit;step++){const result=advance(m,memory,c,choose(m,memory,c,.18,random),true);const counts=movementStats(m,c,result.next,previous);deadEnds+=counts.deadEnds;backtracks+=counts.backtracks;previous=c;c=result.next
  if(result.success){const t={steps:step,success:true,training:true,deadEnds,backtracks,obstacles:0};record(memory,t);return t}}
 const t={steps:limit,success:false,training:true,deadEnds,backtracks,obstacles:0};record(memory,t);return t
}
export function record(memory:Memory,trial:Trial){if(memory.attempts===undefined){memory.attempts=memory.episodes+memory.trials.filter(t=>!t.training).length;memory.countsEstimated=true}trial.attempt=++memory.attempts;if(trial.success)memory.best=Math.min(memory.best??Infinity,trial.steps);memory.trials.push(trial);memory.trials=memory.trials.slice(-200);if(trial.training)memory.episodes++}
export function loadMemory(m:Maze):Memory {
 try{const data=JSON.parse(localStorage.getItem(`neuropulse-maze-v2-${m.id}`)??'null')
  if(data&&data.q?.length===m.size*m.size*4&&data.q.every((v:unknown)=>typeof v==='number'&&Number.isFinite(v))&&Array.isArray(data.trials)&&data.trials.length<=200&&data.trials.every((t:Trial)=>t&&Number.isInteger(t.steps)&&t.steps>0&&typeof t.success==='boolean'&&typeof t.training==='boolean')&&Number.isInteger(data.episodes)&&data.episodes>=0){if(data.attempts===undefined){data.attempts=data.episodes+data.trials.filter((t:Trial)=>!t.training).length;data.countsEstimated=true}return data}
 }catch{/* Storage disabled/corrupt: start a new local controller. */}return fresh(m)
}
export function saveMemory(m:Maze,memory:Memory){try{localStorage.setItem(`neuropulse-maze-v2-${m.id}`,JSON.stringify(memory));return true}catch{return false}}

/** A comparable evaluation uses the same tie-breaking seed, no exploration and no updates. */
export type Evaluation = Trial & {path:Cell[];deadEnds:number;backtracks:number;obstacles:number}
export function movementStats(m:Maze,from:Cell,to:Cell,previous?:Cell) {
 const moved=index(m,from)!==index(m,to)
 const exits=DIRECTIONS.filter(d=>open(m,{x:to.x+d.x,y:to.y+d.y})).length
 return {deadEnds:Number(moved&&exits===1&&index(m,to)!==index(m,m.start)&&index(m,to)!==index(m,m.goal)),backtracks:Number(moved&&!!previous&&index(m,to)===index(m,previous))}
}
export function evaluate(m:Maze,memory:Memory):Evaluation {
 const rng=seeded(6101+m.id),path=[{...m.start}];let deadEnds=0,backtracks=0
 for(let steps=1;steps<=m.size*m.size*12;steps++){
  const from=path[path.length-1],r=advance(m,memory,from,choose(m,memory,from,0,rng),false)
  const counts=movementStats(m,from,r.next,path[path.length-2]);deadEnds+=counts.deadEnds;backtracks+=counts.backtracks;path.push(r.next)
  if(r.success)return {steps,success:true,training:false,path,deadEnds,backtracks,obstacles:0}
 }
 return {steps:path.length-1,success:false,training:false,path,deadEnds,backtracks,obstacles:0}
}
