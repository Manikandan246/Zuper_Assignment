/**
 * STT eval runner.
 *
 * For each clip in eval/clips/:
 *   - send it to Deepgram (Nova-3) and OpenAI Whisper (whisper-1)
 *   - record transcript, latency, and cost estimate
 *   - score WER and domain-term recall against the reference
 *
 * Outputs:
 *   - eval/results/results.json  (machine-readable)
 *   - eval/results/results.md    (human-readable table)
 *
 * Usage:
 *   DEEPGRAM_API_KEY=... OPENAI_API_KEY=... npx tsx eval/run.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { readFile, readdir, writeFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { wer, domainTermRecall } from "./wer";

const CLIPS_DIR = "eval/clips";
const RESULTS_DIR = "eval/results";
const REFS_PATH = "eval/scripts/references.json";

// Pricing snapshots used only for projected-cost columns. Adjust if vendor pricing changes.
const DEEPGRAM_NOVA3_PER_MIN_USD = 0.0043;
const WHISPER_PER_MIN_USD = 0.006;

const DEEPGRAM_KEYTERMS = [
  "ridge cap", "ridge vent", "vent boot", "pipe boot", "step flashing",
  "valley flashing", "drip edge", "ice and water shield", "decking",
  "soffit", "fascia", "granule loss", "underlayment", "shingle", "asphalt 3-tab",
];

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

type ProviderResult = {
  provider: string;
  model: string;
  transcript: string;
  latencyMs: number;
  costUsd: number | null;
  wer: ReturnType<typeof wer>;
  domainTermRecall: ReturnType<typeof domainTermRecall>;
  error?: string;
};

async function main() {
  const refsRaw = JSON.parse(await readFile(REFS_PATH, "utf8"));
  const domainTerms: string[] = refsRaw._domain_terms ?? [];
  const clipDir = await readdir(CLIPS_DIR);
  const clipFiles = clipDir.filter((f) => /\.(wav|m4a|mp3|webm|ogg)$/i.test(f)).sort();

  if (clipFiles.length === 0) {
    console.error(`No clips found in ${CLIPS_DIR}. Record clips first.`);
    process.exit(1);
  }

  console.log(`Found ${clipFiles.length} clip(s).`);
  const results: ClipResult[] = [];

  for (const file of clipFiles) {
    const path = join(CLIPS_DIR, file);
    const clipId = file.replace(/\.[^.]+$/, "");
    const ref = refsRaw[clipId];
    if (!ref) {
      console.warn(`! No reference for ${clipId}, skipping.`);
      continue;
    }

    const buf = await readFile(path);
    const fileStat = await stat(path);
    console.log(`\n→ ${clipId} (${(fileStat.size / 1024).toFixed(1)} KB)`);

    const clip: ClipResult = {
      clipId,
      clipFile: file,
      category: ref.category,
      label: ref.label,
      reference: ref.reference,
      durationSec: null,
      audioBytes: fileStat.size,
      providers: {},
    };

    if (process.env.DEEPGRAM_API_KEY) {
      try {
        const dg = await runDeepgram(buf, file, ref.reference, domainTerms);
        clip.providers.deepgram_nova3 = dg;
        console.log(`   deepgram   WER=${(dg.wer.wer * 100).toFixed(1)}% term-recall=${(dg.domainTermRecall.recall * 100).toFixed(0)}% latency=${dg.latencyMs}ms`);
      } catch (e: unknown) {
        const err = e as Error;
        console.log(`   deepgram   ERROR ${err.message}`);
        clip.providers.deepgram_nova3 = errorResult("deepgram", "nova-3", err.message);
      }
    } else {
      console.log("   deepgram   (skipped: DEEPGRAM_API_KEY not set)");
    }

    if (process.env.OPENAI_API_KEY) {
      try {
        const wh = await runWhisper(buf, file, ref.reference, domainTerms);
        clip.providers.openai_whisper = wh;
        console.log(`   whisper    WER=${(wh.wer.wer * 100).toFixed(1)}% term-recall=${(wh.domainTermRecall.recall * 100).toFixed(0)}% latency=${wh.latencyMs}ms`);
      } catch (e: unknown) {
        const err = e as Error;
        console.log(`   whisper    ERROR ${err.message}`);
        clip.providers.openai_whisper = errorResult("openai", "whisper-1", err.message);
      }
    } else {
      console.log("   whisper    (skipped: OPENAI_API_KEY not set)");
    }

    results.push(clip);
  }

  const ts = new Date().toISOString();
  await writeFile(join(RESULTS_DIR, "results.json"), JSON.stringify({ ts, results }, null, 2));
  await writeFile(join(RESULTS_DIR, "results.md"), renderMarkdown(results, ts));

  printSummary(results);
}

async function runDeepgram(buf: Buffer, file: string, ref: string, domainTerms: string[]): Promise<ProviderResult> {
  const params = new URLSearchParams({
    model: "nova-3",
    smart_format: "true",
    punctuate: "true",
    language: "en",
  });
  for (const term of DEEPGRAM_KEYTERMS) params.append("keyterm", term);

  const t0 = Date.now();
  const res = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY!}`,
      "Content-Type": mimeFor(file),
    },
    body: new Uint8Array(buf),
  });
  const latencyMs = Date.now() - t0;

  if (!res.ok) throw new Error(`Deepgram ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const transcript: string = data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  const durationSec: number | undefined = data.metadata?.duration;
  const cost = durationSec ? (durationSec / 60) * DEEPGRAM_NOVA3_PER_MIN_USD : null;

  return {
    provider: "deepgram",
    model: "nova-3",
    transcript,
    latencyMs,
    costUsd: cost,
    wer: wer(ref, transcript),
    domainTermRecall: domainTermRecall(ref, transcript, domainTerms),
  };
}

async function runWhisper(buf: Buffer, file: string, ref: string, domainTerms: string[]): Promise<ProviderResult> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buf)], { type: mimeFor(file) }), file);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("language", "en");

  const t0 = Date.now();
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY!}` },
    body: form,
  });
  const latencyMs = Date.now() - t0;

  if (!res.ok) throw new Error(`Whisper ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const transcript: string = data.text ?? "";
  const durationSec: number | undefined = data.duration;
  const cost = durationSec ? (durationSec / 60) * WHISPER_PER_MIN_USD : null;

  return {
    provider: "openai",
    model: "whisper-1",
    transcript,
    latencyMs,
    costUsd: cost,
    wer: wer(ref, transcript),
    domainTermRecall: domainTermRecall(ref, transcript, domainTerms),
  };
}

function mimeFor(file: string): string {
  const e = extname(file).toLowerCase();
  return e === ".wav" ? "audio/wav"
    : e === ".m4a" ? "audio/mp4"
    : e === ".mp3" ? "audio/mpeg"
    : e === ".ogg" ? "audio/ogg"
    : "audio/webm";
}

function errorResult(provider: string, model: string, msg: string): ProviderResult {
  return {
    provider, model,
    transcript: "",
    latencyMs: 0,
    costUsd: null,
    wer: { wer: 1, substitutions: 0, deletions: 0, insertions: 0, hits: 0, refLength: 0, hypLength: 0 },
    domainTermRecall: { found: 0, expected: 0, missed: [], recall: 0 },
    error: msg,
  };
}

function renderMarkdown(results: ClipResult[], ts: string): string {
  const lines: string[] = [];
  lines.push(`# STT Eval Results`);
  lines.push(`Run: ${ts}`);
  lines.push("");
  lines.push(`## Per-clip results`);
  lines.push("");
  lines.push(`| Clip | Category | Provider | WER | Domain term recall | Latency (ms) | Cost (USD) |`);
  lines.push(`|---|---|---|---:|---:|---:|---:|`);
  for (const c of results) {
    for (const [_, p] of Object.entries(c.providers)) {
      lines.push(
        `| ${c.clipId} | ${c.category} | ${p.provider}/${p.model} | ${(p.wer.wer * 100).toFixed(1)}% | ${p.domainTermRecall.expected > 0 ? `${p.domainTermRecall.found}/${p.domainTermRecall.expected} (${(p.domainTermRecall.recall * 100).toFixed(0)}%)` : "—"} | ${p.latencyMs} | ${p.costUsd != null ? "$" + p.costUsd.toFixed(4) : "—"} |`
      );
    }
  }
  lines.push("");
  lines.push(`## Aggregate by provider`);
  lines.push("");
  const aggs = aggregate(results);
  lines.push(`| Provider | Mean WER | Mean term recall | Mean latency | Total cost |`);
  lines.push(`|---|---:|---:|---:|---:|`);
  for (const a of aggs) {
    lines.push(`| ${a.provider} | ${(a.meanWer * 100).toFixed(1)}% | ${(a.meanTermRecall * 100).toFixed(0)}% | ${a.meanLatency.toFixed(0)}ms | $${a.totalCost.toFixed(4)} |`);
  }
  lines.push("");
  lines.push(`## Aggregate by category`);
  lines.push("");
  for (const cat of [...new Set(results.map((r) => r.category))]) {
    lines.push(`### ${cat}`);
    lines.push(`| Provider | Mean WER | Mean term recall |`);
    lines.push(`|---|---:|---:|`);
    const byProv = aggregate(results.filter((r) => r.category === cat));
    for (const a of byProv) {
      lines.push(`| ${a.provider} | ${(a.meanWer * 100).toFixed(1)}% | ${(a.meanTermRecall * 100).toFixed(0)}% |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function aggregate(results: ClipResult[]) {
  const map = new Map<string, { sumWer: number; sumTerm: number; sumLat: number; sumCost: number; n: number }>();
  for (const c of results) {
    for (const [_, p] of Object.entries(c.providers)) {
      const key = `${p.provider}/${p.model}`;
      const cur = map.get(key) ?? { sumWer: 0, sumTerm: 0, sumLat: 0, sumCost: 0, n: 0 };
      cur.sumWer += p.wer.wer;
      cur.sumTerm += p.domainTermRecall.expected > 0 ? p.domainTermRecall.recall : 1;
      cur.sumLat += p.latencyMs;
      cur.sumCost += p.costUsd ?? 0;
      cur.n += 1;
      map.set(key, cur);
    }
  }
  return [...map.entries()].map(([provider, v]) => ({
    provider,
    meanWer: v.sumWer / v.n,
    meanTermRecall: v.sumTerm / v.n,
    meanLatency: v.sumLat / v.n,
    totalCost: v.sumCost,
  }));
}

function printSummary(results: ClipResult[]) {
  console.log("\n=== Aggregate ===");
  for (const a of aggregate(results)) {
    console.log(`${a.provider.padEnd(20)} mean WER=${(a.meanWer * 100).toFixed(1)}%  term recall=${(a.meanTermRecall * 100).toFixed(0)}%  latency=${a.meanLatency.toFixed(0)}ms  cost=$${a.totalCost.toFixed(4)}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
