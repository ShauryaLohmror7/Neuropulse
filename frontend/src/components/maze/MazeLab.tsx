import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import type {SceneData} from '../../hooks/useSceneData'
import {BrainScene} from '../brain/BrainScene'
import {ScientificInspector} from '../ScientificInspector'
import {api} from '../../lib/api'
import {getSceneTime} from '../../lib/sceneClock'
import {useStore} from '../../lib/store'
import type {SimulationEnvelope} from '../../types/api'
import {MAZES,DIRECTIONS,advance,chooseDecision,fresh,index,loadMemory,open,record,saveMemory,seeded,trainEpisode,evaluate,movementStats,type Cell,type Maze} from './engine'
import {WhatHappening,type Decision} from './WhatHappening'
import {PixelMaze,type ArenaState} from './PixelMaze'
import './maze.css'

const CUES={motion:{label:'Moving through the maze',text:'The fly sees visual motion.'},touch:{label:'Obstacle contact',text:'An object touches the fly’s body.'},threat:{label:'An approaching object',text:'A dark object rapidly approaches the fly.'},scent:{label:'Fruit scent near the reward',text:'The fly smells ripe fruit.'},sugar:{label:'Taste at the sugar reward',text:'The fly tastes sugar with its labellum.'}}
type Cue=keyof typeof CUES
export function MazeLab({data,dataError,onExit}:{data:SceneData|null;dataError:string|null;onExit:()=>void}) {
 const [selected,setSelected]=useState(0)
 return <div className="maze-page"><header className="maze-mast"><button className="maze-brand" onClick={onExit}>⌁ NEUROPULSE <span>/ FIELD LAB</span></button><nav aria-label="Project sections"><button onClick={onExit}>Connectome explorer</button><button aria-current="page">Maze learning</button></nav><span className="maze-live">● EXPERIMENT 02</span></header>
 <div className="maze-intro"><div><div className="maze-eyebrow">A SMALL WORLD. A LEARNING AGENT.</div><h1>The sugar <em>experiment.</em></h1><p>Watch a pixel fly find its way. Train a route. Change its world.</p></div><div className="maze-scope"><b>166,700</b><span>real neurons in the sensory model</span></div></div>
 <div className="maze-select" role="group" aria-label="Maze difficulty">{MAZES.map((m,i)=><button key={m.id} aria-pressed={selected===i} onClick={()=>{useStore.getState().reset();setSelected(i)}}><span>0{i+1} <i>{'◆'.repeat(i+1)}</i></span><b>{m.name}</b><small>{m.size} × {m.size} · {m.optimal} steps minimum</small></button>)}</div>
 <Experiment key={selected} maze={MAZES[selected]} data={data} dataError={dataError}/>
 <footer className="maze-method"><b>What is learning?</b><p>A game agent learns action values through trial and reward (Q-learning). Memory is separate for each maze. The real connectome shows event-triggered sensory-model playback; it does not choose the route or undergo biological learning. Pixel anatomy and motion are artwork. Sugar-specific neuron identity is not established by this dataset.</p></footer>
 </div>
}
function Experiment({maze,data,dataError}:{maze:Maze;data:SceneData|null;dataError:string|null}) {
 const [memory,setMemory]=useState(()=>{const m=loadMemory(maze);m.baseline??=evaluate(maze,fresh(maze));return m});const random=useMemo(()=>seeded(391+maze.id),[maze.id])
 const [running,setRunning]=useState(false),[testing,setTesting]=useState(false),[training,setTraining]=useState(false),[speed,setSpeed]=useState(1)
 const [version,setVersion]=useState(0),[steps,setSteps]=useState(0),[status,setStatus]=useState('Ready to explore'),[cue,setCue]=useState('No sensory event yet'),[neuralError,setNeuralError]=useState<string|null>(null)
 const [saved,setSaved]=useState(true),[progress,setProgress]=useState(0),[completed,setCompleted]=useState(false)
 const [activeCue,setActiveCue]=useState<Cue|null>(null)
 const [decision,setDecision]=useState<Decision>({title:'Ready to begin',body:'The agent starts without a route. Watch its untrained attempt, then give it practice.',step:0}),[decisionHistory,setDecisionHistory]=useState<Decision[]>([])
 const lastDecision=useRef({title:'',at:0})
 const explain=useCallback((next:Decision)=>{setDecision(next);if(next.title!==lastDecision.current.title&&(performance.now()-lastDecision.current.at>900||/dead end|blocked|Sugar/i.test(next.title))){setDecisionHistory(list=>[next,...list].slice(0,6));lastDecision.current={title:next.title,at:performance.now()}}},[])
 const [replaying,setReplaying]=useState(false),[batch,setBatch]=useState(50),[deadEnds,setDeadEnds]=useState(0),[backtracks,setBacktracks]=useState(0)
 const trace=useRef<Cell[]>([]),runStats=useRef({deadEnds:0,backtracks:0,obstacles:0}),testRandom=useRef(seeded(6101+maze.id)),holdUntil=useRef(0)
 const selectedNeuron=useStore(s=>s.hoveredBodyId)
 const inspector=useStore(s=>s.inspector),sim=useStore(s=>s.sim),phase=useStore(s=>s.phase)
 const state=useRef<ArenaState>({cell:{...maze.start},previous:{...maze.start},movedAt:0,heading:1,trail:[],rock:null,rockAt:0,sugar:false,running:false,interval:280})
 const counter=useRef(0),alive=useRef(true),inflight=useRef(false),lastCue=useRef(0),lastKind=useRef<Cue|null>(null),cache=useRef(new Map<Cue,SimulationEnvelope>())
 useEffect(()=>{alive.current=true;saveMemory(maze,memory);useStore.getState().reset();useStore.getState().setHovered(null);useStore.getState().setView('brain');return()=>{alive.current=false;saveMemory(maze,memory);useStore.getState().reset()}},[maze,memory])
 const queuedCue=useRef<Cue|null>(null),dispatchCue=useRef<(kind:Cue,force?:boolean)=>Promise<void>>(async()=>{})
 const sensory=useCallback(async(kind:Cue,force=false)=>{
  if(!data)return
  if(inflight.current){if(force)queuedCue.current=kind;return}
  if(!force&&performance.now()-lastCue.current<(lastKind.current===kind?20000:8500))return
  inflight.current=true;lastCue.current=performance.now();lastKind.current=kind;setCue(`Computing: ${CUES[kind].label.toLowerCase()}`);setNeuralError(null)
  try{let result=cache.current.get(kind);if(!result){result=await api.simulate(CUES[kind].text);cache.current.set(kind,result)}
   if(!alive.current)return
   useStore.getState().setSim(result,getSceneTime()+.1);useStore.getState().setPhase('propagating');setCue(CUES[kind].label);setActiveCue(kind)
  }catch(e){if(alive.current){setNeuralError((e as Error).message);setCue('Sensory model unavailable')}}finally{inflight.current=false;const next=queuedCue.current;queuedCue.current=null;if(next&&alive.current)void dispatchCue.current(next,true)}
 },[data])
 useEffect(()=>{dispatchCue.current=sensory},[sensory])
 const persist=useCallback(()=>{setSaved(saveMemory(maze,memory));setVersion(v=>v+1)},[maze,memory])
 const start=(test:boolean,replay=false)=>{
  setDecisionHistory([]);explain({title:replay?'Watching the untrained controller':test?'Trying the learned route':'Learning by trying',body:replay?'This is a recorded run with no training. Wrong turns and repeated paths are its actual choices.':test?'The controller uses its learned action scores. This test does not change those scores.':'The controller tries available corridors and updates action scores from the reward it receives.',step:0});setReplaying(replay);testRandom.current=seeded(6101+maze.id);trace.current=[{...maze.start}];runStats.current={deadEnds:0,backtracks:0,obstacles:0};setDeadEnds(0);setBacktracks(0);holdUntil.current=0;
  const s=state.current;s.cell={...maze.start};s.previous={...maze.start};s.trail=[];s.sugar=false;s.rock=null;s.movedAt=performance.now();counter.current=0;setSteps(0);setCompleted(false);setTesting(test);setRunning(true);setStatus(replay?'Replaying the untrained baseline · no learning':test?'Testing learned choices · no updates':'Exploring · learning from reward');lastKind.current=null;void sensory('motion',true)
 }
 useEffect(()=>{
  state.current.running=running;state.current.interval=280/speed
  if(!running)return
  const timer=window.setInterval(()=>{
   if(document.hidden||performance.now()<holdUntil.current)return
   const s=state.current;if(s.rock&&performance.now()-s.rockAt>6500)s.rock=null
   const replayNext=memory.baseline?.path[counter.current+1]
   const picked=replaying?null:chooseDecision(maze,memory,s.cell,testing?0:.2,testing?testRandom.current:random)
   const action=replaying&&replayNext?DIRECTIONS.findIndex(d=>s.cell.x+d.x===replayNext.x&&s.cell.y+d.y===replayNext.y):picked!.action
   const result=advance(maze,memory,s.cell,action,!testing&&!replaying,s.rock&&performance.now()-s.rockAt>=500?s.rock:undefined)
   const counts=movementStats(maze,s.cell,result.next,trace.current[trace.current.length-2]);runStats.current.deadEnds+=counts.deadEnds;runStats.current.backtracks+=counts.backtracks;setDeadEnds(runStats.current.deadEnds);setBacktracks(runStats.current.backtracks);trace.current.push({...result.next});if(result.hit)runStats.current.obstacles++
   if(counts.deadEnds){holdUntil.current=performance.now()+900/Math.sqrt(speed);s.deadEnd={...result.next};s.deadEndAt=performance.now()}
   s.previous={...s.cell};s.cell=result.next;s.heading=action;s.movedAt=performance.now();s.trail.push({...s.cell});s.trail=s.trail.slice(-100)
   counter.current++;setSteps(counter.current)
   const direction=['north (up)','east (right)','south (down)','west (left)'][action]
   const explanation=result.success?{title:'Sugar found',body:testing||replaying?'The run reached its goal. No learning update is applied during a test or replay.':'Reaching the sugar gives a +25 reward. The controller updates the value of the action that reached it.'}:result.hit?{title:'The corridor is blocked',body:'A pebble prevents this move. The agent remains in place; learning runs reduce this action’s score.'}:counts.deadEnds?{title:'A dead end',body:'This corridor has only one exit: the way the fly came in. The fly pauses briefly so you can see the mistake, then continues choosing actions.'}:counts.backtracks?{title:'Going back over the last step',body:'This move returns to the previous tile. The backtrack counter increases; no hidden route correction is applied.'}:replaying?{title:`Untrained move ${direction}`,body:'Replaying the exact choice recorded before training. Equal-valued options were chosen at random.'}:picked?.reason==='only-exit'?{title:`One way forward: ${direction}`,body:'Adjacent walls leave only one available corridor. The controller takes that open direction.'}:picked?.reason==='exploration'?{title:`Trying ${direction}`,body:'This is an exploratory choice. The controller tries an available direction instead of always choosing its highest score.'}:picked?.reason==='tie'?{title:`Choosing ${direction} from equal options`,body:'Several available directions have the same action score. A seeded random tie-break chooses this one.'}:{title:`Taking the learned option: ${direction}`,body:'This available direction has the highest action score learned from earlier moves and rewards. It is not a guarantee that the route is correct.'}
   explain({...explanation,step:counter.current})
   if(result.success){s.sugar=true;setCompleted(true);setRunning(false);setStatus(`Sugar found in ${counter.current} steps${testing?' · test complete':' · reward +25'}`);if(!replaying){const trial={steps:counter.current,success:true,training:!testing,...runStats.current};record(memory,trial);if(testing)memory.latestTest={...trial,path:[...trace.current]};persist();}else setStatus('Untrained baseline replay complete · no new attempt counted');void sensory('sugar',true)}
   else if(counter.current>=maze.size*maze.size*12){setRunning(false);setCompleted(true);setStatus(replaying?'Baseline timed out · replay complete':'Trial limit reached · train more, then try again');if(!replaying){const trial={steps:counter.current,success:false,training:!testing,...runStats.current};record(memory,trial);if(testing)memory.latestTest={...trial,path:[...trace.current]};persist()}}
   else if(result.hit){setStatus('Path blocked · trying another action');void sensory('touch')}
   else{setStatus(counts.deadEnds?'Dead end discovered · turning back':counts.backtracks?'Backtracking · retracing the last step':`${replaying?'Untrained baseline':testing?'Following learned route':'Exploring'} · moving ${['north','east','south','west'][action]}`)
    const near=Math.abs(s.cell.x-maze.goal.x)+Math.abs(s.cell.y-maze.goal.y)<=4
    void sensory(near?'scent':'motion')}
  },280/speed)
  return()=>clearInterval(timer)
 },[running,speed,testing,replaying,maze,memory,random,persist,sensory,explain])
 const train=async()=>{
  setRunning(false);setTraining(true);setProgress(0);setStatus(`Training ${batch} attempts · sugar reward only`);explain({title:'Practicing between visible runs',body:`The controller is completing ${batch} learning attempts. These update its action values; the recorded results remain visible in the chart.`,step:0})
  for(let i=0;i<batch;i++){if(!alive.current)return;trainEpisode(maze,memory,random);setProgress(i+1)
   if(i%4===0)await new Promise(resolve=>setTimeout(resolve,8))}
  if(!alive.current)return;persist();setTraining(false);setStatus('Training complete · test the learned route');explain({title:'Ready for a fair test',body:'Practice is complete. Test the learned route to compare with the saved untrained run on the same maze.',step:0})
 }
 const throwRock=(cell?:Cell)=>{
  if(replaying)return
  const s=state.current
  const options=DIRECTIONS.map(d=>({x:s.cell.x+d.x,y:s.cell.y+d.y})).filter(c=>open(maze,c)&&index(maze,c)!==index(maze,maze.goal)&&index(maze,c)!==index(maze,maze.start))
  const candidate=cell??options[Math.floor(random()*options.length)]
  if(!candidate||!open(maze,candidate)||[index(maze,s.cell),index(maze,maze.goal),index(maze,maze.start)].includes(index(maze,candidate))){setStatus('Choose an empty corridor away from the fly, start and sugar');return}
  explain({title:'A pebble is approaching',body:'The game has launched an obstacle toward a corridor. The brain panel separately models a visual looming cue; movement remains controlled by the route learner.',step:counter.current});s.rock={...candidate};s.rockAt=performance.now();setStatus('Pebble incoming · corridor blocked for 6.5 seconds');void sensory('threat',true)
 }
 const stride=Math.max(1,Math.ceil(memory.trials.length/30))
 const trials=memory.trials.filter((_,i)=>i%stride===0||i===memory.trials.length-1),max=Math.max(maze.optimal,...trials.map(t=>t.steps)),successes=trials.filter(t=>t.success),best=memory.best??(memory.trials.some(t=>t.success)?Math.min(...memory.trials.filter(t=>t.success).map(t=>t.steps)):null)
 const baseline=memory.baseline!,after=memory.latestTest
 const improvement=baseline.success&&after?.success&&after.obstacles===0?Math.round((baseline.steps-after.steps)/baseline.steps*100):null
 return <><section className="maze-proof" aria-label="Before and after learning"><div className="proof-intro"><span className="maze-eyebrow">SEE THE DIFFERENCE</span><h2>From lost to learned.</h2><p>Watch the untrained run, practice, then test the same maze.</p><button disabled={training||running} onClick={()=>start(true,true)}>↺ Watch untrained attempt</button></div><div className="proof-card"><span>BEFORE · UNTRAINED BASELINE</span><b>{baseline.success?baseline.steps.toLocaleString():'Timed out'}<small>{baseline.success?'steps to sugar':`${baseline.steps} steps without sugar`}</small></b><p>{baseline.deadEnds} dead-end visits · {baseline.backtracks} backtracks</p><small>Recorded with a fresh controller. Replay does not train it or count as a new attempt.</small></div><div className="proof-card after"><span>AFTER · LATEST LEARNED TEST</span><b>{after?(after.success?after.steps.toLocaleString():'Timed out'):'Not tested'}<small>{after?.success?'steps to sugar':'Train, then test learned route'}</small></b><p>{after?`${after.deadEnds} dead-end visits · ${after.backtracks} backtracks`:'Your result appears here after a test.'}</p><small>{improvement!==null?(improvement>0?`${improvement}% fewer steps than the untrained baseline`:improvement===0?'Same step count as the baseline':`${-improvement}% more steps; keep practicing`):after?.obstacles?'Obstacle contact changed this run; no percentage comparison.':after?.success&&!baseline.success?'Now reaches sugar; the untrained baseline timed out.':'Same start and goal; no route is scripted.'}</small></div></section><div className="attempt-strip"><b>{replaying?(running?'BASELINE REPLAY':'BASELINE REPLAY COMPLETE'):training?`PRACTICING · ${progress}/${batch}`:running?`ATTEMPT ${(memory.attempts??memory.episodes)+1}`:'READY FOR THE NEXT ATTEMPT'}</b><span>{memory.countsEstimated?'At least ':''}{memory.attempts??memory.episodes} completed attempts</span><span>{memory.episodes} learning attempts</span><span>{deadEnds} dead ends this run</span><span>{backtracks} backtracks this run</span></div><div className="maze-grid"><section className="maze-world" aria-label="Pixel maze experiment"><div className="lab-panel-head"><span><i/> LIVE ARENA</span><small>PIXEL WORLD / {maze.name.toUpperCase()}</small></div><div className="arena-wrap"><PixelMaze maze={maze} state={state} onThrow={c=>{if(!training&&!replaying)throwRock(c)}}/><div className="arena-caption"><span>◎ START</span><span>▧ SUGAR +25</span><span>↗ CLICK TO DROP A PEBBLE</span></div></div>
 <div className="maze-action" role="status"><span className={running?'on':''}/>{status}</div>
 <div className="maze-controls"><button className="maze-primary" disabled={training} onClick={()=>{if(running){setRunning(false);persist();setStatus('Trial paused · resume or start a new exploration')}else start(false)}}>{running?'Ⅱ Pause':'▶ Explore & learn'}</button><button disabled={training||running} onClick={()=>start(true)}>↗ Test learned route</button><button disabled={training||replaying} onClick={()=>throwRock()}>☄ Throw pebble</button><label>Speed<select aria-label="Fly speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={1}>1×</option><option value={4}>4×</option><option value={8}>8×</option></select></label></div>
 {!running&&steps>0&&!completed&&<button className="maze-resume" disabled={training} onClick={()=>setRunning(true)}>Resume this trial →</button>}
 <div className="maze-counters"><div><b>{steps}</b><span>steps this trial</span></div><div><b>{best??'—'}</b><span>best successful trial</span></div><div><b>{maze.optimal}</b><span>shortest possible route</span></div></div></section>
 <section className="maze-neural" aria-label="Real brain sensory model"><div className="lab-panel-head"><span><i/> REAL CONNECTOME</span><button onClick={()=>useStore.getState().toggleInspector()} disabled={!data}>Inspect data ↗</button></div><div className="maze-brain">{selectedNeuron!==null&&<button className="maze-brain-overview" onClick={()=>useStore.getState().setHovered(null)}>Whole brain ↗</button>}{data?<BrainScene data={data}/>:<p role={dataError?'alert':'status'}>{dataError??'Loading official neuron catalogue…'}</p>}<div className="brain-tag">MaleCNS v1.0 <span>NON-PIXELATED / REAL ANATOMY</span></div></div><div className="maze-neural-readout"><span className="maze-eyebrow">{phase==='propagating'?'EVENT-TRIGGERED MODEL PLAYBACK':sim?'LAST EVENT · PEAK SUMMARY':'AWAITING A SENSORY EVENT'}</span><h3>{cue}</h3><div><b>{sim?.result.metrics.neurons_activated.toLocaleString()??'—'}</b><span>neurons reached by this event</span></div><p>Maze events → mapped sensory neurons → propagation over the full graph. This activity explains the sensory model; the game controller chooses movement separately.</p>{neuralError&&<p className="maze-error" role="alert">{neuralError}<button onClick={()=>void sensory('motion',true)}>Retry sensory model</button></p>}</div><WhatHappening data={data} event={activeCue} decision={decision} history={decisionHistory}/></section></div>
 <section className="maze-learning" aria-label="Learning progress"><div className="learning-title"><span className="maze-eyebrow">TRIAL → REWARD → BETTER ROUTE</span><h2>A little less lost.</h2><p>{memory.episodes} learning trials · {trials.length} trials sampled from the last {memory.trials.length}<br/>{saved?'Memory saved on this device, for this maze.':'Storage unavailable. Memory lasts for this visit only.'}</p><div><label className="batch-select">Practice batch<select aria-label="Training attempts per batch" disabled={training||running} value={batch} onChange={e=>setBatch(Number(e.target.value))}><option value={10}>10 attempts</option><option value={50}>50 attempts</option><option value={200}>200 attempts</option></select></label><button className="maze-primary" disabled={training||running} onClick={()=>void train()}>{training?`Training ${progress}/${batch}…`:`Train ${batch} attempts`}</button><button disabled={training||running} onClick={()=>{const next={...fresh(maze),baseline:evaluate(maze,fresh(maze))};saveMemory(maze,memory);setMemory(next);setSteps(0);setCompleted(true);setReplaying(false);setDeadEnds(0);setBacktracks(0);setDecisionHistory([]);setStatus('Learning memory cleared for this maze')}}>Reset this maze’s memory</button></div></div>
 <div className="learning-plot" data-version={version}><div className="plot-caption"><span>STEPS TO SUGAR <small>lower is better</small></span><span>{successes.length}/{trials.length} reached sugar</span></div><div className="trial-bars" role="img" aria-label={`Learning chart: ${successes.length} successes in ${trials.length} displayed trials. Best ${best??'not yet reached'}, shortest possible ${maze.optimal}.`}>{!trials.length?<p>No attempts yet. Watch the untrained run, then practice.</p>:trials.map((t,i)=><div key={memory.trials.length-trials.length+i} className={`${t.success?'success':'failed'} ${t.training?'':'test'}`} style={{height:`${Math.max(4,t.steps/max*100)}%`}} title={`Attempt ${t.attempt??'legacy'} · ${t.training?'Learning':'Test'}: ${t.steps} steps, ${t.success?'sugar found':'timed out'} · ${t.deadEnds??'unrecorded'} dead-end visits · ${t.backtracks??'unrecorded'} backtracks`}/>)}<span className="optimal-line" style={{bottom:`${maze.optimal/max*100}%`}}/></div><div className="plot-caption"><span>EARLIER TRIALS</span><span>RECENT →</span></div><small>Mint = success · pink = timeout · blue = test. No assumed improvement or transfer between mazes.</small></div></section>
 {data&&inspector&&<ScientificInspector data={data}/>}</>
}
