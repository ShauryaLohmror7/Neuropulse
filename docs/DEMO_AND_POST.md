# NEUROPULSE: demo and public description

## What this build is ready to demonstrate

A local, interactive connectome explorer: broad text interpretation with Gemini, real annotated input neurons, propagation over the full annotated MaleCNS graph, inspectable action-circuit readouts, optional neural-state continuity, and exportable model results.

It is **not** a validated digital fly, an arbitrary-input behavior predictor, or a biological learning model. No public deployment or LinkedIn publication was performed. Hosting the full graph and protecting the external-model endpoint are separate release work.

## Explain it in 30 seconds

“NEUROPULSE turns a described experience into supported sensory cues using Gemini. Those cues stimulate real, annotated neurons in the MaleCNS dataset. A simplified model propagates activity through 166,700 neurons and 25,582,938 recorded directed connections. The interface shows the computed activity and checks selected circuits associated with actions. The anatomy and wiring are real; the dynamics and action readout are experimental model hypotheses.”

## A three-minute walkthrough

1. Open the local frontend at `http://localhost:5173`. The brain is the default view. Orbit and zoom; inspection opens only through an explicit neuron or inspector control. Explain that branch widths and signal travel speed are illustrative.
2. Choose **Antenna cleaning**, then **Simulate experience**. The result appears as soon as computation finishes, while recorded activity plays. Read the plain-language outcome, then expand **What the network did** to see actual IDs/types and counts. Exact output counts can differ with interpretation, side and timing.
3. Use **Show final activity** to skip the remaining playback. **Replay** only replays the recorded result. It does not spend another Gemini request or create more neural activity.
4. Try **Flashing lights**. Show the broader visual response. An unresolved action means the decoder cannot choose a movement; it does not mean a living fly would do nothing.
5. Try **Social encounter**. Gemini can identify motion and taste from one situation, but mating intent alone does not establish pheromones, song, internal reproductive state or a validated courtship prediction.
6. Expand **Settings**, switch **Fresh run** to **Continue sequence**, and enter a repeated touch. After it settles, use **Let activity settle**. Explain that residual activity carries over; synaptic weights do not learn. **Reset sequence** clears the history. **Fresh run** starts each event from zero activity.
7. Open **Science & sources**, inspect a reached real neuron, then export a readable report or full model data. Reports retain the scientific limitations and never include API credentials or interpretation receipts.

## Input evaluation examples

| Input | What to inspect |
| --- | --- |
| `A brush grazes the left feeler over and over.` | Repeated left-antennal contact; possible grooming-circuit readout. |
| `lights repeatedly turn on and off` | Repeated light input; action may remain unresolved. |
| `another fly comes to mate` | Disclosed visible-motion approximation; no forced sexual activation. |
| `the fly is held in a hand` | Sustained body contact; restraint physics remains unmodeled. |
| `the air around the fly suddenly becomes hot` | Temperature-related input population. |
| `a breeze blows across its antennae` | Airflow-related input. |
| `Nothing touches its antenna, but it hears a courtship song.` | Contact is absent; sound remains present. |
| `Rain beats against the window while the fly stays indoors.` | No invented droplet contact. |
| `It remembers yesterday's food.` | Memory content is outside the current model; no invented present smell/taste. |

These are language/software checks. They do not validate the behavior of a living animal. Input length is limited to 600 characters. Gemini can misunderstand inputs; the UI exposes its interpretation and assumptions. Invalid/provider-limited responses use a visibly labeled local fallback.

## Draft LinkedIn post

I built NEUROPULSE, an interactive explorer that connects natural-language experiences to a real fruit-fly connectome.

It uses the MaleCNS dataset from Janelia FlyEM: 166,700 annotated neurons and over 25 million directed connections. Gemini interprets a scene into supported cues; a simplified network model then calculates activity and checks selected action circuits.

You can explore source neuron morphology, follow modeled signals, compare independent inputs with a continuing sequence, and export the result with its evidence and limitations.

The scientific boundary matters: this is real anatomy with experimental modeled activity—not a validated recreation of a living fly, and not a model that can accurately predict every possible behavior. Building the interface made that distinction especially interesting to explore.

Dataset credit: Janelia FlyEM / MaleCNS — https://male-cns.janelia.org/

## Verification and remaining release limits

- 67 backend tests and four frontend tests pass; production build passes. Browser verification covered preset submission through Gemini, immediate plain-language outcome during playback, orbit without inspector opening, final-activity skip, and a successfully downloaded/checked Markdown report (`demo-run.md`).
- Five live Gemini-to-full-graph demo scenarios pass after correcting omitted body contact. Evidence: `demo-live-check.json`. Earlier language checks also cover mixed cues, negation, sheltered rain and memory (`gemini-live-evaluation.json`).
- Exact sampled overview paths, real measured soma positions, all-graph computation and full-detail source retrieval remain distinct. Branch-focus mode is a display choice, not a neuron-count reduction in the simulation.
- The model lacks validated learning/plasticity, many internal-state mechanisms, a physical body/environment and comprehensive action decoding. A full-graph computation does not mean full biological function is modeled.
- The app is currently a local demo. Public hosting needs an appropriately sized backend, authentication/rate limits for the Gemini endpoint, and durable/shared receipt signing if using multiple backend workers. No billing was enabled.
