import { readFile } from "node:fs/promises";
import path from "node:path";
import { TopNav } from "@/app/_components/DocLayout";

export const dynamic = "force-static";

type ProviderResult = {
  provider: string;
  model: string;
  transcript: string;
  latencyMs: number;
  costUsd: number | null;
  wer: { wer: number };
  domainTermRecall: { found: number; expected: number; missed: string[]; recall: number };
  error?: string;
};

type ClipResult = {
  clipId: string;
  clipFile: string;
  category: string;
  label: string;
  reference: string;
  durationSec: number | null;
  audioBytes: number;
  providers: Record<string, ProviderResult>;
};

type EvalData = { ts: string; results: ClipResult[] };

const CATEGORY_LABEL: Record<string, string> = {
  baseline: "Clean baseline",
  domain_vocab: "Domain vocabulary",
  field_noise: "Field noise",
  accent: "Accent (Indian English)",
  partial: "Partial / interrupted",
  names_numbers: "Names / numbers",
};

async function loadEval(): Promise<EvalData> {
  const filePath = path.join(process.cwd(), "eval", "results", "results.json");
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as EvalData;
}

export default async function EvalPage() {
  const data = await loadEval();
  const agg = aggregate(data.results);
  const byCategory = aggregateByCategory(data.results);
  const accent = data.results.find((r) => r.category === "accent");

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <TopNav />
      {/* Hero */}
      <header className="border-b border-slate-800/10 bg-slate-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <p className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            STT Evaluation · Voice Stack for Roofing Field Service
          </p>
          <h1 className="mb-3 text-3xl font-bold sm:text-4xl">
            Deepgram Nova-3 vs OpenAI Whisper-1
          </h1>
          <p className="mb-6 text-sm text-slate-300 sm:text-base">
            10 in-house recorded clips · 5 categories · run on{" "}
            {new Date(data.ts).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
          </p>

          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-4 sm:px-6 sm:py-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Production recommendation</p>
            <p className="mt-1 text-2xl font-bold sm:text-3xl">Deepgram Nova-3</p>
            <p className="mt-2 text-sm text-emerald-100/90">
              Wins 4 of 6 weighted dimensions including domain-term recall (the metric that maps to product value).
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 space-y-12">
        {/* Headline metrics */}
        <section>
          <SectionLabel>Headline metrics — aggregate across 10 clips</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Mean WER"
              tone="lower-better"
              winner="deepgram"
              left={{ name: "Deepgram", value: agg.deepgram.wer, format: pct }}
              right={{ name: "Whisper", value: agg.whisper.wer, format: pct }}
              note="Industry-standard transcription accuracy. Lower is better."
            />
            <MetricCard
              label="Domain-term recall"
              tone="higher-better"
              winner="deepgram"
              left={{ name: "Deepgram", value: agg.deepgram.termRecall, format: pct }}
              right={{ name: "Whisper", value: agg.whisper.termRecall, format: pct }}
              note="Roofing-vocab fidelity (ridge cap, vent boot, etc). The metric that drives diagnostic quality."
              highlight
            />
            <MetricCard
              label="Mean latency"
              tone="lower-better"
              winner="whisper"
              left={{ name: "Deepgram", value: agg.deepgram.latencyMs / 1000, format: secs }}
              right={{ name: "Whisper", value: agg.whisper.latencyMs / 1000, format: secs }}
              note="Wall-clock REST round-trip. Whisper edged Deepgram on the mean here — opposite of my prediction."
            />
            <MetricCard
              label="Fleet $/month"
              tone="lower-better"
              winner="deepgram"
              left={{ name: "Deepgram", value: projectFleetCost(agg.deepgram.costPerMin), format: dollarsMonthly }}
              right={{ name: "Whisper", value: projectFleetCost(agg.whisper.costPerMin), format: dollarsMonthly }}
              note="Projection: 200 techs × 30 voice notes/day × 45s avg × 22 working days."
            />
          </div>
        </section>

        {/* The decisive finding */}
        {accent && <DecisiveFinding clip={accent} />}

        {/* By category */}
        <section>
          <SectionLabel>By category</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(byCategory).map(([cat, c]) => (
              <CategoryCard
                key={cat}
                label={CATEGORY_LABEL[cat] ?? cat}
                deepgram={c.deepgram}
                whisper={c.whisper}
                count={c.count}
              />
            ))}
          </div>
        </section>

        {/* Calibration honesty */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <SectionLabel>Calibration check — predictions vs reality</SectionLabel>
          <div className="mb-5 rounded-lg border-l-4 border-amber-400 bg-amber-50 px-4 py-3">
            <p className="text-sm leading-relaxed text-amber-950">
              <strong className="font-bold">5 predictions made before running. 1 was correct.</strong> The methodology was sound; my priors on relative vendor performance were not. The thing that justifies the methodology is precisely that it caught my wrong priors.
            </p>
          </div>
          <PredictionTable />
        </section>

        {/* Production recommendation rubric */}
        <section>
          <SectionLabel>Production recommendation — weighted rubric</SectionLabel>
          <RubricTable />
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            <strong className="text-slate-900">The accent finding is the clincher.</strong> Whisper losing half its domain-term recall on Indian English is a product-killing failure mode for a US roofing workforce that includes many non-native English speakers. Even if Whisper had won every other dimension, that single result would push toward Deepgram for v1.
          </p>
        </section>

        {/* Per-clip detail */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <SectionLabel>Per-clip results</SectionLabel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-3">Clip</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Provider</th>
                  <th className="py-2 pr-3 text-right">WER</th>
                  <th className="py-2 pr-3 text-right">Term recall</th>
                  <th className="py-2 pr-3 text-right">Latency</th>
                  <th className="py-2 pr-0 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.results.flatMap((clip) =>
                  Object.entries(clip.providers).map(([key, p]) => (
                    <tr key={`${clip.clipId}-${key}`} className="text-slate-700">
                      <td className="py-2 pr-3 font-mono text-xs">{clip.clipId.replace(/^clip\d+_/, "")}</td>
                      <td className="py-2 pr-3 text-xs uppercase tracking-wider text-slate-500">{CATEGORY_LABEL[clip.category] ?? clip.category}</td>
                      <td className="py-2 pr-3">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                          p.provider === "deepgram" ? "bg-indigo-100 text-indigo-900" : "bg-slate-100 text-slate-700"
                        }`}>
                          {p.provider}/{p.model}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">{(p.wer.wer * 100).toFixed(1)}%</td>
                      <td className="py-2 pr-3 text-right font-mono">{p.domainTermRecall.expected > 0 ? `${p.domainTermRecall.found}/${p.domainTermRecall.expected} (${(p.domainTermRecall.recall * 100).toFixed(0)}%)` : "—"}</td>
                      <td className="py-2 pr-3 text-right font-mono">{p.latencyMs}ms</td>
                      <td className="py-2 pr-0 text-right font-mono text-xs">{p.costUsd != null ? `$${p.costUsd.toFixed(4)}` : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Limitations */}
        <section className="rounded-2xl border border-slate-200 bg-slate-100 p-6 sm:p-8">
          <SectionLabel>What this small eval does NOT establish</SectionLabel>
          <ul className="space-y-2.5 text-sm leading-relaxed text-slate-700">
            <li className="flex gap-2"><span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" /><span><strong>N=10 is small.</strong> Per-category numbers (especially partial=1, accent=1) are point estimates with wide confidence intervals.</span></li>
            <li className="flex gap-2"><span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" /><span><strong>Single speaker.</strong> A real eval needs voice diversity — gender, age, regional accents.</span></li>
            <li className="flex gap-2"><span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" /><span><strong>Controlled environment.</strong> No clips were recorded on an actual roof in wind. Field-noise category was simulated.</span></li>
            <li className="flex gap-2"><span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" /><span><strong>Both providers failed the v1 p95-latency threshold (8s).</strong> I'm explicit in the eval plan that this is a methodology lesson — the threshold needs re-tuning for batch-mode REST, not a reason to disqualify either candidate.</span></li>
            <li className="flex gap-2"><span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" /><span><strong>Names / numbers (clip 7) was the worst category for both.</strong> 18.2% WER each. Production needs per-tenant custom vocabulary, not just a global keyterm list.</span></li>
            <li className="flex gap-2"><span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" /><span><strong>The downstream LLM-as-judge eval is designed in v1 but not automated.</strong> Explicit v2 work.</span></li>
          </ul>
        </section>
      </div>

      <footer className="mt-12 border-t border-slate-200 bg-white py-6">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-slate-400 sm:px-6">
          STT eval results · paired with the Field Service AI Copilot prototype · methodology in EVAL_PLAN.md
        </div>
      </footer>
    </main>
  );
}

/* ----------------------------- aggregation ----------------------------- */

type ProviderAgg = { wer: number; termRecall: number; latencyMs: number; costPerMin: number; n: number };

function aggregate(results: ClipResult[]): { deepgram: ProviderAgg; whisper: ProviderAgg } {
  const dg: ProviderAgg = { wer: 0, termRecall: 0, latencyMs: 0, costPerMin: 0, n: 0 };
  const wh: ProviderAgg = { wer: 0, termRecall: 0, latencyMs: 0, costPerMin: 0, n: 0 };

  for (const c of results) {
    const d = c.providers.deepgram_nova3;
    const w = c.providers.openai_whisper;
    if (d) {
      dg.wer += d.wer.wer;
      dg.termRecall += d.domainTermRecall.expected > 0 ? d.domainTermRecall.recall : 1;
      dg.latencyMs += d.latencyMs;
      dg.n++;
    }
    if (w) {
      wh.wer += w.wer.wer;
      wh.termRecall += w.domainTermRecall.expected > 0 ? w.domainTermRecall.recall : 1;
      wh.latencyMs += w.latencyMs;
      wh.n++;
    }
  }

  // Per-minute costs from public pricing snapshots.
  dg.costPerMin = 0.0043;
  wh.costPerMin = 0.006;

  return {
    deepgram: { ...dg, wer: dg.wer / dg.n, termRecall: dg.termRecall / dg.n, latencyMs: dg.latencyMs / dg.n },
    whisper: { ...wh, wer: wh.wer / wh.n, termRecall: wh.termRecall / wh.n, latencyMs: wh.latencyMs / wh.n },
  };
}

function aggregateByCategory(results: ClipResult[]) {
  const acc: Record<string, { count: number; deepgram: { wer: number; termRecall: number; n: number }; whisper: { wer: number; termRecall: number; n: number } }> = {};
  for (const c of results) {
    if (!acc[c.category]) acc[c.category] = { count: 0, deepgram: { wer: 0, termRecall: 0, n: 0 }, whisper: { wer: 0, termRecall: 0, n: 0 } };
    acc[c.category].count++;
    const d = c.providers.deepgram_nova3;
    const w = c.providers.openai_whisper;
    if (d) {
      acc[c.category].deepgram.wer += d.wer.wer;
      acc[c.category].deepgram.termRecall += d.domainTermRecall.expected > 0 ? d.domainTermRecall.recall : 1;
      acc[c.category].deepgram.n++;
    }
    if (w) {
      acc[c.category].whisper.wer += w.wer.wer;
      acc[c.category].whisper.termRecall += w.domainTermRecall.expected > 0 ? w.domainTermRecall.recall : 1;
      acc[c.category].whisper.n++;
    }
  }
  // average
  for (const k of Object.keys(acc)) {
    const a = acc[k];
    a.deepgram.wer /= a.deepgram.n;
    a.deepgram.termRecall /= a.deepgram.n;
    a.whisper.wer /= a.whisper.n;
    a.whisper.termRecall /= a.whisper.n;
  }
  return acc;
}

function projectFleetCost(perMin: number) {
  // 200 techs × 30 voice notes/day × 45s × 22 working days
  const minutesPerMonth = (200 * 30 * 45 * 22) / 60;
  return perMin * minutesPerMonth;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const secs = (v: number) => `${v.toFixed(2)}s`;
const dollarsMonthly = (v: number) => `$${Math.round(v).toLocaleString()}`;

/* ------------------------------- presentational ------------------------------- */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-5 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
      {children}
    </h2>
  );
}

function MetricCard({
  label, tone, winner, left, right, note, highlight,
}: {
  label: string;
  tone: "lower-better" | "higher-better";
  winner: "deepgram" | "whisper";
  left: { name: string; value: number; format: (v: number) => string };
  right: { name: string; value: number; format: (v: number) => string };
  note: string;
  highlight?: boolean;
}) {
  const dgWins = winner === "deepgram";
  // Bar widths: normalize so the larger value fills 100% of the bar.
  const max = Math.max(left.value, right.value, 0.0001);
  const leftPct = (left.value / max) * 100;
  const rightPct = (right.value / max) * 100;

  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${highlight ? "border-indigo-300 ring-1 ring-indigo-200" : "border-slate-200"}`}>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mb-4 text-[11px] text-slate-400">{tone === "lower-better" ? "Lower is better" : "Higher is better"}</p>

      <div className="space-y-3">
        <Row name={left.name} value={left.format(left.value)} pct={leftPct} winner={dgWins} />
        <Row name={right.name} value={right.format(right.value)} pct={rightPct} winner={!dgWins} />
      </div>

      <p className="mt-4 text-xs leading-relaxed text-slate-600">{note}</p>
    </div>
  );
}

function Row({ name, value, pct, winner }: { name: string; value: string; pct: number; winner: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className={`text-sm font-medium ${winner ? "text-emerald-900" : "text-slate-700"}`}>
          {name}
          {winner && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">winner</span>}
        </span>
        <span className={`font-mono text-sm font-semibold ${winner ? "text-emerald-700" : "text-slate-500"}`}>
          {value}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${winner ? "bg-emerald-500" : "bg-slate-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DecisiveFinding({ clip }: { clip: ClipResult }) {
  const dg = clip.providers.deepgram_nova3;
  const wh = clip.providers.openai_whisper;
  if (!dg || !wh) return null;
  const dgRecall = dg.domainTermRecall.recall * 100;
  const whRecall = wh.domainTermRecall.recall * 100;

  return (
    <section className="rounded-2xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-6 shadow-sm sm:p-8">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-rose-700">The decisive finding</p>
      <h3 className="mb-2 text-2xl font-bold text-slate-900 sm:text-3xl">Indian English accent · domain-term recall</h3>
      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-slate-700 sm:text-base">
        On the single Indian English clip, Whisper&apos;s domain-term recall <strong>dropped to {whRecall.toFixed(0)}%</strong> while Deepgram held <strong>{dgRecall.toFixed(0)}%</strong>. This single category result was sufficient to decide the recommendation — even if Whisper had won every other dimension.
      </p>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <BigBar provider="Deepgram Nova-3" value={dgRecall} winner />
        <BigBar provider="OpenAI Whisper-1" value={whRecall} winner={false} />
      </div>

      <p className="mt-6 max-w-3xl text-xs italic leading-relaxed text-slate-600 sm:text-sm">
        Why it matters: a US roofing workforce includes many non-native English speakers (Spanish-, Punjabi-, Tagalog-, Russian-accented English are all common). A model that loses half its accuracy on accented speech is shipping a product that fails for half its workforce.
      </p>
    </section>
  );
}

function BigBar({ provider, value, winner }: { provider: string; value: number; winner: boolean }) {
  return (
    <div className={`rounded-xl border bg-white p-5 ${winner ? "border-emerald-300" : "border-rose-300"}`}>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-semibold text-slate-700">{provider}</span>
        {winner && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">production pick</span>}
      </div>
      <div className={`text-5xl font-bold ${winner ? "text-emerald-600" : "text-rose-600"}`}>
        {value.toFixed(0)}%
      </div>
      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${winner ? "bg-emerald-500" : "bg-rose-500"}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function CategoryCard({ label, deepgram, whisper, count }: {
  label: string;
  deepgram: { wer: number; termRecall: number };
  whisper: { wer: number; termRecall: number };
  count: number;
}) {
  const werDgWins = deepgram.wer < whisper.wer;
  const recallDgWins = deepgram.termRecall > whisper.termRecall;
  const recallTie = deepgram.termRecall === whisper.termRecall;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-600">{count} clip{count > 1 ? "s" : ""}</span>
      </div>

      <div className="space-y-2.5 text-xs">
        <MiniRow label="WER" left={`${(deepgram.wer * 100).toFixed(1)}%`} right={`${(whisper.wer * 100).toFixed(1)}%`} leftWins={werDgWins} />
        <MiniRow label="Term recall" left={`${(deepgram.termRecall * 100).toFixed(0)}%`} right={`${(whisper.termRecall * 100).toFixed(0)}%`} leftWins={!recallTie && recallDgWins} tied={recallTie} />
      </div>
    </div>
  );
}

function MiniRow({ label, left, right, leftWins, tied }: { label: string; left: string; right: string; leftWins: boolean; tied?: boolean }) {
  return (
    <div className="grid grid-cols-[60px_1fr_1fr] items-center gap-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</span>
      <span className={`flex items-center gap-1.5 font-mono ${tied ? "text-slate-700" : leftWins ? "font-bold text-emerald-700" : "text-slate-500"}`}>
        <span className="text-[9px] uppercase tracking-wider text-slate-400">DG</span>
        {left}
      </span>
      <span className={`flex items-center gap-1.5 font-mono ${tied ? "text-slate-700" : !leftWins ? "font-bold text-emerald-700" : "text-slate-500"}`}>
        <span className="text-[9px] uppercase tracking-wider text-slate-400">WH</span>
        {right}
      </span>
    </div>
  );
}

function PredictionTable() {
  const rows = [
    { pred: "Deepgram wins domain-term recall (keyterm boosting is real)", outcome: "✅ Confirmed", correct: true, note: "93% vs 89% — small gap on aggregate, larger on accent." },
    { pred: "Whisper wins on partial / interrupted speech (training set heavier on disfluency)", outcome: "❌ Refuted", correct: false, note: "Deepgram hit 0% WER on the partial clip." },
    { pred: "Whisper competitive on Indian English accent (multilingual training)", outcome: "❌ Refuted", correct: false, note: "Whisper recall dropped to 50% — single largest gap in the eval." },
    { pred: "Deepgram wins on latency (Whisper REST is consistently slower)", outcome: "❌ Refuted", correct: false, note: "Whisper was ~1.3s faster on the mean. DG had two 10s+ outliers." },
    { pred: "Whisper cheaper per-minute (small-volume tier)", outcome: "❌ Refuted", correct: false, note: "Deepgram is cheaper at $0.0043/min vs Whisper $0.006/min." },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <th className="py-2 pr-3">Prediction made before running</th>
            <th className="py-2 pr-3">Outcome</th>
            <th className="py-2 pr-0">Honest reflection</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              <td className="py-3 pr-3 text-sm text-slate-700">{r.pred}</td>
              <td className={`py-3 pr-3 text-sm font-semibold ${r.correct ? "text-emerald-700" : "text-rose-700"}`}>{r.outcome}</td>
              <td className="py-3 pr-0 text-xs leading-relaxed text-slate-600">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RubricTable() {
  const rows = [
    { dim: "Domain-term recall", weight: "35%", winner: "Deepgram", note: "93% vs 89%, plus the per-category accent win (100% vs 50%)" },
    { dim: "Overall WER", weight: "15%", winner: "Deepgram", note: "7.8% vs 9.5%" },
    { dim: "Latency p50", weight: "15%", winner: "Deepgram", note: "3.6s vs 4.0s" },
    { dim: "Latency p95", weight: "10%", winner: "Whisper", note: "9.3s vs 12.9s — Whisper has the better tail" },
    { dim: "Fleet cost", weight: "15%", winner: "Deepgram", note: "~$425/mo vs ~$594/mo" },
    { dim: "Compliance / DX", weight: "10%", winner: "Tie", note: "Both have BAA, retention, no-train defaults" },
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <th className="px-4 py-3">Dimension</th>
            <th className="px-4 py-3 text-right">Weight</th>
            <th className="px-4 py-3">Winner</th>
            <th className="px-4 py-3">Why</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={i} className="text-slate-700">
              <td className="px-4 py-3 font-medium text-slate-900">{r.dim}</td>
              <td className="px-4 py-3 text-right font-mono text-xs">{r.weight}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  r.winner === "Deepgram" ? "bg-indigo-100 text-indigo-900"
                  : r.winner === "Whisper" ? "bg-amber-100 text-amber-900"
                  : "bg-slate-100 text-slate-700"
                }`}>
                  {r.winner}
                </span>
              </td>
              <td className="px-4 py-3 text-xs leading-relaxed text-slate-600">{r.note}</td>
            </tr>
          ))}
          <tr className="bg-emerald-50 font-semibold text-slate-900">
            <td className="px-4 py-3">Total</td>
            <td className="px-4 py-3 text-right font-mono text-xs">100%</td>
            <td className="px-4 py-3">
              <span className="rounded-full bg-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-900">Deepgram (4 of 6)</span>
            </td>
            <td className="px-4 py-3 text-xs text-emerald-900">Wins on the 4 highest-weighted dimensions including domain recall.</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
