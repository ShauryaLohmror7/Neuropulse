# Pixel maze learning lab

Open **Maze learning ↗** in the main app header. The left panel is pixel artwork; the right panel uses the existing official MaleCNS geometry and full graph.

## Controls

- Choose one of five deterministic mazes, from 9×9 to 17×17. Shortest start-to-sugar routes increase: 12, 20, 48, 52, 92 steps.
- **Explore & learn** starts a visible trial with 20% exploratory action selection. **Pause** stops it; **Resume this trial** continues it. Starting another exploration begins at the entrance.
- **Train 10 / 50 / 200 attempts** computes additional learning episodes; choose the batch size before training. The hardest maze needs multiple batches. The chart shows actual sampled trials from the last 200; it does not invent a decreasing score.
- **Test learned route** disables exploration and learning updates. Untrained equal-valued choices are tie-broken randomly. Training improves the policy; a premature test can still time out.
- **Throw pebble**, or click an empty corridor, sends a pixel obstacle toward that tile. It lands after 0.5 seconds and disappears 6.5 seconds after launch. The controller cannot move into the landed obstacle. A blocked corridor may require waiting for it to disappear.
- Memory is stored locally and separately for each maze. **Reset this maze’s memory** clears only that maze's learned values. Storage failure is surfaced in the UI.

## What learns, exactly?

The game uses a tabular Q-learning controller, not biological synaptic plasticity. State is the agent's grid cell; actions are north/east/south/west. Adjacent walls are observed, and wall actions are excluded. The controller receives +25 at sugar, −0.04 per ordinary step and −0.5 for an obstacle collision. It uses learning rate 0.25 and discount 0.97; accelerated training uses exploration 0.18. The shortest route is calculated only for the displayed benchmark and tests, never to choose the agent's action or shape its reward.

A different maze gets independent memory. The product does not claim learned general navigation transfers to a new layout. Pixel fly anatomy, leg/wing motions and obstacle animation are illustrative artwork.

## Real connectome integration

Maze events call the existing `/api/simulate` endpoint: visual motion, approaching object, body contact, fruit odor near the reward, or labellar taste at sugar. Those inputs resolve through the existing sensory ontology and propagate over the full annotated neuron graph. Completed responses are cached per event within the current maze visit, then replayed when the event recurs. Calls are throttled; important events arriving during a request queue the latest event. The display is event-triggered model playback, not a continuous electrophysiological recording.

The brain does **not** control the Q-learning agent's movements, and its graph weights are not trained by this game. The UI explicitly states this separation. The dataset does not establish sugar-specific identity for the stimulated gustatory population. Successful maze navigation is a game result, not evidence of a validated biological fly simulation.

## Validation

## Seeing improvement

An untrained baseline is evaluated with a fresh controller and saved with its exact path. **Watch untrained attempt** replays that path without changing learned values or adding a completed attempt. There are no scripted wrong turns. Dead-end entries are measured when the fly enters a non-start/non-goal corridor with only one exit; backtracks count immediate returns to the previous tile. A brief visual pause and marker make dead ends noticeable without changing the selected route.

The learned test uses the same maze, start, goal and tie-breaking seed as the baseline, with exploration and learning disabled. The before/after panel compares steps and route counters. A percentage appears only when both runs reach sugar and the learned test has no obstacle contacts. A timed-out baseline remains labeled as a timeout. The first-maze browser check recorded 70 steps and 32 backtracks before training, versus 12 steps and none after 50 learning attempts (83% fewer steps).

Completed-attempt totals distinguish training from tests and survive the rolling 200-trial history limit. Replays are not attempts. Interrupted runs are not counted as completed. Legacy memories with incomplete older test history show an “at least” total. Resetting a maze removes its comparison and learning history and creates a new fresh-controller baseline.

## Plain-language explanation

The right-side **What’s happening?** panel gives a factual controller explanation for exploratory choices, tied action scores, highest-score actions, single exits, dead ends, backtracking, obstacles and sugar. A short recent-decision log preserves meaningful transitions. Explanations are computed from the selected action and observed route; they are not invented internal thoughts.

The sensory section explains the latest computed event separately. It names mapped input types, broad annotated neuron groups, and up to three neuron types above the threshold in the displayed model step (or reached in the frozen summary). It distinguishes directly seeded cells from cells activated downstream. Clicking a type opens a real representative skeleton. Fruit odor is described as fruit scent near the sugar reward, not as the smell of sugar itself.

Run `node --test frontend/tests/maze.test.mjs` from the repository root (Node 22.18+ with TypeScript stripping, verified on Node 25). Tests cover all maze reachability/difficulty progression, convergence to shortest routes after 500 trials, evaluation without Q updates, obstacle collisions and independent memory.

Browser checks cover training, learned-route completion, event-triggered taste and looming activity, memory persistence, scrolling and responsive layout. Frontend production build passes; existing shared Three.js lint/bundle warnings remain.
