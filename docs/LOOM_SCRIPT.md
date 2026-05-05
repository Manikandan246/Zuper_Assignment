# Loom recording script — 4 to 5 minutes

**Setup before recording:**
1. Open Chrome (NOT Safari — easier mic permissions). Sign into your laptop.
2. Open Tab 1: `https://zuper-copilot-two.vercel.app/jobs/cedar-lane` (the live demo). Reload once so it's warm.
3. Open Tab 2: `https://zuper-copilot-two.vercel.app/eval` (the visual eval report — for section 6).
4. Test your mic and screen recording with Loom for 10 seconds. Speak in a normal indoor voice.
5. Have the `clip01_clean_baseline` script printed or open in a third tab — you'll read it as your demo voice note.
6. Close Slack, email, calendar pop-ups. Full-screen the browser.

**Pacing target:** 4:30. Ruthless. Re-record up to 3 times. Submit the best one.

**Critical numbers to memorize before recording (the panel will ask):**
- Deepgram mean WER: **7.8%**
- Whisper mean WER: **9.5%**
- Deepgram domain-term recall: **93%**
- Whisper domain-term recall: **89%**
- Whisper domain recall on Indian English clip: **50%** (vs Deepgram's 100%)
- 5 predictions made; **only 1 was correct**

---

## Section 1 — Frame the problem (00:00–00:55)

[Have `/submission` open on screen as you start. The hero is visible behind your webcam tile — it visually reinforces what you're saying. No demo yet — webcam is the focus.]

> "Hi, I'm Mani. First — thanks for the opportunity to take this on. Genuinely enjoyed the build, learned a lot working through the eval methodology and the schema design. Over the next five or six minutes, I'll walk you through what I built: the problem we're solving, the live prototype, the AI evaluation behind the vendor choices, and what's on the roadmap.

> **The shape of the problem.** Roofing technicians work in voice. Hands full, ladder underneath them, weather around them, time pressure on every visit. Voice notes get recorded today — but they don't structure into anything the next technician or the office can actually act on. What the prior tech saw, what they tried, what didn't hold — that knowledge is mostly lost between visits.

> **The product turns that voice into a structured diagnostic** — observations, ranked hypotheses with counter-evidence, ordered next steps, a parts list, a customer-safe written summary — for the technician to review and save as a versioned record. AI does the doing. Humans set direction, handle exceptions, and own outcomes.

> **The demo scenario.** A recurring-leak callback. Third complaint in eight months. The technician is on a ladder, gloves on, wind picking up, anxious homeowner watching from the driveway. About 90 seconds to come down with a diagnosis."

## Section 2 — Job context (00:55–01:20)

[Click "Demo" in the top nav. Land on `/jobs/cedar-lane`.]

> "The header tells the technician immediately this is a recurring callback — third visit, status pill is rose. Below: customer, address, asset — 14-year-old asphalt 3-tab roof. The prior visits timeline shows what Carlos Mendez did twice — caulked the vent boot, replaced ridge shingles. Both repairs failed. The AI sees all of this in the prompt context. The technician sees what every prior tech saw, in one screen."

[Scroll slowly through the Cedar Lane page so the timeline and prior actions are visible.]

## Section 3 — Voice note demo (01:20–02:15)

> "I hit the record button. Single big button, push-to-talk. No wake-word — false activations on a windy roof are dangerous and embarrassing."

[Click record. Read the clip01_clean_baseline script naturally — about 30 seconds. Stop.]

> "Audio goes to Deepgram Nova-3 with a roofing keyterm list — ridge cap, vent boot, valley flashing, drip edge, granule loss, and so on. Nova-3 returns word-level confidence; low-confidence words are faded and uncertain ones tint amber, so the technician sees what to verify before any AI reasoning fires. This is the failure mode I want to surface, not hide."

## Section 4 — Structured output (02:15–03:55)

[Click "Get AI Guidance". The five-stage loading sequence begins.]

> "I just hit Get AI Guidance. Claude Sonnet 4.6 takes about sixty to ninety seconds to reason through this. While it does, you'll see five sequenced stages on screen. They're not a fake spinner — each one maps to a section of the structured output that's about to appear. Let me narrate what's happening behind each stage."

### What to say while loading (60–90 second filler — modular, deliver as much as time allows)

[Stages cycle on screen at ~14-second intervals. Read alongside them; speed up or slow down to match.]

> "Stage one — observation extraction. The model is pulling atomic facts out of the transcript: visible damage, sounds, measurements, what the homeowner said. And it's separating those facts from interpretation. Facts go in one bucket; reasoning over those facts goes in another. That separation matters — the technician can scan the observations field and catch factual errors in five seconds before they propagate downstream into hypotheses or customer-facing copy.

> Stage two — hypothesis formation. For every likely cause the model proposes, it has to generate **counter-evidence** — facts that argue *against* the hypothesis. The schema literally requires a counter_evidence array on every hypothesis. This is the no-overconfidence guardrail rendered as data, not as a paragraph of prose in the prompt that the model can ignore.

> Stage three — confidence calibration. High, medium, or low. And when confidence is low on a high-cost recommendation — say a full roof replacement — a guardrail fires and the model explicitly withholds that recommendation. You'll see that in the guardrails_triggered field once the output lands.

> Stage four — drafting the customer-facing summary. The prompt explicitly forbids commitment language: no insurance promises, no specific costs, no warranty claims, no diagnoses of someone else's prior workmanship. And the field is hard-gated in the UI by a reviewer checkbox before save can fire.

> Stage five — the safety pass. Assumptions the model inferred go in one list; items that need human confirmation go in another. The technician can scan both before approving.

> One technical detail underneath all of this: the schema is enforced through Claude's tool-call mode. The model isn't producing prose and hoping it parses into JSON. It's emitting a JSON object that has to match a schema, validated programmatically on the response. Schema-invalid output is structurally impossible. That's the difference between AI as a workflow component and AI as a chatbot."

[Output appears on screen. Scroll into view.]

> "Before walking through the schema, frame what just happened. Three questions a technician implicitly asks at this moment — *what should I check first, what parts may be needed, what should I ask the customer.* The structured output answers all three from a single voice note. **Recommended next steps** answers the first. **Parts and tools** answers the second. **Customer-facing update** answers the third. Three chat turns collapsed into one API call, with audit-ready review on every field. The technician never has to *ask* anything; the output anticipates the questions and lays the answers out in fields they can scan and edit. That's the difference between a chatbot and a workflow component."

[Pause for half a second. Then continue.]

> "Beyond those three, six other things matter on this screen.
> **One:** observations are separated from interpretation. Visible damage, sounds, measurements, homeowner statements. Atomic facts the technician can check.
> **Two:** every hypothesis has counter-evidence. The AI argues against itself. The no-overconfidence guardrail rendered as data, not as a paragraph.
> **Three:** confidence is calibrated and visualized — three-bar indicator alongside the level. When confidence on a high-cost recommendation is low, you see a guardrail trigger like 'withheld full replacement: confidence below threshold.'
> **Four:** every next step is marked for whether it requires homeowner consent and whether there's a safety note.
> **Five:** the customer-facing update has a *hard* gate — not a warning, an enforced checkbox. The save button is disabled until the technician explicitly confirms they've read it. This is the operator-supervisor pattern at the most-likely-to-go-wrong surface.
> **Six:** assumptions and needs-human-confirmation are listed explicitly so the technician can scan for hallucinations in five seconds."

## Section 5 — Review and save (03:55–04:25)

[Edit one field — add a step to recommended_next_steps. Then tick the customer-copy checkbox. Click Approve & save.]

> "Every field is editable. The save button is gated until I've ticked that confirmation box on the customer copy. Approve, and the output saves as a versioned record tied to the voice note. If a follow-up tech opens this job, they see exactly what the prior tech approved and what was edited.
> AI proposes. Human reviews. System records. That's what operator-becomes-supervisor looks like at the field level."

## Section 6 — Eval (04:25–05:25)

[Switch to Tab 2: the /eval page. Scroll through it deliberately as you talk.]

> "Required deliverable: STT evaluation. This is the eval results page on the deployed app. Top of the page: production recommendation, Deepgram Nova-3, wins 4 of 6 weighted dimensions.
> Aggregate cards: mean WER 7.8 versus 9.5. Domain-term recall 93 versus 89 — that's the metric that drives diagnostic quality, not overall WER. Mean latency: Whisper actually edged Deepgram on the mean here, opposite of my prediction. Fleet cost: Deepgram is cheaper at scale.
> The decisive finding — this big rose-bordered section. On the Indian English accent clip, Whisper's domain-term recall dropped to 50 percent. Deepgram held 100. A US roofing workforce includes many non-native English speakers; Whisper losing half its accuracy on accented speech is a product-killing failure mode. This single-category result decides the vendor for me, even before the rubric."

[Scroll to the calibration table.]

> "And the credibility section: I made 5 predictions before running the eval. Only 1 was correct. The methodology was sound; my priors were not. The misprediction rate is the strongest argument *for* the methodology — without it, I'd have made a worse vendor decision."

[Briefly hover over the navigation back to /eval-plan, or just gesture toward it.]

> "The full eval plan also covers the dimensions that don't fit on this visual page — privacy and compliance gates, developer-experience observations across both providers, and the downstream LLM-as-judge methodology that scores whether STT errors propagate into wrong workflow outputs. Those are reference reads in the eval plan."

## Section 7 — Out of scope and the roadmap (05:25–05:50)

[Click "Submission" in the top nav. You land on `/submission`. Scroll down to the "Out of scope (deferred)" and "Roadmap" sections.]

> "Out of scope for v1: streaming partial transcripts, wake-word, multi-language, photo capture (already covered by the existing AI Voice Notes surface), auto task creation in the FSM. Each rationale is one click away in the product note.
> Roadmap, in order: streaming partials for sub-second feedback. A confidence calibration loop — capture every technician edit and use it to ground the prompt over time. Automatic task creation in the FSM from recommended_next_steps. Spanish-language pipeline for crews. AR wearable capture path — the schema is hardware-agnostic; only the capture surface changes.
> Final thought: the voice note isn't the product. The structured output is the product. Voice is just the cheapest way for a technician with gloves on to enter data the AI can reason about."

## Section 8 — Sign off (05:50–06:10)

[Webcam back to focus, or stay on `/submission`. Casual delivery — you're wrapping up, not declaring victory.]

> "And that's the walkthrough. Anything that caught your eye and you want to go deeper on — the product note and the eval plan are right there in the top nav. Schema design, prompt structure, per-clip eval results, the privacy gates, the LLM rationale, all of it lives there. I'd love to walk through any of it live, whenever works for you. Thanks for watching."

---

## Notes on delivery

- Speak normally; don't try to sound polished. The CEO has explicitly said he wants people who "talk to a roofer in the morning and a model team in the afternoon" — your delivery should suggest you can do both.
- When you say "operator becomes supervisor," do **not** make it sound like a slogan. Say it the way you'd explain it to a friend.
- The line *"the voice note isn't the product. The structured output is the product."* is the quotable line — say it with a little weight.
- The line *"only 1 of 5 predictions was correct"* is the credibility line — say it matter-of-factly, not apologetically.
- Cut the recording immediately if you stumble badly — three takes max, pick the best.
- No need for music, transitions, or branding.
- Loom auto-generates the share link. Paste it into the submission.
