"use client";

import { useEffect, useRef, useState } from "react";
import type { DiagnosticOutputType } from "@/lib/ai/output-schema";

type WordConfidence = { word: string; start: number; end: number; confidence: number };

type TranscribeResult = {
  transcript: string;
  wordConfidences: WordConfidence[];
  sttProvider: string;
  sttModel: string;
  latencyMs: number;
  audioSizeBytes: number;
};

type DiagnoseResult = {
  diagnostic: DiagnosticOutputType;
  llmProvider: string;
  llmModel: string;
  latencyMs: number;
};

type Phase = "idle" | "recording" | "transcribing" | "transcribed" | "diagnosing" | "review" | "saving" | "saved";

const REASONING_STAGES = [
  "Extracting observations from voice note…",
  "Forming hypotheses with counter-evidence…",
  "Calibrating confidence on each hypothesis…",
  "Drafting safe customer-facing summary…",
  "Running guardrails for high-cost recommendations…",
];

export function CopilotClient({ jobId }: { jobId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const [durationSec, setDurationSec] = useState<number>(0);
  const tickRef = useRef<number | null>(null);

  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcribe, setTranscribe] = useState<TranscribeResult | null>(null);
  const [editedTranscript, setEditedTranscript] = useState<string>("");
  const [diagnose, setDiagnose] = useState<DiagnoseResult | null>(null);
  const [reviewed, setReviewed] = useState<DiagnosticOutputType | null>(null);
  const [savedInfo, setSavedInfo] = useState<{ version: number; savedAt: string } | null>(null);
  const [reasoningStage, setReasoningStage] = useState<number>(0);
  const [customerConfirmed, setCustomerConfirmed] = useState<boolean>(false);

  useEffect(() => () => { stopTick(); }, []);

  // Sequence the loading state during the LLM call.
  useEffect(() => {
    if (phase !== "diagnosing") {
      setReasoningStage(0);
      return;
    }
    setReasoningStage(0);
    const id = window.setInterval(() => {
      setReasoningStage((s) => Math.min(s + 1, REASONING_STAGES.length - 1));
    }, 14000);
    return () => clearInterval(id);
  }, [phase]);

  function startTick() {
    recordingStartRef.current = Date.now();
    tickRef.current = window.setInterval(() => {
      setDurationSec(Math.floor((Date.now() - recordingStartRef.current) / 1000));
    }, 250) as unknown as number;
  }
  function stopTick() {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setAudioBlob(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setDurationSec(0);
      startTick();
      setPhase("recording");
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (err.name === "NotAllowedError") {
        setError("Microphone permission was denied. On iOS Safari and Chrome, allow microphone access in site settings and reload.");
      } else if (err.name === "NotFoundError") {
        setError("No microphone was found on this device.");
      } else {
        setError(err.message ?? "Failed to start recording.");
      }
      setPhase("idle");
    }
  }

  function stopRecording() {
    stopTick();
    mediaRecorderRef.current?.stop();
    setPhase("transcribing");
  }

  useEffect(() => {
    if (phase !== "transcribing" || !audioBlob) return;
    void runTranscribe(audioBlob);
  }, [phase, audioBlob]);

  async function runTranscribe(blob: Blob) {
    try {
      const fd = new FormData();
      fd.append("audio", blob, "voice-note.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `transcribe failed (${res.status})`);
      }
      const data = (await res.json()) as TranscribeResult;
      setTranscribe(data);
      setEditedTranscript(data.transcript);
      setPhase("transcribed");
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message);
      setPhase("idle");
    }
  }

  async function runDiagnose() {
    setPhase("diagnosing");
    setError(null);
    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, transcript: editedTranscript }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `diagnose failed (${res.status})`);
      }
      const data = (await res.json()) as DiagnoseResult;
      setDiagnose(data);
      setReviewed(structuredClone(data.diagnostic));
      setCustomerConfirmed(false);
      setPhase("review");
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message);
      setPhase("transcribed");
    }
  }

  async function runSave() {
    if (!reviewed || !diagnose || !transcribe) return;
    setPhase("saving");
    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          transcript: editedTranscript,
          wordConfidences: transcribe.wordConfidences,
          sttProvider: transcribe.sttProvider,
          sttModel: transcribe.sttModel,
          sttLatencyMs: transcribe.latencyMs,
          audioSizeBytes: transcribe.audioSizeBytes,
          durationSec,
          rawDiagnostic: diagnose.diagnostic,
          reviewedDiagnostic: reviewed,
          llmProvider: diagnose.llmProvider,
          llmModel: diagnose.llmModel,
          llmLatencyMs: diagnose.latencyMs,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `save failed (${res.status})`);
      }
      const data = (await res.json()) as { version: number; savedAt: string };
      setSavedInfo(data);
      setPhase("saved");
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message);
      setPhase("review");
    }
  }

  function reset() {
    setError(null);
    setAudioBlob(null);
    setTranscribe(null);
    setEditedTranscript("");
    setDiagnose(null);
    setReviewed(null);
    setSavedInfo(null);
    setDurationSec(0);
    setCustomerConfirmed(false);
    setPhase("idle");
  }

  return (
    <section className="space-y-6">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-900">
          {error}
        </div>
      )}

      {/* Hero recording surface */}
      <RecordingSurface
        phase={phase}
        durationSec={durationSec}
        reasoningStage={reasoningStage}
        onStart={startRecording}
        onStop={stopRecording}
        onReset={reset}
      />

      {transcribe && phase !== "idle" && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Transcript</h2>
            <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
              {transcribe.sttProvider} · {transcribe.sttModel} · {transcribe.latencyMs}ms
            </span>
          </div>

          <div className="rounded-lg bg-slate-50 px-4 py-3 sm:px-5 sm:py-4">
            <ConfidenceShadedTranscript words={transcribe.wordConfidences} fallback={transcribe.transcript} />
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-700 underline-offset-4 hover:underline">Edit transcript before AI analysis</summary>
            <textarea
              className="mt-3 w-full rounded-lg border border-slate-300 px-4 py-3 text-base leading-relaxed sm:text-sm"
              rows={5}
              value={editedTranscript}
              onChange={(e) => setEditedTranscript(e.target.value)}
              disabled={phase === "diagnosing"}
            />
          </details>

          {(phase === "transcribed" || phase === "diagnosing") && (
            <button
              type="button"
              onClick={runDiagnose}
              disabled={!editedTranscript.trim() || phase === "diagnosing"}
              className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-slate-900 px-6 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:text-sm"
            >
              {phase === "diagnosing" ? (
                <>
                  <Spinner />
                  <span>Analyzing…</span>
                </>
              ) : (
                <>
                  <SparkleIcon />
                  <span>Get AI Guidance</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {reviewed && (phase === "review" || phase === "saving" || phase === "saved") && diagnose && (
        <ReviewPanel
          reviewed={reviewed}
          setReviewed={setReviewed}
          diagnose={diagnose}
          phase={phase}
          savedInfo={savedInfo}
          customerConfirmed={customerConfirmed}
          setCustomerConfirmed={setCustomerConfirmed}
          onSave={runSave}
          onReset={reset}
        />
      )}
    </section>
  );
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  for (const c of candidates) if (MediaRecorder.isTypeSupported(c)) return c;
  return undefined;
}

/* ------------------------------- Hero recording ------------------------------- */

function RecordingSurface({
  phase, durationSec, reasoningStage, onStart, onStop, onReset,
}: {
  phase: Phase;
  durationSec: number;
  reasoningStage: number;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
}) {
  const showHero = phase === "idle" || phase === "recording";
  const showTranscribing = phase === "transcribing";
  const showDiagnosing = phase === "diagnosing";

  if (showHero) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-6 py-8 shadow-sm sm:px-8 sm:py-10">
        <div className="flex flex-col items-center text-center">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Step 1 — Voice Note
          </p>
          <h2 className="mb-6 text-lg font-semibold text-slate-900 sm:text-xl">
            {phase === "recording"
              ? "Recording — speak naturally, then stop"
              : "Capture what you see on the roof"}
          </h2>

          <RecordButton phase={phase} onStart={onStart} onStop={onStop} />

          {phase === "recording" && (
            <p className="mt-6 font-mono text-3xl font-semibold tabular-nums text-slate-900 sm:text-4xl">
              {fmtDuration(durationSec)}
            </p>
          )}

          {phase === "idle" && (
            <p className="mt-6 max-w-md text-sm leading-relaxed text-slate-600">
              Tap to start. Speak naturally — gloves are fine, wind is fine. Tap again to stop. Deepgram Nova-3 transcribes with roofing-domain vocabulary.
            </p>
          )}

          {phase === "recording" && (
            <p className="mt-3 text-xs text-slate-500">Tap the button again to stop</p>
          )}
        </div>
      </div>
    );
  }

  if (showTranscribing) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8 sm:py-10">
        <div className="flex flex-col items-center text-center">
          <Spinner large />
          <p className="mt-5 text-sm font-medium text-slate-700">Transcribing via Deepgram Nova-3…</p>
          <p className="mt-1 text-xs text-slate-500">Roofing keyterms boosted: ridge cap, vent boot, drip edge, valley flashing…</p>
        </div>
      </div>
    );
  }

  if (showDiagnosing) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8 sm:py-10">
        <div className="mx-auto max-w-md">
          <div className="mb-5 flex items-center justify-center gap-3">
            <SparkleIcon className="h-5 w-5 text-indigo-500" />
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Claude Sonnet 4.6 · reasoning</p>
          </div>
          <ul className="space-y-3">
            {REASONING_STAGES.map((label, i) => {
              const state = i < reasoningStage ? "done" : i === reasoningStage ? "active" : "pending";
              return (
                <li key={i} className="flex items-center gap-3">
                  <StageIcon state={state} />
                  <span className={
                    state === "done" ? "text-sm text-slate-500 line-through decoration-slate-300"
                    : state === "active" ? "text-sm font-medium text-slate-900"
                    : "text-sm text-slate-400"
                  }>
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-6 text-center text-xs text-slate-400">Typically 60–90 seconds. Output is reviewed by you before save.</p>
        </div>
      </div>
    );
  }

  // After flow has progressed past initial capture, just a compact summary + reset.
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckIcon />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900">Voice note captured</p>
          <p className="text-xs text-slate-500">{fmtDuration(durationSec)} · transcribed</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Discard & re-record
      </button>
    </div>
  );
}

