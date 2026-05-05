## Overview

A voice-enabled diagnostic copilot for roofing technicians on recurring service callbacks. The technician records a voice note on the rooftop. The system returns a structured diagnostic — atomic observations, ranked hypotheses with counter-evidence, ordered next steps with consent and safety notes, a parts list, a customer-safe written summary, and explicit assumptions — for the technician to review, edit, and save as a versioned record.

Designed against the worldview that the operator becomes the supervisor: AI does the doing, humans set direction, handle exceptions, and own outcomes.

## Headline result from the AI evaluation

| Provider | Mean WER | Domain-term recall | Mean latency | Fleet $/mo |
|---|---:|---:|---:|---:|
| **Deepgram Nova-3** | **7.8%** | **93%** | 5762 ms | ~$425 |
| OpenAI Whisper-1 | 9.5% | 89% | 4422 ms | ~$594 |

**Production recommendation: Deepgram Nova-3.** Wins 4 of 6 weighted dimensions. The deciding sub-result was an Indian English clip on which Whisper&apos;s domain-term recall dropped to 50% while Deepgram held 100% — a category result that decides the vendor for any US roofing workforce that includes non-native English speakers.

The full eval methodology, per-clip results, calibration check, and decision rubric are at [`/eval`](https://zuper-copilot-two.vercel.app/eval) and in the [eval plan](https://zuper-copilot-two.vercel.app/eval-plan).

## Stack

- Next.js 16 + React 19, TypeScript, Tailwind 4 (mobile-first responsive)
- Postgres on Render (Drizzle ORM; tables prefixed `zuper_`; versioned diagnostic records)
- Deepgram Nova-3 (REST) for STT, with roofing keyterm boosting and per-word confidence
- Anthropic Claude Sonnet 4.6 with tool-call mode (forces schema-valid JSON; eliminates parse-failure as a production failure mode)
- Hosted on Vercel (production deployment, serverless API routes, function timeouts up to 120s for the LLM call)

## Scope (v1)

- Single screen, three-step flow: job context · voice capture + transcript · structured diagnostic + review + save
- Per-word confidence shading on the transcript so low-confidence words are visible before AI reasoning fires
- Confidence-calibrated hypotheses with counter-evidence on every claim
- Customer-facing copy hard-gated by an explicit reviewer checkbox; save is disabled until the technician confirms
- Versioned save: every output is stored alongside the raw and reviewed JSON, the voice note, and STT/LLM provenance
- Mobile-responsive web

## Out of scope (deferred)

- Authentication and multi-user
- Streaming partial transcripts (REST is not the bottleneck on a 30–60 s voice note; LLM time dominates)
- Wake-word activation
- Multi-language transcription (Spanish-speaking crews are a real and important segment; deserves its own evaluation, not a cell in a matrix)
- Photo capture and on-roof image annotation (covered by the existing AI Voice Notes & Walkthrough surface)
- Dispatcher and manager views
- Automatic task creation in the FSM from `recommended_next_steps`

## Known limitations

- The pilot eval is N=10 self-recorded clips, single speaker. Aggregate numbers are directionally useful; per-category numbers (especially partial=1 clip, accent=1 clip) are point estimates with wide intervals.
- Field-noise clips are simulated, not recorded on an actual rooftop in wind. Real on-roof audio is required before a production vendor commitment.
- Both providers failed the v1 p95 latency disqualification threshold of 8 s on this 10-clip run. The threshold appears to be too tight for batch-mode REST and would be re-anchored from a 100-clip run before becoming a hard production gate.
- Names and numbers were the worst category for both providers (18.2% WER each). Production needs per-tenant custom vocabulary, not a single global keyterm list.
- The downstream LLM-as-judge eval is designed as part of the methodology but not automated in the runner. It is explicit v2 work.
- Streaming UX, offline capture, and the AR wearable capture path are described, not built.

## Confidence anchor

What this build is confident about:

- The structured output schema as the contract between voice capture and downstream artifacts (job summary, customer portal, automated task creation).
- The operator-supervisor framing of guardrails as data fields — `counter_evidence`, `must_be_reviewed`, `guardrails_triggered`, `assumptions_made` — rather than as prose instructions in the prompt.
- The domain-term recall metric as the right primary measure of STT quality for this product, ahead of overall WER.
- Disqualifying thresholds applied before any weighted average, so non-negotiables (compliance, latency floor) cannot be optimized around.
- Holding the LLM constant during the STT eval so STT effects could be isolated.
- A hard customer-copy gate enforced in the UI (reviewer checkbox), not just instructed in the prompt.

## Roadmap

In execution order:

1. Streaming partial transcripts for sub-second feedback during longer voice notes.
2. Confidence calibration loop — capture every technician edit and use it to ground the prompt over time, then to fine-tune.
3. Automatic task creation in the FSM from `recommended_next_steps`, gated by technician approval.
4. Spanish-language pipeline for crews and for English-speaking homeowners (Spanish in, English customer-safe summary out).
5. AR wearable capture path — the schema is hardware-agnostic; only the capture surface changes.
6. Multi-turn voice — the system asks targeted follow-ups when context is insufficient ("you didn&apos;t mention the attic — should I include it?").
7. Per-tenant custom vocabulary for proper names, addresses, brand names that don&apos;t belong in a global keyterm list.
