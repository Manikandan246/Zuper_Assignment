import { pgTable, text, timestamp, jsonb, integer, uuid, boolean } from "drizzle-orm/pg-core";

export const jobs = pgTable("zuper_jobs", {
  id: text("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  address: text("address").notNull(),
  issueSummary: text("issue_summary").notNull(),
  asset: jsonb("asset").$type<{
    type: string;
    ageYears: number;
    material: string;
    notes?: string;
  }>().notNull(),
  warrantyStatus: text("warranty_status").notNull(),
  priorVisits: jsonb("prior_visits").$type<Array<{
    date: string;
    techName: string;
    summary: string;
    actionsTaken: string[];
  }>>().notNull().default([]),
  technicianNotes: text("technician_notes"),
  openTasks: jsonb("open_tasks").$type<string[]>().notNull().default([]),
  assignedTechName: text("assigned_tech_name").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const voiceNotes = pgTable("zuper_voice_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: text("job_id").references(() => jobs.id).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  durationSec: integer("duration_sec"),
  sttProvider: text("stt_provider").notNull(),
  sttModel: text("stt_model"),
  rawTranscript: text("raw_transcript").notNull(),
  wordConfidences: jsonb("word_confidences").$type<Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>>(),
  sttLatencyMs: integer("stt_latency_ms"),
  audioSizeBytes: integer("audio_size_bytes"),
});

export const diagnosticOutputs = pgTable("zuper_diagnostic_outputs", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: text("job_id").references(() => jobs.id).notNull(),
  voiceNoteId: uuid("voice_note_id").references(() => voiceNotes.id),
  version: integer("version").notNull().default(1),
  llmProvider: text("llm_provider").notNull(),
  llmModel: text("llm_model").notNull(),
  llmLatencyMs: integer("llm_latency_ms"),
  rawJson: jsonb("raw_json").notNull(),
  reviewedJson: jsonb("reviewed_json"),
  reviewed: boolean("reviewed").notNull().default(false),
  savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Job = typeof jobs.$inferSelect;
export type VoiceNote = typeof voiceNotes.$inferSelect;
export type DiagnosticOutput = typeof diagnosticOutputs.$inferSelect;
