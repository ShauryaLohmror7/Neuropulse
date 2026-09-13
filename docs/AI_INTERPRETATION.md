# Optional AI scene interpretation

The UI offers **Local** (no external text transmission) and **Gemini scene interpretation**. Gemini is selected initially when configured; users can switch to Local. Without a key, Local is selected. AI mode becomes selectable when the backend has `GEMINI_API_KEY`. Put it in the ignored `backend/.env`, then restart the backend. Never use a `VITE_*` variable for credentials. `NEUROPULSE_LLM_MODEL` optionally selects a Gemini model supporting structured output; the default is `gemini-3.5-flash-lite`.

The UI checks `/api/interpreter` for availability. A configured key means configuration is present, not that account access or quota has been verified.

## What the AI does

`POST /api/interpret` accepts `{text, mode: "local" | "llm"}`. AI mode sends that event's text and the supported ontology to Google Gemini's `generateContent` API with no tools and a JSON schema. It extracts supported cue keys, exact source quotations, present/absent/hypothetical/uncertain status, side, illustrative timing, disclosed assumptions, unmodeled context and follow-up questions. It does not receive the user's graph or credentials in its prompt.

The backend validates the response and constructs components from its own ontology. The model cannot supply neuron IDs, connectivity, firing rates, action results, new stimulus classes or biological evidence. All AI-derived cues remain **approximate**, with interpretation confidence capped at 0.6. The ordinary mapper then selects actual annotated input cells; propagation and the existing behavior-channel readout run independently of the LLM.

Exact quotation and schema validation do not prove semantic or biological correctness. In particular, an LLM can misunderstand a scene. This integration broadens language interpretation; it does not add validated courtship, learning, emotion or arbitrary behavior models. It must not be described as a fly accurately responding to any possible input.

## Stable sequences and fallback

Interpretation returns an HMAC-signed compilation receipt. `/simulate` accepts it as `interpretation_ticket`; `/simulate-sequence` accepts an aligned `interpretation_tickets` array. The frontend retains receipts alongside successful sequence events. Previous events are reproduced without another LLM call. Replay also makes no LLM call. Empty settling events use the local compiler and send no text externally.

Receipts are signed with a process-local secret. Restarting the backend invalidates them; the API asks the user to start fresh/reset rather than silently reinterpreting earlier events. This development design assumes one backend worker. Multiple workers would need a shared signing key or durable interpretation store before deployment.

Missing configuration, timeouts, refusals, incomplete output or invalid plans use the local parser, with an explicit fallback notice in the result. Provider errors and secrets are not reflected into client messages. If a request is canceled in the browser after submission, the external call may already have incurred usage; stale responses cannot update the scene.

## Try these after configuring a key

These are evaluation prompts, not assertions of known biological outcomes:

- “A brush grazes the left feeler over and over.” Check antennal contact, left side and repeated timing.
- “A female crosses its view while it drinks sugar.” Check distinct motion and oral taste; no invented cVA or forced courtship.
- “Rain beats against the window while the fly stays indoors.” Check that external rain is not injected as body contact.
- “Nothing touches its antenna, but it hears a courtship song.” Check absent contact and present sound remain separate.
- “It remembers yesterday's food.” Check memory is reported as unmodeled, not present smell or taste.
- “A cool breeze passes over it as the lights blink.” Check airflow, temperature and repeated light cues with explicit approximation caveats.
- “The fly feels happy about winning chess.” Check no invented happiness neurons or forced activity.

## Verification

64 backend tests pass, including nine new interpreter tests: multi-cue parsing of validated plans, side/timing preservation, rejection of arbitrary neuron/action fields, absent cues, absent evidence, missing key, provider failure, refusal/incomplete/invalid output, signed-receipt integrity, and real-graph sequence continuation without reinterpretation. Automated provider tests use mocks. Five live Gemini checks also passed: repeated left-antennal contact, simultaneous female motion and sugar ingestion, sheltered rain producing no contact input, absent contact with present song, and remembered food producing no present sensory input. See `gemini-live-evaluation.json` for four recorded cases. These are limited language-mapping checks, not biological validation.

