import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db/client";
import { jobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { SYSTEM_PROMPT, buildUserMessage } from "@/lib/ai/prompt";
import { DiagnosticOutput, DiagnosticOutputJsonSchema } from "@/lib/ai/output-schema";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = "claude-sonnet-4-6";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const body = await req.json();
  const { jobId, transcript } = body as { jobId?: string; transcript?: string };
  if (!jobId || !transcript) {
    return NextResponse.json({ error: "jobId and transcript are required" }, { status: 400 });
  }

  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job) {
    return NextResponse.json({ error: `job ${jobId} not found` }, { status: 404 });
  }

  const anthropic = new Anthropic({ apiKey });
  const userMessage = buildUserMessage(job, transcript);

  const t0 = Date.now();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: "emit_diagnostic",
        description: "Emit the structured diagnostic plan as a JSON object matching the schema.",
        input_schema: DiagnosticOutputJsonSchema as unknown as Anthropic.Tool["input_schema"],
      },
    ],
    tool_choice: { type: "tool", name: "emit_diagnostic" },
    messages: [{ role: "user", content: userMessage }],
  });
  const latencyMs = Date.now() - t0;

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return NextResponse.json({ error: "model did not return tool use" }, { status: 502 });
  }

  // Normalize the model output before strict schema validation. Claude usually
  // returns the right shape, but on very-off-topic or sparse inputs it can
  // collapse the customer_facing_update to a string, omit arrays, or skip
  // optional metadata. We graceful-degrade here so the user-facing demo never
  // 502s on an unfamiliar transcript — the schema contract still defines the
  // ideal shape; this just patches predictable deviations.
  const normalized = normalizeModelOutput(toolUse.input);

  const parsed = DiagnosticOutput.safeParse(normalized);
  if (!parsed.success) {
    return NextResponse.json({
      error: "model output failed schema validation",
      issues: parsed.error.issues,
      raw: toolUse.input,
    }, { status: 502 });
  }

  return NextResponse.json({
    diagnostic: parsed.data,
    llmProvider: "anthropic",
    llmModel: MODEL,
    latencyMs,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });
}

type Loose = Record<string, unknown>;
const isObj = (v: unknown): v is Loose => typeof v === "object" && v !== null && !Array.isArray(v);
const asArray = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const asString = (v: unknown): string => typeof v === "string" ? v : "";

function normalizeModelOutput(raw: unknown): Loose {
  const r: Loose = isObj(raw) ? { ...raw } : {};

  // observations: ensure shape exists with all four arrays
  const obsIn = isObj(r.observations) ? r.observations : {};
  r.observations = {
    visible_damage: asArray(obsIn.visible_damage).filter((x) => typeof x === "string"),
    sounds: asArray(obsIn.sounds).filter((x) => typeof x === "string"),
    measurements: asArray(obsIn.measurements).filter((x) => typeof x === "string"),
    homeowner_statements: asArray(obsIn.homeowner_statements).filter((x) => typeof x === "string"),
  };

  // diagnostic.likely_issues: must have ≥1 entry; backfill if model omitted
  const diagIn = isObj(r.diagnostic) ? r.diagnostic : {};
  let issues = asArray(diagIn.likely_issues).filter(isObj).map((h) => ({
    hypothesis: asString(h.hypothesis) || "Insufficient information from voice note to form a specific hypothesis",
    confidence: ["high", "medium", "low"].includes(h.confidence as string) ? h.confidence : "low",
    evidence: asArray(h.evidence).filter((x) => typeof x === "string"),
    counter_evidence: asArray(h.counter_evidence).filter((x) => typeof x === "string"),
  }));
  if (issues.length === 0) {
    issues = [{
      hypothesis: "Insufficient information from voice note to form a specific hypothesis",
      confidence: "low",
      evidence: [],
      counter_evidence: [],
    }];
  }
  r.diagnostic = { likely_issues: issues.slice(0, 4) };

  // recommended_next_steps: must have ≥1; backfill
  let steps = asArray(r.recommended_next_steps).filter(isObj).map((s) => ({
    step: asString(s.step) || "Re-record voice note with specific roofing observations",
    rationale: asString(s.rationale) || "Current voice note did not include enough detail to recommend a specific next step",
    requires_homeowner_consent: typeof s.requires_homeowner_consent === "boolean" ? s.requires_homeowner_consent : false,
    safety_note: typeof s.safety_note === "string" ? s.safety_note : undefined,
  }));
  if (steps.length === 0) {
    steps = [{
      step: "Re-record voice note with specific roofing observations",
      rationale: "Current voice note did not include enough detail to recommend a specific next step",
      requires_homeowner_consent: false,
      safety_note: undefined,
    }];
  }
  r.recommended_next_steps = steps.slice(0, 6);

  // parts_and_tools: array of {item, reason, typically_in_truck}
  r.parts_and_tools = asArray(r.parts_and_tools).filter(isObj).map((p) => ({
    item: asString(p.item),
    reason: asString(p.reason),
    typically_in_truck: typeof p.typically_in_truck === "boolean" ? p.typically_in_truck : false,
  })).filter((p) => p.item.length > 0);

  // customer_facing_update: this is the field that empirically broke — Claude
  // sometimes collapses it to a plain string for off-topic input. Wrap if so.
  const cfu = r.customer_facing_update;
  if (typeof cfu === "string") {
    r.customer_facing_update = { text: cfu, must_be_reviewed: true, warnings: [] };
  } else if (isObj(cfu)) {
    r.customer_facing_update = {
      text: asString(cfu.text),
      must_be_reviewed: true,
      warnings: asArray(cfu.warnings).filter((x) => typeof x === "string"),
    };
  } else {
    r.customer_facing_update = {
      text: "Voice note did not contain enough detail to draft a customer-facing update. Please re-record.",
      must_be_reviewed: true,
      warnings: ["Do not commit verbally to anything not based on a direct on-site observation."],
    };
  }

  // Top-level arrays — default to []
  r.assumptions_made = asArray(r.assumptions_made).filter((x) => typeof x === "string");
  r.needs_human_confirmation = asArray(r.needs_human_confirmation).filter((x) => typeof x === "string");
  r.guardrails_triggered = asArray(r.guardrails_triggered).filter((x) => typeof x === "string");

  return r;
}
