## 1. The 90 seconds that matter

A residential roofing technician is on a 22-foot ladder at a recurring-callback address — third complaint in eight months, anxious homeowner watching from the driveway, wind picking up. Gloves on. Phone in chest pocket. About 90 seconds before there has to be either a recommendation or a commitment to another inspection round.

The voice note is the only modality that works in this moment. The technician cannot type. They cannot read a screen carefully. They will not stop to use a complex app. What they need, in plain terms, is this: *talk into the phone for thirty seconds; get back a clean diagnostic plan to review when on the ground; and a homeowner-safe sentence to read aloud before leaving.*

That is the user moment this product is built around.

## 2. What the product does

One screen, three steps:

1. **Job context, always visible.** Customer, address, asset (e.g. 14-yr asphalt 3-tab roof), warranty status, prior visits with the actions each prior technician took, open tasks. The on-site technician sees what every prior technician saw, plus what they did. No tab switching.
2. **Voice in.** Push-to-talk, with a single large button. Audio is sent to Deepgram Nova-3 with a roofing-specific keyterm list. The transcript returns with per-word confidence; low-confidence words are visually flagged before any AI reasoning fires, so the technician sees what to verify.
3. **Structured AI output, reviewable.** Claude Sonnet 4.6 produces a single JSON object containing observations, ranked hypotheses with counter-evidence, ordered next steps with safety notes, a parts list, a customer-facing sentence, and explicit lists of assumptions made and items the AI does not have enough confidence to decide alone. Every field is editable. The customer-facing copy is gated by a reviewer checkbox; the save action is disabled until the technician confirms. On approve, the output is saved as a versioned record tied to the voice note.

