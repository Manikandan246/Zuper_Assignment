import { readFile } from "node:fs/promises";
import path from "node:path";
import { DocLayout, extractToc } from "@/app/_components/DocLayout";

export const dynamic = "force-static";

export default async function EvalPlanPage() {
  const filePath = path.join(process.cwd(), "docs", "EVAL_PLAN.md");
  const raw = await readFile(filePath, "utf8");

  const stripped = raw
    .replace(/^# .*$/m, "")
    .replace(/^_.*_$/gm, "")
    .replace(/^---$/m, "")
    .trimStart();
  const toc = extractToc(stripped);

  return (
    <DocLayout
      eyebrow="AI Evaluation Plan"
      title="Voice Stack — STT + LLM eval methodology"
      subtitle="Methodology and run results for the STT comparison (Deepgram Nova-3 vs OpenAI Whisper-1), LLM choice rationale and the v2 LLM eval, privacy and compliance gates, the decision rubric. The visual results page lives at /eval; this is the deeper read."
      markdown={stripped}
      toc={toc}
    />
  );
}
