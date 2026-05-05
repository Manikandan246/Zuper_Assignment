import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { TopNav, Footer, extractToc } from "@/app/_components/DocLayout";

export const dynamic = "force-static";

export default async function SubmissionPage() {
  const filePath = path.join(process.cwd(), "docs", "SUBMISSION.md");
  const raw = await readFile(filePath, "utf8");
  const stripped = raw
    .replace(/^# .*$/m, "")
    .replace(/^\*\*Candidate:\*\*.*$/m, "")
    .replace(/^\*\*Domain:\*\*.*$/m, "")
    .replace(/^\*\*Scenario:\*\*.*$/m, "")
    .trimStart();
  const toc = extractToc(stripped);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <TopNav />

      {/* Hero */}
      <header className="relative overflow-hidden border-b border-slate-800/10 bg-slate-900 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-transparent to-emerald-900/20" />
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
          <p className="mb-3 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Field Service AI Copilot · Roofing
          </p>
          <h1 className="mb-4 text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
            Voice-enabled diagnostic copilot<br className="hidden sm:block" /> for the on-site technician.
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Built for the recurring-leak callback — the technician on a ladder, gloves on, wind picking up, an anxious homeowner watching from the driveway. Voice in; structured diagnostic plan out; reviewed and saved before anyone hears anything.
          </p>

          {/* Navigation cards */}
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NavCard
              href="/jobs/cedar-lane"
              eyebrow="Live prototype"
              title="Cedar Lane demo"
              description="Voice in → structured diagnostic → review → save. Click through it."
              accent="indigo"
            />
            <NavCard
              href="/eval"
              eyebrow="Visual results"
              title="STT eval report"
              description="Deepgram vs Whisper · 10 clips · 5 categories. Production rubric with rationale."
              accent="emerald"
            />
            <NavCard
              href="/note"
              eyebrow="Depth"
              title="Product note"
              description="Schema as contract, prompt structure, voice UX, eval summary, risks, metrics, roadmap."
              accent="slate"
            />
            <NavCard
              href="/eval-plan"
              eyebrow="Methodology"
              title="Eval plan"
              description="Disqualifying thresholds, downstream LLM-as-judge, privacy gates, LLM v2 plan."
              accent="amber"
            />
          </div>

          {/* Headline result */}
          <div className="mt-10 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-4 sm:px-6 sm:py-5">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-300">Headline result from the eval</p>
            <p className="text-sm leading-relaxed text-emerald-50/90 sm:text-base">
              Deepgram Nova-3 wins 4 of 6 weighted dimensions. The deciding result: on the Indian English clip, Whisper&apos;s domain-term recall dropped to <strong className="text-white">50%</strong> while Deepgram held <strong className="text-white">100%</strong>. A single category result that decides the vendor for a US roofing workforce.
            </p>
          </div>
        </div>
      </header>

      {/* Reading order callout */}
      <section className="border-b border-slate-200 bg-amber-50/60">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <p className="text-sm leading-relaxed text-slate-800">
            <strong className="font-semibold">Reading order:</strong>{" "}
            <span className="text-slate-600">5 min →</span> click through the <Link href="/jobs/cedar-lane" className="font-medium text-indigo-700 underline-offset-2 hover:underline">live demo</Link>, watch the Loom, scroll the <Link href="/eval" className="font-medium text-indigo-700 underline-offset-2 hover:underline">eval results</Link>.{"  "}
            <span className="text-slate-600">15 min →</span> add the user moment, schema design, and evaluation summary in the <Link href="/note" className="font-medium text-indigo-700 underline-offset-2 hover:underline">product note</Link>.{"  "}
            <span className="text-slate-600">Deep →</span> add the decision criteria, LLM rationale, and per-clip results in the <Link href="/eval-plan" className="font-medium text-indigo-700 underline-offset-2 hover:underline">eval plan</Link>.
          </p>
        </div>
      </section>

      {/* Rendered submission package */}
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[14rem_1fr] lg:gap-12">
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">On this page</p>
              <nav className="space-y-1 text-sm">
                {toc.map((it) => (
                  <a
                    key={it.id}
                    href={`#${it.id}`}
                    className={
                      it.depth === 2
                        ? "block leading-snug text-slate-700 hover:text-indigo-700"
                        : "block pl-3 leading-snug text-slate-500 hover:text-indigo-700"
                    }
                  >
                    {it.text}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <article className="prose prose-slate max-w-none prose-headings:scroll-mt-20 prose-headings:font-semibold prose-h2:mt-10 prose-h2:border-t prose-h2:border-slate-200 prose-h2:pt-8 prose-h2:text-2xl prose-h3:text-lg prose-a:text-indigo-700 prose-a:font-medium hover:prose-a:underline prose-strong:text-slate-900 prose-table:text-sm prose-th:bg-slate-50 prose-thead:border-b-2 prose-thead:border-slate-300 prose-blockquote:border-l-indigo-300 prose-blockquote:bg-indigo-50/50 prose-blockquote:not-italic prose-blockquote:font-normal prose-code:rounded prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-normal prose-code:text-slate-800">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSlug, [rehypeAutolinkHeadings, { behavior: "wrap" }]]}
            >
              {stripped}
            </ReactMarkdown>
          </article>
        </div>
      </div>

      <Footer />
    </main>
  );
}

function NavCard({
  href, eyebrow, title, description, accent,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  accent: "indigo" | "emerald" | "slate" | "amber";
}) {
  const accents: Record<typeof accent, string> = {
    indigo: "hover:border-indigo-400 group-hover:text-indigo-300",
    emerald: "hover:border-emerald-400 group-hover:text-emerald-300",
    slate: "hover:border-slate-400 group-hover:text-slate-200",
    amber: "hover:border-amber-400 group-hover:text-amber-300",
  };
  const eyebrowColor: Record<typeof accent, string> = {
    indigo: "text-indigo-300",
    emerald: "text-emerald-300",
    slate: "text-slate-300",
    amber: "text-amber-300",
  };
  return (
    <Link
      href={href}
      className={`group block rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur transition ${accents[accent]}`}
    >
      <p className={`mb-1 text-[10px] font-bold uppercase tracking-[0.18em] ${eyebrowColor[accent]}`}>{eyebrow}</p>
      <p className="text-base font-semibold text-white">
        {title}
        <span className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">→</span>
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-300">{description}</p>
    </Link>
  );
}
