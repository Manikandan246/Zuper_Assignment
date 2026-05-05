import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { voiceNotes, diagnosticOutputs } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    jobId,
    transcript,
    wordConfidences,
    sttProvider,
    sttModel,
    sttLatencyMs,
    audioSizeBytes,
    durationSec,
    rawDiagnostic,
    reviewedDiagnostic,
    llmProvider,
    llmModel,
    llmLatencyMs,
  } = body;

  if (!jobId || !transcript || !rawDiagnostic) {
    return NextResponse.json({ error: "jobId, transcript, and rawDiagnostic are required" }, { status: 400 });
  }

  const [voiceNote] = await db.insert(voiceNotes).values({
    jobId,
    rawTranscript: transcript,
    wordConfidences: wordConfidences ?? null,
    sttProvider: sttProvider ?? "unknown",
    sttModel: sttModel ?? null,
    sttLatencyMs: sttLatencyMs ?? null,
    audioSizeBytes: audioSizeBytes ?? null,
    durationSec: durationSec ?? null,
  }).returning();

  const previous = await db
    .select({ version: diagnosticOutputs.version })
    .from(diagnosticOutputs)
    .where(eq(diagnosticOutputs.jobId, jobId))
    .orderBy(desc(diagnosticOutputs.version))
    .limit(1);
  const nextVersion = (previous[0]?.version ?? 0) + 1;

  const [saved] = await db.insert(diagnosticOutputs).values({
    jobId,
    voiceNoteId: voiceNote.id,
    version: nextVersion,
    llmProvider: llmProvider ?? "anthropic",
    llmModel: llmModel ?? "claude-sonnet-4-6",
    llmLatencyMs: llmLatencyMs ?? null,
    rawJson: rawDiagnostic,
    reviewedJson: reviewedDiagnostic ?? rawDiagnostic,
    reviewed: !!reviewedDiagnostic,
  }).returning();

  return NextResponse.json({
    voiceNoteId: voiceNote.id,
    diagnosticId: saved.id,
    version: saved.version,
    savedAt: saved.savedAt,
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const records = await db
    .select()
    .from(diagnosticOutputs)
    .where(eq(diagnosticOutputs.jobId, jobId))
    .orderBy(desc(diagnosticOutputs.version));
  return NextResponse.json({ records });
}
