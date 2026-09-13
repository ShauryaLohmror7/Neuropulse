import test from 'node:test'
import assert from 'node:assert/strict'
import {MAZES, fresh, seeded, shortest, trainEpisode, choose, advance, DIRECTIONS, open} from '../src/components/maze/engine.ts'

test('five reachable mazes increase in size and shortest path length',()=>{
 assert.equal(MAZES.length,5)
 MAZES.forEach((m,i)=>{assert.equal(shortest(m),m.optimal);assert.ok(open(m,m.start)&&open(m,m.goal));if(i){assert.ok(m.size>MAZES[i-1].size);assert.ok(m.optimal>MAZES[i-1].optimal)}})
})
test('all five agents learn shortest routes from reward; evaluation never updates Q values',()=>{
 for(const m of MAZES){const memory=fresh(m),rng=seeded(391+m.id)
  const first=trainEpisode(m,memory,rng)
  for(let i=1;i<500;i++)trainEpisode(m,memory,rng)
  const before=[...memory.q];let cell={...m.start},success=false,steps=0
  for(;steps<m.size*m.size*12;){steps++;const result=advance(m,memory,cell,choose(m,memory,cell,0,rng),false);cell=result.next;if(result.success){success=true;break}}
  assert.ok(success,`maze ${m.id} must reach sugar`);assert.equal(steps,m.optimal);assert.ok(first.steps>steps);assert.deepEqual(memory.q,before)
 }
})
test('a physical obstacle prevents movement and learning memory stays separate',()=>{
 const maze=MAZES[0],memory=fresh(maze),other=fresh(maze),cell={...maze.start}
 const action=DIRECTIONS.findIndex(d=>open(maze,{x:cell.x+d.x,y:cell.y+d.y}))
 const obstacle={x:cell.x+DIRECTIONS[action].x,y:cell.y+DIRECTIONS[action].y}
 const result=advance(maze,memory,cell,action,true,obstacle)
 assert.ok(result.hit);assert.deepEqual(result.next,cell);assert.ok(result.reward<0);assert.ok(memory.q.some(v=>v<0));assert.ok(other.q.every(v=>v===0))
 assert.deepEqual(advance(maze,memory,cell,action,false).next,obstacle)
})

test('before/after evaluations retain authentic paths and count dead ends and backtracks',async()=>{
 const {evaluate,movementStats}=await import('../src/components/maze/engine.ts')
 for(const m of MAZES){const memory=fresh(m),before=evaluate(m,memory),same=evaluate(m,memory)
  assert.deepEqual(before,same);assert.ok(memory.q.every(v=>v===0));assert.equal(memory.attempts,0)
  let deadEnds=0,backtracks=0
  for(let i=1;i<before.path.length;i++){const prev=before.path[i-1],next=before.path[i];assert.equal(Math.abs(prev.x-next.x)+Math.abs(prev.y-next.y),1);assert.ok(open(m,next));const stats=movementStats(m,prev,next,before.path[i-2]);deadEnds+=stats.deadEnds;backtracks+=stats.backtracks}
  assert.equal(before.deadEnds,deadEnds);assert.equal(before.backtracks,backtracks)
  memory.baseline=before;const rng=seeded(391+m.id);for(let i=0;i<500;i++)trainEpisode(m,memory,rng)
  const after=evaluate(m,memory);assert.equal(after.steps,m.optimal);assert.equal(after.deadEnds,0);assert.equal(after.backtracks,0);assert.deepEqual(memory.baseline,before);assert.equal(memory.attempts,500);assert.equal(memory.episodes,500);assert.equal(memory.trials.length,200);assert.equal(memory.trials[199].attempt,500)
 }
})