function RecordButton({ phase, onStart, onStop }: { phase: Phase; onStart: () => void; onStop: () => void }) {
  const recording = phase === "recording";
  return (
    <button
      type="button"
      onClick={recording ? onStop : onStart}
      aria-label={recording ? "Stop recording" : "Start recording"}
      className="group relative inline-flex h-28 w-28 items-center justify-center rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-300 sm:h-32 sm:w-32"
    >
      {recording && (
        <>
          <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/30" />
          <span className="absolute inset-2 animate-pulse rounded-full bg-rose-500/20" />
        </>
      )}
      <span
        className={
          recording
            ? "relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl bg-rose-600 shadow-lg sm:h-24 sm:w-24"
            : "relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-rose-600 shadow-lg transition group-hover:bg-rose-700 group-active:scale-95 sm:h-24 sm:w-24"
        }
      >
        {recording ? (
          <span className="block h-7 w-7 rounded-md bg-white sm:h-8 sm:w-8" />
        ) : (
          <MicIcon className="h-9 w-9 text-white sm:h-10 sm:w-10" />
        )}
      </span>
    </button>
  );
}

/* ------------------------------ Review surface ------------------------------- */

function ReviewPanel({
  reviewed, setReviewed, diagnose, phase, savedInfo,
  customerConfirmed, setCustomerConfirmed,
  onSave, onReset,
}: {
  reviewed: DiagnosticOutputType;
  setReviewed: (v: DiagnosticOutputType) => void;
  diagnose: DiagnoseResult;
  phase: Phase;
  savedInfo: { version: number; savedAt: string } | null;
  customerConfirmed: boolean;
  setCustomerConfirmed: (v: boolean) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  function update<K extends keyof DiagnosticOutputType>(key: K, value: DiagnosticOutputType[K]) {
    setReviewed({ ...reviewed, [key]: value });
  }

  const editingDisabled = phase === "saving" || phase === "saved";
  const canSave = customerConfirmed && !editingDisabled;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
              <SparkleIcon />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">AI-generated · review every field before saving</p>
              <p className="text-xs text-slate-500">{diagnose.llmModel} · {diagnose.latencyMs}ms · operator becomes supervisor</p>
            </div>
          </div>
        </div>
      </div>

      <Card title="Observations (extracted from voice note)">
        <ListEditor
          label="Visible damage"
          values={reviewed.observations.visible_damage}
          onChange={(v) => update("observations", { ...reviewed.observations, visible_damage: v })}
          disabled={editingDisabled}
        />
        <ListEditor
          label="Sounds"
          values={reviewed.observations.sounds}
          onChange={(v) => update("observations", { ...reviewed.observations, sounds: v })}
          disabled={editingDisabled}
        />
        <ListEditor
          label="Measurements"
          values={reviewed.observations.measurements}
          onChange={(v) => update("observations", { ...reviewed.observations, measurements: v })}
          disabled={editingDisabled}
        />
        <ListEditor
          label="Homeowner statements"
          values={reviewed.observations.homeowner_statements}
          onChange={(v) => update("observations", { ...reviewed.observations, homeowner_statements: v })}
          disabled={editingDisabled}
        />
      </Card>

      <Card title="Likely issues">
        <div className="space-y-3">
          {reviewed.diagnostic.likely_issues.map((h, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <input
                  className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-base font-medium text-slate-900 sm:text-sm"
                  value={h.hypothesis}
                  onChange={(e) => {
                    const next = [...reviewed.diagnostic.likely_issues];
                    next[i] = { ...next[i], hypothesis: e.target.value };
                    update("diagnostic", { likely_issues: next });
                  }}
                  disabled={editingDisabled}
                />
                <ConfidenceChip level={h.confidence} />
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ListEditor
                  label="Evidence"
                  values={h.evidence}
                  onChange={(v) => {
                    const next = [...reviewed.diagnostic.likely_issues];
                    next[i] = { ...next[i], evidence: v };
                    update("diagnostic", { likely_issues: next });
                  }}
                  disabled={editingDisabled}
                />
                <ListEditor
                  label="Counter-evidence"
                  values={h.counter_evidence}
                  onChange={(v) => {
                    const next = [...reviewed.diagnostic.likely_issues];
                    next[i] = { ...next[i], counter_evidence: v };
                    update("diagnostic", { likely_issues: next });
                  }}
                  disabled={editingDisabled}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Recommended next steps">
        <ol className="space-y-3">
          {reviewed.recommended_next_steps.map((s, i) => (
            <li key={i} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <input
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-base font-medium text-slate-900 sm:text-sm"
                  value={s.step}
                  onChange={(e) => {
                    const next = [...reviewed.recommended_next_steps];
                    next[i] = { ...next[i], step: e.target.value };
                    update("recommended_next_steps", next);
                  }}
                  disabled={editingDisabled}
                />
              </div>
              <div className="mt-2 ml-10 text-sm leading-relaxed text-slate-600">{s.rationale}</div>
              <div className="mt-3 ml-10 flex flex-wrap gap-2">
                {s.requires_homeowner_consent && <Badge tone="amber">🤝 Homeowner consent</Badge>}
                {s.safety_note && <Badge tone="rose">⚠ Safety: {s.safety_note}</Badge>}
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Parts &amp; tools to consider">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {reviewed.parts_and_tools.map((p, i) => (
            <li key={i} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">{p.item}</div>
                <div className="mt-0.5 text-xs leading-relaxed text-slate-600">{p.reason}</div>
              </div>
              <Badge tone={p.typically_in_truck ? "emerald" : "amber"}>
                {p.typically_in_truck ? "In truck" : "Supply run"}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>

      {/* Customer-facing copy — gated, quote-style, distinct */}
      <section className="overflow-hidden rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-100/60 px-5 py-3 sm:px-6">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-amber-900">
            Customer-facing update · review required
          </h2>
          <span className="rounded-full bg-amber-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
            Hard gate
          </span>
        </header>
        <div className="px-5 py-5 sm:px-7 sm:py-6">
          <blockquote className="border-l-4 border-amber-500 pl-4 italic">
            <textarea
              className="w-full resize-none rounded-md border border-amber-200 bg-white px-3 py-3 text-base leading-relaxed text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 sm:text-[15px]"
              rows={5}
              value={reviewed.customer_facing_update.text}
              onChange={(e) => update("customer_facing_update", { ...reviewed.customer_facing_update, text: e.target.value })}
              disabled={editingDisabled}
            />
          </blockquote>

          {reviewed.customer_facing_update.warnings.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-white/70 px-4 py-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-900">Do not commit verbally to:</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-amber-950">
                {reviewed.customer_facing_update.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          <label className="mt-5 flex cursor-pointer select-none items-start gap-3 rounded-lg border-2 border-amber-400 bg-white p-4 transition hover:bg-amber-50">
            <input
              type="checkbox"
              checked={customerConfirmed}
              onChange={(e) => setCustomerConfirmed(e.target.checked)}
              disabled={editingDisabled}
              className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-amber-400 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm font-medium leading-snug text-slate-900">
              I have read this in full and confirm I will not commit verbally to anything not stated above. The customer-facing copy is final.
            </span>
          </label>
        </div>
      </section>

      <Card title="Assumptions made by AI">
        <BulletList items={reviewed.assumptions_made} />
      </Card>

      <Card title="Needs human confirmation">
        <BulletList items={reviewed.needs_human_confirmation} tone="amber" />
      </Card>

      <Card title="Guardrails triggered">
        {reviewed.guardrails_triggered.length === 0
          ? <p className="text-sm text-slate-500">None triggered on this output.</p>
          : <BulletList items={reviewed.guardrails_triggered} tone="slate" />}
      </Card>

      {phase === "saved" && savedInfo ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white">
              <CheckIcon />
            </span>
            <div>
              <p className="font-semibold">Saved as version {savedInfo.version}</p>
              <p className="text-xs text-emerald-700/80">{new Date(savedInfo.savedAt).toLocaleString()}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-10 items-center rounded-lg border border-emerald-300 bg-white px-4 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
          >
            New voice note
          </button>
        </div>
      ) : (
        <div className="sticky bottom-3 z-10 flex flex-col-reverse items-stretch gap-2 rounded-xl border border-slate-200 bg-white/90 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-snug text-slate-500 sm:text-sm">
            {customerConfirmed
              ? "All gates cleared. You can save."
              : "Save is gated until you confirm the customer-facing copy."}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              disabled={editingDisabled}
              className="inline-flex h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {phase === "saving" ? <Spinner /> : <CheckIcon />}
              {phase === "saving" ? "Saving…" : "Approve & save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Atoms --------------------------------- */

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ConfidenceShadedTranscript({ words, fallback }: { words: WordConfidence[]; fallback: string }) {
  if (!words || words.length === 0) {
    return <p className="text-base leading-relaxed text-slate-800 sm:text-[15px]">{fallback}</p>;
  }
  return (
    <p className="text-base leading-relaxed text-slate-800 sm:text-[15px]">
      {words.map((w, i) => {
        const opacity = Math.max(0.5, Math.min(1, w.confidence));
        const flag = w.confidence < 0.6;
        return (
          <span
            key={i}
            title={`confidence: ${(w.confidence * 100).toFixed(0)}%`}
            className={flag ? "rounded bg-amber-100 px-0.5" : ""}
            style={{ opacity }}
          >
            {w.word}{i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </p>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

function ListEditor({ label, values, onChange, disabled }: { label: string; values: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <ul className="space-y-1.5">
        {values.map((v, i) => (
          <li key={i} className="flex gap-2">
            <input
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm"
              value={v}
              onChange={(e) => {
                const next = [...values];
                next[i] = e.target.value;
                onChange(next);
              }}
              disabled={disabled}
            />
            <button
              type="button"
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              disabled={disabled}
              className="rounded-md border border-slate-300 px-3 text-slate-500 hover:bg-slate-50"
              aria-label="Remove"
            >×</button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onChange([...values, ""])}
        disabled={disabled}
        className="mt-2 text-xs font-medium text-slate-600 underline-offset-2 hover:underline"
      >+ Add</button>
    </div>
  );
}

function BulletList({ items, tone = "slate" }: { items: string[]; tone?: "slate" | "amber" }) {
  if (items.length === 0) return <p className="text-sm text-slate-500">None.</p>;
  const cls = tone === "amber" ? "text-amber-900" : "text-slate-700";
  return (
    <ul className={`list-disc space-y-1.5 pl-5 text-sm leading-relaxed ${cls}`}>
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}

function ConfidenceChip({ level }: { level: "high" | "medium" | "low" }) {
  const map = {
    high: { pill: "bg-emerald-100 text-emerald-900 border-emerald-300", bars: 3, color: "bg-emerald-600" },
    medium: { pill: "bg-amber-100 text-amber-900 border-amber-300", bars: 2, color: "bg-amber-500" },
    low: { pill: "bg-rose-100 text-rose-900 border-rose-300", bars: 1, color: "bg-rose-600" },
  };
  const m = map[level];
  return (
    <span className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${m.pill}`}>
      <span aria-hidden="true" className="flex h-3 items-end gap-[2px]">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`block w-[3px] rounded-sm ${n <= m.bars ? m.color : "bg-slate-300"}`}
            style={{ height: `${n * 4 + 2}px` }}
          />
        ))}
      </span>
      <span>Confidence: {level}</span>
    </span>
  );
}

function Badge({ tone, children }: { tone: "amber" | "rose" | "emerald" | "slate"; children: React.ReactNode }) {
  const map = {
    amber: "bg-amber-100 text-amber-900 border-amber-300",
    rose: "bg-rose-100 text-rose-900 border-rose-300",
    emerald: "bg-emerald-100 text-emerald-900 border-emerald-300",
    slate: "bg-slate-100 text-slate-800 border-slate-300",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${map[tone]}`}>{children}</span>;
}

/* ---------------------------- icons & spinners ---------------------------- */

function MicIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" fill="currentColor" />
      <path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V20H8.5a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2H13v-2.08A7 7 0 0 0 19 11Z" fill="currentColor" />
    </svg>
  );
}

function SparkleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2zM19 14l.9 2.6L22 17.5l-2.1.9L19 21l-.9-2.6L16 17.5l2.1-.9L19 14zM5 14l.9 2.6L8 17.5l-2.1.9L5 21l-.9-2.6L2 17.5l2.1-.9L5 14z" fill="currentColor" />
    </svg>
  );
}

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Spinner({ large = false }: { large?: boolean }) {
  const size = large ? "h-8 w-8" : "h-4 w-4";
  return (
    <svg className={`animate-spin ${size} text-current`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function StageIcon({ state }: { state: "done" | "active" | "pending" }) {
  if (state === "done") {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
        <CheckIcon className="h-3 w-3" />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
        <Spinner />
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-slate-200 bg-white">
      <span className="block h-1.5 w-1.5 rounded-full bg-slate-300" />
    </span>
  );
}
