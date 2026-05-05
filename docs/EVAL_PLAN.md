This plan covers two evaluations of the AI components behind the Field Service AI Copilot:

- **Primary** (executed in v1): STT model comparison — Deepgram Nova-3 vs OpenAI Whisper-1 — on a custom roofing-domain corpus, with disqualifying thresholds and a downstream-impact eval.
- **Adjacent** (designed in v1, executed in v2): LLM choice rationale and the planned eval for re-opening the LLM decision.

The two are kept separate by design: the LLM is held constant during the STT eval to isolate STT effects, and LLM choice is justified independently against its own criteria.

---

## 1. Goal

Pick the production STT for the voice copilot, and document the rationale for the LLM choice that sits behind it. Both decisions must hold up under realistic conditions of a roofing technician on a job — not under the conditions of a podcast studio.

The STT eval is a live methodology with results, run across 10 self-recorded clips covering 5 categories. **Headline: Deepgram Nova-3 wins 4 of 6 dimensions including domain-term recall (93% vs 89%) and the accent category (100% vs 50% on Indian English). Production recommendation: Deepgram primary.** Full results in the pilot results section.

The LLM eval is documented as criteria and v2 plan rather than executed in v1, because a half-rigorous LLM comparison alongside a rigorous STT comparison would dilute focus on the methodology that needs to be demonstrated first.

This plan covers:

- The STT candidate set (Deepgram Nova-3, OpenAI Whisper-1, with AssemblyAI Universal-2, Google STT, and GPT-4o-transcribe explicitly in v2).
- The test corpus design.
- The decision criteria, including disqualifying thresholds.
- A downstream eval that measures what actually maps to user value (does the structured AI output remain correct under STT errors?).
- LLM choice rationale (Sonnet 4.6) and the v2 LLM eval criteria.
- Privacy and compliance gates that apply to both layers.
- A re-evaluation cadence.
- Results from a live run on 10 in-house clips.

## 2. Why STT choice matters disproportionately for this product

Most consumer voice products treat STT as a commodity. For us, it is not. Three reasons:

1. **Domain vocabulary.** "Drip edge," "ridge cap," "vent boot," "step flashing," "granule loss," "ice and water shield" are not in the everyday vocabulary models are pre-trained on. A 95% overall WER is meaningless if the 5% errors are all on the words that drive the diagnostic.
2. **Downstream LLM cost.** A noisy transcript leads the LLM to either invent observations or list them as low-confidence. Both are bad. STT errors compound.
3. **Trust collapse.** A technician who corrects the same word three times in a row stops using the feature. Field tools have a low tolerance for friction.

## 3. Decision criteria, with thresholds

| Dimension | Metric | Disqualifying threshold | Production target |
|---|---|---:|---:|
| Overall accuracy | WER on full corpus | > 12% | < 7% |
| Domain accuracy | Recall of roofing terms (token-aligned) | < 85% | > 95% |
| Latency | Median p50 of full transcribe time on 30-60s clips | > 4 s | < 2 s |
| Tail latency | p95 latency | > 8 s | < 4 s |
| Cost | Projected monthly $ at 200 techs × 30 voice notes/day × 45s each | > $400/mo | < $200/mo |
| Reliability | Failure rate (HTTP errors, malformed responses) over a sample of 100 calls | > 1% | < 0.2% |
| Streaming support | Has streaming WS API, supports word-level confidence, supports custom keyterm vocabulary | hard requirement for v2 | — |
| Privacy / compliance | BAA available, US data residency option, configurable retention, no training on customer data by default | hard requirement | — |

**Hard rule:** any candidate that fails a disqualifying threshold on any dimension is out. We do not "average around" a hard fail.

## 4. Test corpus design

35 clips total, partitioned across 5 categories. The pilot eval (results section below) used 10 clips covering all 5 categories; the full 35-clip version is the production-decision corpus.

