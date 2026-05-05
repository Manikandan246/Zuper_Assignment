import { readFile } from "node:fs/promises";
import path from "node:path";
import { DocLayout, extractToc } from "@/app/_components/DocLayout";

export const dynamic = "force-static";

export default async function ProductNotePage() {
  const filePath = path.join(process.cwd(), "docs", "PRODUCT_NOTE.md");
  const raw = await readFile(filePath, "utf8");

  // Strip the H1 + the metadata lines so the page header serves as the title.
  const stripped = stripFrontMatter(raw);
  const toc = extractToc(stripped);

  return (
    <DocLayout
      eyebrow="Product Note"
      title="Field Service AI Copilot for Roofing"
      subtitle="The user moment, the structured-output schema as design centerpiece, the system prompt, voice UX decisions, the AI evaluation summary, risks and guardrails, pilot metrics and launch plan, and the roadmap."
      markdown={stripped}
      toc={toc}
    />
  );
}

function stripFrontMatter(md: string): string {
  // Remove the leading H1 line and the italic metadata immediately following it,
  // since the DocLayout header already shows them.
  return md
    .replace(/^# .*$/m, "")
    .replace(/^_.*_$/gm, "")
    .replace(/^---$/m, "")
    .trimStart();
}