The live demo is at [`/jobs/cedar-lane`](https://zuper-copilot-two.vercel.app/jobs/cedar-lane). Source for the AI surface is in [`lib/ai/`](https://github.com/Manikandan246/Zuper_Assignment/tree/main/lib/ai), the structured-output schema is in [`lib/ai/output-schema.ts`](https://github.com/Manikandan246/Zuper_Assignment/blob/main/lib/ai/output-schema.ts), the system prompt is in [`lib/ai/prompt.ts`](https://github.com/Manikandan246/Zuper_Assignment/blob/main/lib/ai/prompt.ts).

## 3. The thesis: AI as workflow, not chat

The product is built against an explicit worldview: **the operator becomes the supervisor. AI does the doing. Humans set direction, handle exceptions, and own outcomes.** That worldview is not something the technician is meant to *learn*; it is the shape of the surface they see.

A generic chatbot would let the technician ask "what should I check?" and return a paragraph. That paragraph is not a workflow artifact. It cannot be reviewed line by line. It cannot be confidence-gated. It cannot enforce a guardrail on customer-facing copy. It cannot be saved as a structured record that another technician will later trust.

The technician is, implicitly, asking three things: *"What should I check first?"*, *"What parts may be needed?"*, *"What should I ask the customer?"* The structured output answers all three from a single voice note — `recommended_next_steps` answers the first, `parts_and_tools` the second, `customer_facing_update` the third. Three chat turns collapsed into one API call, with audit-ready review on every field. The technician never has to *ask* anything; the output anticipates the questions and lays the answers out in fields they can scan and edit.

So the design centerpiece is the **structured output schema**, not the chat interface. The schema does six load-bearing things:

| Field | What it does for the workflow |
|---|---|
| `observations.{visible_damage, sounds, measurements, homeowner_statements}` | Forces the AI to separate facts (extracted from the voice note) from interpretation. The technician can scan and correct factual errors in five seconds before they propagate downstream. |
| `diagnostic.likely_issues[].counter_evidence` | Forces the AI to argue against itself on every hypothesis. This is the "no overconfidence" guardrail rendered as data, not as a paragraph. |
| `recommended_next_steps[].requires_homeowner_consent` | Operationalizes the rule that any step affecting private property needs explicit homeowner buy-in. The technician sees the badge, asks the homeowner, and proceeds. |
| `customer_facing_update.must_be_reviewed: true` (always) | The AI cannot bypass the human gate on customer-facing copy. Period. Even if confidence is high. This is the operator-supervisor pattern at the most-likely-to-go-wrong surface. |
| `assumptions_made` | Surfaces every inference the AI made that the technician didn't literally say. Lets the technician scan for hallucinations before save. |
| `guardrails_triggered` | A persistent record of which safety rules fired on a given output. This is observability for AI behavior, not just outputs — useful for product analytics, useful for trust, useful when something goes wrong in production. |

## 3.5. How the system prompt is structured

The schema is the contract; the prompt is what gets the model to honor it. The full system prompt is at [`lib/ai/prompt.ts`](https://github.com/Manikandan246/Zuper_Assignment/blob/main/lib/ai/prompt.ts). It is organized as ten numbered operating principles, in priority order:

1. **Safety over speed.** Any recommendation made under unsafe conditions (high wind, slope, electrical hazard) must include an explicit `safety_note`.
2. **Structured output only.** No prose, no markdown, no preamble. The entire response is one JSON object that conforms to the schema. Enforced via Claude's tool-call mode.
3. **No overconfidence.** Every hypothesis must populate `counter_evidence`. Empty array is allowed only when there is genuinely no counter-evidence — but in roofing, almost every hypothesis has *something* working against it.
4. **Human gates the customer.** The `customer_facing_update.text` is what the technician *may* read to the homeowner. Never write language that promises insurance approval, repair timelines, costs, permanence, or diagnoses someone else's prior workmanship without evidence. `warnings` array must be populated with at least one specific reminder.
5. **Calibrated confidence.** "high" only when evidence is direct. "medium" when suggestive. "low" when multiple competing hypotheses fit. When confidence is low and the recommendation has high cost (replacement, deck-off), populate `guardrails_triggered`.
6. **Surface what you inferred.** Anything not literally said in the voice note but assumed by the model goes into `assumptions_made`. The technician must be able to scan and catch errors.
7. **Reason from facts provided.** Do not invent observations. "Lifted shingles" is not "missing shingles."
8. **Roofing domain.** Use roofing-specific terminology — ridge cap, vent boot, step flashing, drip edge, granule loss — not generic terms when a specific term applies.
9. **Homeowner consent.** Mark `requires_homeowner_consent: true` on any step that affects private interior space or causes visible disruption.
10. **Parts realism.** `typically_in_truck: true` only for genuinely common items. Specialty or color-matched: false.

These principles map 1:1 onto fields in the schema. The prompt isn't a wishlist — it's a contract enforced by the schema and validated programmatically on the response.

## 4. Voice UX decisions and tradeoffs

A few non-obvious calls:

- **Push-to-talk over wake-word.** A wake-word triggered on a windy roof while a homeowner is talking to you is dangerous and embarrassing. Push-to-talk is unambiguous; the technician chooses the moment. The cost is one explicit gesture; the benefit is zero false activations on a ladder.
- **Word-level confidence shading rather than just a global confidence score.** Deepgram returns per-word confidence. The UI fades low-confidence words and highlights any token below 60%. If a homeowner's last name comes back at 0.42 confidence, the technician sees that word tinted amber before the AI ever uses it. A single overall score would hide which 10% of the transcript was wrong.
- **Recorded clip → REST transcribe in v1, not streaming partials.** Streaming would feel snappier, but for a 30–60 second on-roof voice note, end-to-end latency is dominated by the LLM call, not transcription. Reliable streaming WebSocket reconnection on flaky 4G is a separate rabbit hole. v1 ships a working REST flow; streaming is explicit roadmap in section 9.
- **Mobile-responsive web, not native.** Unblocks pilot use inside the existing FSM web shell. Native is a separate decision once the primary on-site capture surface is settled — likely an AR wearable rather than a phone.
- **No auto-save.** Even at high confidence, the AI cannot save without the technician approving. The cost of one extra tap is far smaller than the cost of an unreviewed customer-facing message landing in a CRM and being read aloud at the next visit.

## 4.5. Evaluation: how the STT and the LLM were picked

The eval methodology and per-clip results are at [`/eval`](https://zuper-copilot-two.vercel.app/eval) and in the [eval plan](https://zuper-copilot-two.vercel.app/eval-plan). Summary:

**STT eval — 10 clips across 5 categories** (clean baseline, domain-vocabulary-dense, field noise, accent, partial speech). Compared **Deepgram Nova-3** (with roofing keyterm boosting) against **OpenAI Whisper-1** on six dimensions: overall WER, **domain-term recall** (the metric that maps to product value, ahead of overall WER), p50 + p95 latency, fleet-scale cost projection, and compliance posture. Disqualifying thresholds applied before any weighted average. Plus a downstream LLM-as-judge eval (designed in v1, automated in v2) that measures whether STT errors degrade the *final structured output*.

**Headline result:** Deepgram wins 4 of 6 dimensions. Mean WER 7.8% vs 9.5%. Domain-term recall 93% vs 89%. The decisive sub-result: on the Indian English clip, Whisper's domain-term recall dropped to **50%** while Deepgram held **100%** — a single category result that decides the vendor for any US roofing workforce that includes non-native English speakers.

**Calibration check.** Five hypotheses were stated before the eval ran; only one held. The other four — Whisper winning on partials, on accent, on latency, on cost — all turned out wrong. That misprediction rate is the strongest argument for running the eval at all; the priors would have produced a worse vendor decision.

**LLM choice.** Held constant at Claude Sonnet 4.6 throughout the STT eval to isolate STT effects. The LLM choice itself is justified separately in section 6 of the eval plan, with a v2 eval against GPT-4o-mini (cost-optimized), Gemini 2.5 Pro (long-context for multi-visit customer history), and an open-weight model on a private endpoint (for tenants requiring no third-party data sharing).

## 5. Out of scope, and why

| Out of scope (v1) | Why |
|---|---|
| Wake-word activation | Unsafe without false-positive testing on real on-roof audio. Push-to-talk in v1; wake-word in a future release once a real-conditions corpus exists. |
| Multi-language transcription | Spanish-speaking crews are a real and important segment for US roofing. Multilingual evaluation deserves its own benchmark with native speakers, noise, and accent diversity — not a single cell in an eval matrix. v2. |
| Photo capture and on-roof image annotation | Already covered by the existing AI Voice Notes & Walkthrough surface. The diagnostic reasoning layer in this build is intended to sit on top of that, not duplicate it. |
| Streaming partial transcripts | Not the latency bottleneck on a 30–60 s voice note (the LLM call is). Streaming will matter for longer notes and for live-on-roof feedback; v2. |
| Dispatcher and manager views | Out of scope for the technician moment. Outputs are structured and saved, so downstream views can be built later without rework. |
| Authentication and multi-user | Out of scope for v1 prototype. |
| Automatic FSM task creation from `recommended_next_steps` | Obvious next integration point — every step in the structured output is already a candidate task. v2. |

## 6. Risks and guardrails

| Risk | Mitigation built into v1 | Open risk for production |
|---|---|---|
| Overconfident replacement recommendation | `confidence: low` triggers `guardrails_triggered: "Withheld high-cost recommendation"`. AI is instructed to require direct evidence for any "replace" call. | Need calibration data over time. What's our actual accuracy at each confidence level? |
| Hallucinated customer promise (insurance, warranty) | `customer_facing_update.warnings` is populated. `must_be_reviewed: true` forces human gate. Prompt explicitly forbids commitment language. The save button is disabled until the technician explicitly ticks an "I have read this in full and confirm I will not commit verbally to anything not stated" checkbox — this gate is enforced in the UI, not just the prompt. | The technician can still tick the box without reading carefully. v2 needs randomized integrity checks (e.g., highlight a specific phrase and ask which warning corresponds to it) for high-cost recommendations. |
| PII in transcripts | Voice notes contain homeowner names, addresses, phone numbers, stored in the application database. | Production requires an explicit retention policy (90-day rolling default), per-tenant retention overrides, PII redaction on analytics exports, and BAA-equivalent agreements with the STT vendor for any tenant in a regulated industry. |
| Missing context (tech doesn't mention something material) | `assumptions_made` and `needs_human_confirmation` surface gaps. The prompt instructs: produce best partial plan, do not invent observations. | The system can't ask a follow-up in v1. v2: multi-turn voice ("you didn't mention the attic — do you want to add that?"). |
| Liability of recommending repair vs. replacement | Customer-facing copy is templated and never definitive ("we are seeing X, next step is Y"). High-cost recommendations are gated by the confidence-low → guardrails-triggered path. | Recommendation outcomes need to be tracked over time and fed back as calibration data. |
| Technician trust collapse from one bad output | Every output is reviewed and edited. Edits are stored alongside the raw output, with provenance. | Edit rate per field needs to be monitored. If `customer_facing_update` is edited >50% of the time, the prompt is broken — fix it, don't paper over the symptom. |

## 7. Metrics and launch plan

**Pilot design.** Three to five contractors, eight-week pilot, three-stage rollout. Stage one: shadow mode (the AI runs in the background; output is not surfaced; the technician records notes the normal way; AI output is scored against the tech's notes after the fact). Stage two: opt-in (technician chooses voice mode per-job). Stage three: default-on for the pilot accounts.

**Primary metrics**

1. **Transcript edit rate** — fraction of voice notes where the technician edits the transcript before sending it to the LLM. Target below 10% by end of pilot. Above 25% means the STT is broken for the domain — the fix is at the STT layer, not in prompt-tuning around it.
2. **AI suggestion acceptance rate, per field.** What fraction of `recommended_next_steps` does the technician leave unedited? `parts_and_tools`? `customer_facing_update`? Field-level granularity matters because failure modes differ per field. Targets: 70% on `recommended_next_steps`, 90% on `observations`. Customer-facing copy will be edited often, and that's fine — the gate is the point.
3. **Time per inspection visit** — measured against the shadow-mode baseline. Target: 15–25% reduction by week six.
4. **Repeat-callback rate** — does the structured plan reduce same-issue revisits? This is the metric that maps directly to the contractor's PnL. Tracked on a rolling 90-day window starting from each pilot job.
5. **Customer CSAT post-visit** — was the homeowner's anxiety addressed? Roof repair is a high-anxiety category. Even with no functional change, a clear customer-facing summary should move CSAT.

**Secondary / safety metrics**

- Rate of `guardrails_triggered` per output. Near zero means the prompt is too permissive. Near 100% means the threshold is the noise floor — re-tune.
- Per-confidence-level outcome accuracy. Requires a feedback loop from "the technician said the AI was right or wrong" back into prompt revisions and, eventually, into fine-tuning.
- Field-by-field edit distance, not just edit-yes/no. A one-word edit signals a near-miss; a full rewrite signals a broken prompt.

**Launch gates.** No graduation from shadow mode until edit rate on `observations` is below 15% and `guardrails_triggered` shows non-zero firing on edge cases. No graduation from opt-in to default-on until technician-reported NPS for the feature exceeds 30.

## 8. Where this sits in the broader product surface

This product is positioned as the **diagnostic reasoning layer** that sits on top of an existing voice-and-photo capture surface, not as a replacement for it. Natural integration points:

- **Voice capture** is the input stream. Whatever surface captures voice (mobile app today, AR wearable tomorrow), the audio flows into this layer.
- **Job summary surfaces** are the downstream consumer. Approved structured outputs become the per-visit summary that lands in the office portal and customer portal.
- **AR wearable capture** is the future on-roof input surface. Hands-free voice into the wearable; diagnostic JSON returns to phone or web for review. The schema is hardware-agnostic; only the capture surface changes.
- **Workflow automation.** Every `recommended_next_steps` entry is a candidate task in the FSM. Auto-creating tasks on technician approval closes the loop from voice → diagnosis → executed work.

## 9. Roadmap

In order of impact:

1. **Streaming partial transcripts** for sub-second feedback during longer voice notes.
2. **Confidence calibration loop.** Capture every technician edit. Use the edits to ground the prompt and, over time, to fine-tune. Track per-confidence-level outcome accuracy as a leading indicator of model drift.
3. **Automatic FSM task creation.** Convert `recommended_next_steps` to tasks. Technician approves the batch.
4. **Spanish-language pipeline.** Spanish-speaking crews are a real segment in US roofing labor. Spanish in, English customer-safe summary out for English-speaking homeowners.
5. **AR wearable capture path.** Hands-free voice on the wearable, structured output reviewed on phone or web.
6. **Multi-turn voice.** Active follow-up: "you didn't mention the attic — do you want to add a note about it?"
7. **Proactive context surfacing.** Pull the prior technician's structured notes into the prompt as evidence and counter-evidence — close the institutional-knowledge loop within a trade.
8. **Reviewer integrity checks** for high-cost recommendations: randomized prompts ("which warning corresponds to this clause?") to catch tick-without-reading on the customer-facing gate.

## 10. Summary

The voice note is not the product. The structured output is the product. Voice is the cheapest way for a technician with gloves on to enter data the AI can reason about — the value sits in the artifact downstream, not in the capture itself.

The leverage is in three things: a schema that makes review and audit trivial, guardrails that exist as data fields rather than as prose instructions, and a hard human gate on anything that touches the customer.

The Cedar Lane scenario is one shape; the same primitives extend to every recurring service callback in field service. The path to production is not a bigger model — it's pilot data, calibration, and progressively letting the AI take more of the workflow as confidence accrues. Operator becomes supervisor. This is what the supervisor surface looks like.