| Category | # clips (pilot) | # clips (full) | What it stresses |
|---|---:|---:|---|
| Clean baseline | 2 | 10 | Floor performance — clear audio, technician-style narration. If a model fails here, nothing else matters. |
| Domain vocabulary dense | 2 | 5 | Roofing terminology specifically. The differentiator. |
| Field noise (wind, traffic, fan, homeowner-in-bg) | 3 | 10 | Realistic roof and ground-level conditions. |
| Accents (Indian English, Mexican-Spanish-EN, US Southern, US Midwest) | 1 | 5 | Workforce reality. Most roofing crews in the US are not flat midwestern English speakers. |
| Partial / interrupted / terse | 2 | 5 | The technician saying "hold on" mid-sentence is a real conversation pattern. The model must not drop the words on either side of the interruption. |

**Per-clip recipe.**

- 25-40 seconds.
- Recorded on a phone (representative of how technicians actually capture voice).
- For noise categories, mixed in post (the recorded clean voice + a separate noise track from a free SFX library at -10 to -15 dB relative to voice). The eval ships those mixes, not just the clean source, because the production system will see the mix.
- Reference transcripts are written before the clips are recorded. The technician-reader is allowed (and encouraged) to make natural disfluencies — "uhs," restarts, mistakes — and the reference transcript captures what was actually said, not the script.