Integration follows Google's [structured output guide](https://ai.google.dev/gemini-api/docs/generate-content/structured-output) and [Generate Content API reference](https://ai.google.dev/api/generate-content). There is no OpenAI integration. Gemini's [free tier](https://ai.google.dev/gemini-api/docs/pricing) has quotas; exceeding them causes local fallback, not automatic billing activation or a switch to a paid provider. Billing belongs to the Google project: using a key from a billing-enabled project can incur charges. This setup must use a free-tier project; no billing is enabled by the app. Google lists free-tier data usage separately from paid-tier data usage; review the provider terms before sending private text.

On 2026-09-13, AI Studio showed the existing Default Gemini Project on the Free tier. Automated creation of a dedicated NEUROPULSE key in that project was rejected by Google with “The request is suspicious.” The account owner then manually created the Neuropulse key; its Free tier was verified in AI Studio and it was stored in the ignored backend `.env` with file mode 0600. No existing project's key was copied or reused. A separate Google project was not created after automatic approval review rejected that additional resource change.

The existing local development app has no public authentication or per-user quota layer; add these before exposing an external-model endpoint publicly. API keys remain server-side, excluded from source control and browser responses.

End-to-end browser verification: “A brush grazes the left feeler over and over.” used Gemini interpretation, mapped 79 real input neurons, reached 207 neurons through 37,408 connections, and produced the modeled Antennal grooming readout (3/8 monitored markers reached). This is a model result, not a measured fly behavior.

## Optional action suggestion fallback

Gemini mode now enables `ai_action_fallback` on simulation requests. Local mode leaves it off. When model confidence is NONE, a second server-side Gemini call receives the situation, actual mapped cues, aggregate activated type/class counts, output-marker evidence and sequence context. It returns a separate `response.ai_hypothesis` with one concrete suggestion or a clarification question, rationale and assumptions. It cannot write model activations, readout confidence, wiring or neuron identities. Only the last event of a sequence invokes this fallback.

The UI leads with **AI-suggested action**, explicitly says movement is not established by the simulation, and retains the actual model result under the expandable explanation. JSON and Markdown exports preserve this separation. This increases response coverage, not validated behavioral accuracy. Outputs can still be wrong and are not grounded by an automatic literature retrieval system.

Provider requests use the existing Gemini key, no redirects, a bounded timeout and validated JSON. Missing keys, timeout, quota errors and malformed results leave the computed simulation intact and display an availability notice. No additional provider request occurs for a resolved action or blank settling event. Speculative future events, contradictions and nonsense should request clarification. The prompts guide these semantic decisions; schema validation does not prove their biological correctness.

Live four-input check: rain and social approach returned action hypotheses; nonsense returned clarification; repeated antenna contact retained the model grooming readout without an AI action. See `ai-action-live-check.json` for the actual outputs (not accuracy scores).

### Stricter signal requirement (supersedes scene-based fallback above)

Following the coherence audit, scene-only action generation is disabled. The server now computes eligible candidates from monitored action channels with above-threshold reached neurons, intersects their IDs with actual run activations, and requires Gemini to select an exact candidate label and cite reached marker IDs. Unknown actions, absent IDs and empty citations are rejected. Action wording is supplied by the server from the channel label, not freely generated by Gemini. With no eligible candidate, no external action request is made. The UI calls this a partial pathway candidate, not a concrete decoded movement.

This verifies dependence on simulated marker activity and blocks unsupported action labels. It does not validate physiology or prove Gemini's rationale. The biological association comes from curated readouts; the activity is still modeled. More inputs will therefore have no action suggestion. The earlier four-input JSON records the superseded permissive behavior, not the current policy.

### Current policy: broad, activity-informed hypotheses

The user requested broad suggestions again after the stricter candidate-only audit. The current policy supersedes both earlier fallback descriptions: Gemini can suggest a concrete action beyond the monitored channels, but must cite reached neuron IDs from supplied activity samples whenever activity exists. Samples include type/class, side, modeled activity, first step and retained-state status. The server rejects absent IDs and missing citations, keeps a verified copy of the cited cells and sets the evidence label itself. With no activity, a suggestion is explicitly scene-only. Clarification remains available for uninterpretable input.

The UI and exports separate the activity observation, action inference, assumptions and original computed result. A verified citation proves that a cell was reached in the model; it does not prove that its activity causes the proposed action or that Gemini's reasoning faithfully uses it. Directional guesses require explicit assumptions when not supported by motor readout evidence. No universal biological accuracy or guaranteed provider availability is claimed.
