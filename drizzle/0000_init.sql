CREATE TABLE "zuper_diagnostic_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" text NOT NULL,
	"voice_note_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"llm_provider" text NOT NULL,
	"llm_model" text NOT NULL,
	"llm_latency_ms" integer,
	"raw_json" jsonb NOT NULL,
	"reviewed_json" jsonb,
	"reviewed" boolean DEFAULT false NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zuper_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text,
	"address" text NOT NULL,
	"issue_summary" text NOT NULL,
	"asset" jsonb NOT NULL,
	"warranty_status" text NOT NULL,
	"prior_visits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"technician_notes" text,
	"open_tasks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assigned_tech_name" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zuper_voice_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_sec" integer,
	"stt_provider" text NOT NULL,
	"stt_model" text,
	"raw_transcript" text NOT NULL,
	"word_confidences" jsonb,
	"stt_latency_ms" integer,
	"audio_size_bytes" integer
);
--> statement-breakpoint
ALTER TABLE "zuper_diagnostic_outputs" ADD CONSTRAINT "zuper_diagnostic_outputs_job_id_zuper_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."zuper_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zuper_diagnostic_outputs" ADD CONSTRAINT "zuper_diagnostic_outputs_voice_note_id_zuper_voice_notes_id_fk" FOREIGN KEY ("voice_note_id") REFERENCES "public"."zuper_voice_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zuper_voice_notes" ADD CONSTRAINT "zuper_voice_notes_job_id_zuper_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."zuper_jobs"("id") ON DELETE no action ON UPDATE no action;