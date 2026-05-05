import { z } from "zod";

export const ConfidenceLevel = z.enum(["high", "medium", "low"]);

export const Hypothesis = z.object({
  hypothesis: z.string().describe("One-line statement of the suspected root cause."),
  confidence: ConfidenceLevel,
  evidence: z.array(z.string()).describe("Specific facts from the technician's voice note or job context that support this hypothesis."),
  counter_evidence: z.array(z.string()).describe("Facts that argue against this hypothesis. Empty array only if there is genuinely no counter-evidence."),
});

export const NextStep = z.object({
  step: z.string().describe("A concrete inspection or action item, written in imperative voice."),
  rationale: z.string().describe("Why this step matters in 1-2 sentences."),
  requires_homeowner_consent: z.boolean().describe("True if the step involves entering the home, accessing private property, or causing visible disruption."),
  safety_note: z.string().nullish().describe("Optional safety callout, e.g. 'Tie off before approaching ridge in current wind.'"),
});

export const PartOrTool = z.object({
  item: z.string(),
  reason: z.string(),
  typically_in_truck: z.boolean().describe("Best guess: is this typically stocked on a roofing service truck, or would it require a supply-house run?"),
});

export const CustomerFacingUpdate = z.object({
  text: z.string().describe("2-3 sentences in plain, calm, non-technical language. The technician will read this to the homeowner. Never promise warranty coverage, insurance approval, or specific timelines."),
  must_be_reviewed: z.literal(true).describe("Always true. Customer-facing copy must be approved by the technician before delivery."),
  warnings: z.array(z.string()).describe("Specific reminders to the technician about what NOT to commit to verbally."),
});

export const DiagnosticOutput = z.object({
  observations: z.object({
    visible_damage: z.array(z.string()),
    sounds: z.array(z.string()),
    measurements: z.array(z.string()),
    homeowner_statements: z.array(z.string()),
  }).describe("Atomic facts extracted from the technician's voice note. No interpretation here — just what was reported."),

  diagnostic: z.object({
    likely_issues: z.array(Hypothesis).min(1).max(4).describe("Ranked list of probable root causes. Always provide at least one. Maximum four."),
  }),

  recommended_next_steps: z.array(NextStep).min(1).max(6),

  parts_and_tools: z.array(PartOrTool),

  customer_facing_update: CustomerFacingUpdate,

  assumptions_made: z.array(z.string()).describe("Things the AI inferred or assumed that the technician should sanity-check."),

  needs_human_confirmation: z.array(z.string()).describe("Specific items where AI confidence is insufficient and the technician must decide."),

  guardrails_triggered: z.array(z.string()).describe("Internal log of which safety rules the AI applied. E.g. 'Withheld replacement recommendation: insufficient evidence to choose repair vs. full replacement.'"),
});

export type DiagnosticOutputType = z.infer<typeof DiagnosticOutput>;

export const DiagnosticOutputJsonSchema = {
  type: "object",
  properties: {
    observations: {
      type: "object",
      properties: {
        visible_damage: { type: "array", items: { type: "string" } },
        sounds: { type: "array", items: { type: "string" } },
        measurements: { type: "array", items: { type: "string" } },
        homeowner_statements: { type: "array", items: { type: "string" } },
      },
      required: ["visible_damage", "sounds", "measurements", "homeowner_statements"],
    },
    diagnostic: {
      type: "object",
      properties: {
        likely_issues: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: {
            type: "object",
            properties: {
              hypothesis: { type: "string" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              evidence: { type: "array", items: { type: "string" } },
              counter_evidence: { type: "array", items: { type: "string" } },
            },
            required: ["hypothesis", "confidence", "evidence", "counter_evidence"],
          },
        },
      },
      required: ["likely_issues"],
    },
    recommended_next_steps: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          step: { type: "string" },
          rationale: { type: "string" },
          requires_homeowner_consent: { type: "boolean" },
          safety_note: { type: "string" },
        },
        required: ["step", "rationale", "requires_homeowner_consent"],
      },
    },
    parts_and_tools: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: { type: "string" },
          reason: { type: "string" },
          typically_in_truck: { type: "boolean" },
        },
        required: ["item", "reason", "typically_in_truck"],
      },
    },
    customer_facing_update: {
      type: "object",
      properties: {
        text: { type: "string" },
        must_be_reviewed: { type: "boolean", const: true },
        warnings: { type: "array", items: { type: "string" } },
      },
      required: ["text", "must_be_reviewed", "warnings"],
    },
    assumptions_made: { type: "array", items: { type: "string" } },
    needs_human_confirmation: { type: "array", items: { type: "string" } },
    guardrails_triggered: { type: "array", items: { type: "string" } },
  },
  required: [
    "observations",
    "diagnostic",
    "recommended_next_steps",
    "parts_and_tools",
    "customer_facing_update",
    "assumptions_made",
    "needs_human_confirmation",
    "guardrails_triggered",
  ],
} as const;