The 10 pilot clips and reference transcripts are described at [`eval/scripts/recording_scripts.md`](https://github.com/Manikandan246/Zuper_Assignment/blob/main/eval/scripts/recording_scripts.md) with the canonical reference transcripts in [`eval/scripts/references.json`](https://github.com/Manikandan246/Zuper_Assignment/blob/main/eval/scripts/references.json). The eval runner is at [`eval/run.ts`](https://github.com/Manikandan246/Zuper_Assignment/blob/main/eval/run.ts).

## 5. Metrics: how each is measured

### 5a. Word Error Rate (WER)

Standard Levenshtein-based: `(substitutions + deletions + insertions) / reference_length`. Implementation in [`eval/wer.ts`](https://github.com/Manikandan246/Zuper_Assignment/blob/main/eval/wer.ts).

Tokenization is intentionally aggressive: lowercase, strip punctuation, normalize spelled-out numbers ("fourteen" → "14"). This penalizes models for getting the *meaning* wrong, not for stylistic punctuation differences.

### 5b. Domain-term recall

Of the roofing terms that appear in the reference, what fraction does the hypothesis correctly transcribe? Multi-word terms ("ridge cap") are matched as adjacent token sequences, not as bag-of-words. A model that hears "rich cap" instead of "ridge cap" gets it wrong; a model that hears "ridge" but loses "cap" also gets it wrong.

This is the metric that production decisions should be made on, not overall WER. The eval reports it separately.

### 5c. Latency

End-to-end wall clock from POST request to full transcript returned (REST mode). Both providers tested under the same network conditions on the same machine in the same minute, alternating, to control for network variance.

### 5d. Cost

Computed from each provider's per-minute price × the metadata-reported audio duration.

Projection to fleet: `200 techs × 30 voice notes/day × 45 sec avg × 22 working days/month`. We use this projection to compute a **realistic** monthly bill rather than just $/min, because the question that matters is "what does this cost Zuper at scale," not "what does a 30-second clip cost."

### 5e. Downstream eval (the unique part)

The metric that matters most: **does the structured AI output stay correct when the transcript is noisy?**

Methodology:

1. Run each STT on each clip.
2. Feed each STT's output into the same LLM (Claude Sonnet 4.6, same prompt, same job context) to produce the structured diagnostic.
3. Score the resulting structured output on three dimensions, with an LLM-as-judge using a fixed rubric:
   - **Factual fidelity** — did the diagnostic introduce observations not in the transcript? (1-5)
   - **Actionability** — would the recommendations make sense to a real roofer in this scenario? (1-5)
   - **Hallucination rate** — count of fabricated specifics (names, parts, measurements) divided by total specifics.
4. The "ground truth" structured output is one I produce by hand from the reference transcript, scored the same way.
5. Aggregate across clips per provider.

**Why this matters more than raw WER:** a STT could win on WER but lose more often on factual fidelity if its specific *type* of errors (e.g., name misrecognition) lead the LLM into confident hallucinations. We have not run the downstream eval at scale; v2 of this plan automates it.

### 5f. Developer experience observations

Developer experience (DX) was not formally benchmarked at N=10 — the corpus is too small for that — but the build experience surfaces observations worth recording explicitly, since they shape what the integration looks like in production:

| Dimension | Deepgram Nova-3 | OpenAI Whisper-1 |
|---|---|---|
| **API simplicity** | Single REST endpoint, query-string parameters for model + features. About ten lines of `fetch`. | Multipart form upload, single endpoint. Equally simple. |
| **Documentation** | Roofing-relevant features (keyterm boosting, smart-format) are documented with examples. | Documentation is good but doesn't anticipate domain customization, because the API doesn't expose levers for it. |
| **Streaming support** | First-party WebSocket streaming with partial transcripts and word-level confidence. Direct path for v2 streaming UX. | No first-party streaming on `whisper-1`. Workarounds via chunking or via the separate Realtime API surface. |
| **Transcript timestamps** | Word-level start and end times in every response, surfaced into the UI for confidence shading. | Word-level timestamps available via `verbose_json`. Available, less prominent in defaults. |
| **Diarization** | Optional via `diarize=true`. Not relevant for the single-speaker on-roof case; relevant for v2 use cases like multi-speaker dispatcher calls. | Not supported on `whisper-1`. |
| **Structured-output support** | Domain-vocabulary lever via `keyterm` (used in production); also supports `custom_topic` and confidence in the response shape. | Returns plain text or `verbose_json`; no domain-vocabulary lever. |

**Net DX assessment.** Deepgram exposes more product-relevant levers — keyterm boosting, native streaming, diarization, granular cost controls — that match the dimensions this product cares about. Whisper has fewer levers but cleaner defaults. For a use case where domain vocabulary is the differentiator metric, Deepgram's API surface is more aligned with the product than Whisper's. This DX observation reinforces, rather than contradicts, the WER and domain-term-recall results.

DX is folded into the *Compliance / DX* dimension of the weighted decision rubric (section 11) and contributes to the rationale for picking Deepgram, even though it is not, by itself, a primary scored axis.

## 6. LLM choice rationale and v2 LLM evaluation

The LLM is held constant at **Claude Sonnet 4.6** throughout the STT eval — that's deliberate. Holding the LLM constant is the only way to isolate STT effects on downstream output. But LLM choice itself deserves its own eval, on its own criteria, separate from STT.

### Why Sonnet 4.6 for v1

Four reasons, in priority order:

1. **Native tool-call mode for guaranteed schema adherence.** Anthropic's tool-call interface forces the model to emit a JSON object that matches a provided schema. Schema validation is free — there's no parsing prose into structure, and no fallback path for malformed JSON. For a structured-output product, this single property eliminates an entire category of production failure.

2. **Low observed hallucination rate on structured outputs.** Across the smoke tests we ran on the Cedar Lane scenario, Sonnet 4.6 consistently grounded its observations in the transcript and the job context. The `assumptions_made` field surfaced its inferences honestly rather than smuggling them into `observations`.

3. **Compliance posture matches our gates.** Anthropic offers BAA, US data residency, configurable retention, and explicit "no training on customer data" defaults. Same hard gates that disqualify STT vendors apply here.

4. **Marginal cost is small at our token volume.** Per voice note: ~2.5K input tokens, ~3.8K output tokens. At Sonnet 4.6 pricing this is well under $0.05/note. At fleet scale (200 techs × 30 notes/day × 22 working days/month = 132K notes/month), that's a few thousand dollars — meaningful, but not in the same magnitude as STT cost. A 10× cheaper model would save real money but only matters if quality holds.

### LLM eval criteria (the v2 plan)

When LLM choice gets re-opened — quarterly, or sooner if a major model ships — the eval would score candidates on:

| Dimension | Metric | Why it matters |
|---|---|---|
| **Schema adherence** | % of outputs that pass strict Zod/JSON-Schema validation on first call, without retry | The non-negotiable. A model that fails 5% of calls is producing a 5% silent failure rate in production. |
| **Hallucination rate** | LLM-as-judge: count of specifics in output not present in transcript or job context, divided by total specifics | Direct measure of trustworthiness. |
| **Factual fidelity** | LLM-as-judge: 1-5 score, "did the output stay grounded in the inputs?" | Subjective but the right metric. |
| **Confidence calibration** | For each `confidence: high\|medium\|low` output, what's the actual factual accuracy? | A model claiming "high" confidence at 70% accuracy is worse than one claiming "medium" at 70%. Calibration > raw accuracy. |
| **Guardrail-trigger rate** | How often does the model correctly populate `guardrails_triggered` when warranted? | Tests whether the model respects our safety instructions or treats them as suggestions. |
| **Latency p50 / p95** | Wall-clock time per output | Determines if the UX feels snappy on real cellular field connections. |
| **Cost at fleet scale** | Computed from input + output tokens at vendor pricing × monthly volume | Ten-fold differences exist between models; matters at scale. |
| **Compliance / DX** | BAA, data residency, retention, BYOK, fine-tuning availability | Hard gates, not weighted dimensions. |

### Candidates for v2 LLM eval

Three candidates worth comparing against Sonnet 4.6, with the question each should answer:

- **GPT-4o-mini** (or whatever is the current cost-optimized OpenAI tier). *"Does schema adherence drop materially on our schema, and is the cost saving worth that drop?"* If schema adherence stays > 99% and quality holds, this becomes the production pick on cost grounds alone.
- **Gemini 2.5 Pro**. *"Does the long context window enable a meaningfully better experience when we add multi-job customer history (5+ prior visits) to the prompt?"* Particularly interesting for repeat-callback scenarios like Cedar Lane.
- **An open-weight model (Llama 3.3 70B class) running on a private endpoint.** *"For tenants requiring zero third-party data sharing, is the quality close enough to ship?"* This is a niche but valuable product surface — some enterprise contractors will pay a premium for "no model provider sees our data."

### Disqualification rule for LLM candidates

Same shape as the STT disqualification: any candidate that fails strict schema validation > 2% of the time on a 200-output sample is automatically out, regardless of other dimensions. There is no "good enough" on schema adherence — every failed parse is either a silent error or a UX friction point in production.

### What's NOT in the v1 LLM eval

We did not run a side-by-side LLM bake-off in v1 because:

1. The primary evaluation in v1 is STT, not LLM. A half-baked LLM comparison alongside a rigorous STT comparison would dilute focus on the methodology that has to land first.
2. Fair LLM comparison requires per-model prompt tuning. Our current system prompt is engineered for Sonnet 4.6's tool-call interface; porting it cleanly to GPT-4o-mini's JSON mode or Gemini's structured output requires care.
3. The bottleneck in LLM eval is *scoring*, not *generating* — and LLM-as-judge calibration is its own meta-problem. Doing it properly is a multi-day project.

What we did do: held the LLM constant in the STT eval (correctly), and treated LLM choice as a separately-justified decision with its own criteria documented above. That's the right shape; the bake-off comes later, with discipline.

## 7. Privacy & compliance

Voice notes contain homeowner names, addresses, phone numbers. Customer-facing copy is generated from these. This is not optional to think about.

Hard requirements before any pilot goes live:

- BAA available with the STT vendor (some contractors operate in regulated industries).
- Vendor must not use customer audio to train base models without explicit opt-in. Confirm in writing, not just in marketing copy.
- Configurable retention. Default to 90 days; allow per-tenant override.
- US data residency option for tenants that require it.
- Audio + transcript stored encrypted at rest. PII redaction option for any analytics export.
- A clear "delete this voice note" path that purges audio + transcript + downstream structured output. We must not orphan PII.

Production gate: a tenant on-roof recording **cannot** be sent to a vendor that fails any of the above. The product flag is binary; there is no "almost compliant."

## 8. Re-evaluation cadence

A vendor decision today is not a vendor decision forever. Re-evaluate quarterly, plus a hard re-trigger when:

- A vendor releases a new model (Nova-4, Whisper-3, etc).
- Domain WER drifts upward by more than 1.5 percentage points on the production traffic sample.
- A new disqualifying compliance issue emerges (e.g., a regulator finding).
- Median latency drifts up by more than 30%.

Production traffic sample: a privacy-reviewed sliver (1%) of pilot voice notes, with PII redacted, used as a continuous regression set. Without this, we are flying blind.

## 9. Pilot results — 10 clips, real run

Eval was run on May 3, 2026 across 10 clips covering all 5 categories. Provider candidates:

- **Deepgram Nova-3** — REST `/v1/listen` with `keyterm` boosting on 17 roofing-domain terms. Smart-format, punctuation, English language hint.
- **OpenAI Whisper-1** — REST `/v1/audio/transcriptions`, `verbose_json`, English language hint. No domain vocabulary boosting available.

Full machine-readable results: [`eval/results/results.json`](https://github.com/Manikandan246/Zuper_Assignment/blob/main/eval/results/results.json). Human-readable table: [`eval/results/results.md`](https://github.com/Manikandan246/Zuper_Assignment/blob/main/eval/results/results.md).

### Aggregate

| Provider | Mean WER | Mean domain-term recall | Mean latency | Total cost (10 clips) | Projected $/mo at fleet (200 techs · 30/day · 45s) |
|---|---:|---:|---:|---:|---:|
| **Deepgram Nova-3** | **7.8%** | **93%** | 5762 ms | $0.0214 | ~$425/mo |
| OpenAI Whisper-1 | 9.5% | 89% | 4422 ms | $0.0299 | ~$594/mo |

### By category

| Category | Deepgram WER · term recall | Whisper WER · term recall |
|---|---|---|
| Clean baseline | **4.4%** · 86% | 7.1% · **91%** |
| Domain-vocab dense | 13.9% · 86% | **12.8%** · 86% |
| Field noise | **6.0%** · 100% | 9.6% · 100% |
| Accent (Indian English) | **4.8%** · **100%** | 6.5% · 50% |
| Partial / interrupted | **0.0%** · 100% | 1.5% · 100% |
| Names / numbers | 18.2% · 83% | 18.2% · 83% |

### Disqualification check

Both providers cleared the v1 disqualifying thresholds — barely.

| Threshold | Deepgram | Whisper | Verdict |
|---|---|---|---|
| WER ≤ 12% | 7.8% ✓ | 9.5% ✓ | both pass |
| Domain recall ≥ 85% | 93% ✓ | 89% ✓ | both pass |
| Latency p50 ≤ 4 s | 3.6 s ✓ | 4.0 s (borderline) | both pass |
| Latency p95 ≤ 8 s | 12.9 s ✗ | 9.3 s ✗ | **both fail** — see below |

**Finding: both providers fail the p95 latency threshold.** This was not an expected outcome before the eval ran. Two interpretations:

1. The threshold (8 s) was set without empirical grounding and may be too tight for batch-mode REST. The production target of < 4 s p50 is fine; the p95 < 8 s target should be relaxed to < 10 s for REST mode and re-tightened for streaming mode in v2.
2. Both providers have outlier clips at 10–13 s for reasons that have not yet been investigated (cold starts, clip size, regional routing). v2 needs a 100-clip run to characterize the latency tail properly.

For v1, this is treated as a methodology lesson — a threshold to revise before the next run, not grounds to disqualify either candidate.

### What I predicted vs what actually happened

This is the part most candidates skip. Calibration check on my pre-run hypotheses:

| Prediction | Outcome | Honest reflection |
|---|---|---|
| Deepgram wins domain-term recall | ✅ confirmed (93 vs 89) | Keyterm boosting is real and worth the API friction. |
| Whisper wins on partial / interrupted speech | ❌ refuted | Deepgram hit 0% WER on the partial clip. Whisper's "trained on conversational disfluency" reputation didn't show up here. |
| Whisper competitive on Indian English accent | ❌ refuted | Whisper's domain-term recall on the accent clip dropped to **50%** — Deepgram held 100%. The single largest gap in the entire eval. |
| Deepgram wins on latency | ❌ refuted | Whisper was ~1.3 s faster on the mean. Deepgram had two outliers at 10+ s that pulled its mean up. |
| Whisper cheaper per-minute | ❌ refuted | Deepgram is actually the cheaper of the two at current pricing ($0.0043 vs $0.006/min). My prior knowledge was stale. |

**1 of 5 predictions correct.** A useful humility data point. The methodology held up; the priors on relative vendor performance did not. The thing that justifies the methodology is precisely that it caught the wrong priors before they shaped a vendor decision.

### Production recommendation

**Deepgram Nova-3 as primary STT.** Reasoning, mapped to the weighted decision rubric in section 11:

| Dimension | Weight | Winner | Why |
|---|---:|---|---|
| Domain-term recall | 35% | Deepgram | 93% vs 89%, and the per-category win on accent (100% vs 50%) is the single biggest signal in the eval |
| Overall WER | 15% | Deepgram | 7.8% vs 9.5% |
| Latency p50 | 15% | Deepgram | 3.6 s vs 4.0 s |
| Latency p95 | 10% | Whisper | 9.3 s vs 12.9 s — Whisper has the better tail |
| Fleet cost | 15% | Deepgram | ~$425/mo vs ~$594/mo at fleet projection |
| Compliance / DX | 10% | Tie | Both have BAA, configurable retention, no-train defaults |

Deepgram wins 4 of 6 dimensions including the highest-weighted (domain recall). Whisper wins on tail latency.

**The accent finding is the clincher.** Whisper losing half its domain-term recall on Indian English is a product-killing failure mode for a US roofing workforce that includes many non-native English speakers. Even if Whisper had won on every other dimension, that single category result would push me toward Deepgram for v1.

### What this small eval does NOT establish

The limits of this dataset are explicit:

- **N = 10 clips is small.** The aggregate numbers are directionally useful but the per-category numbers (especially partial = 1 clip, accent = 1 clip) are point estimates with wide confidence intervals.
- **Single speaker (me).** A real eval needs voice diversity — gender, age, regional US accents.
- **Controlled environment.** No clips were actually recorded on a roof in wind. The "field noise" category was simulated/intentional.
- **Names/numbers (clip 7) was the worst category for both.** 18.2% WER each. This is a real production concern — addresses, dates, names matter for a service product. v2 needs a per-tenant custom-vocabulary feature, not just a global keyterm list.

### What changes in v2 before the production decision is final

1. Run a 50-clip corpus with 5+ speakers, including real on-roof audio from pilot customers.
2. Add streaming mode comparison — REST is a baseline; streaming UX is what we'd actually ship.
3. Add custom-vocabulary support for proper names and addresses (Deepgram's `keyterms` extends to general terms; Whisper has no equivalent — that gap will widen).
4. Compute p95 from a 100-clip run, not a 10-clip run; the current p95 numbers are noisy.
5. Run the downstream LLM-as-judge eval automatically on every output, not just hand-spot-checked.
6. Add AssemblyAI Universal-2 as a third candidate.

## 10. What this eval does **not** cover (and what should come next)

- **Real on-roof recordings.** Clips were recorded in a controlled environment with synthesized noise. The next step is collecting 50+ minutes of real on-roof technician audio from pilot accounts (with consent) and re-running the eval against it.
- **Streaming mode.** This eval is REST/batch. Streaming has a different latency profile (first-token vs. final) and different reliability characteristics (re-connections, partials).
- **Multi-language.** Spanish-speaking crews are a real and important segment we have not measured.
- **Long-tail vocabulary growth.** The keyterm list is currently ~17 terms. Production should track which terms a given pilot customer uses and grow the list per-tenant.
- **AssemblyAI / Speechmatics.** Worth adding as candidates in v2; both have strong claims around domain customization.
- **Adversarial audio.** What does the model do with very-low-volume input, or two technicians talking simultaneously, or near-identical accent dialogue? Edge cases that don't matter at pilot scale will matter at fleet scale.

## 11. Decision recommendation framework

Once the pilot eval is run with real numbers, the decision is structured as:

1. Apply the disqualifying thresholds from section 3. Eliminate any candidate that fails any.
2. Among survivors, score on a weighted rubric:
   - Domain-term recall (35%)
   - Overall WER (15%)
   - Latency p50 (15%)
   - Latency p95 (10%)
   - Projected fleet cost (15%)
   - Compliance/DX maturity (10%)
3. The highest-weighted-score survivor wins, with a written rationale stored in the eval results.
4. The losing candidate is kept warm via a quarterly micro-eval, so we can switch in <1 month if conditions change.

This framework forces a defensible and auditable decision — one that can be walked through end to end without hand-waving when the question comes up later.
