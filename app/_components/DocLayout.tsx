import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";

type TocItem = { depth: number; text: string; id: string };

export function extractToc(markdown: string): TocItem[] {
  const lines = markdown.split("\n");
  const items: TocItem[] = [];
  let inFence = false;
  for (const raw of lines) {
    if (raw.startsWith("```")) inFence = !inFence;
    if (inFence) continue;
    const m = raw.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (!m) continue;
    const depth = m[1].length;
    const text = m[2].replace(/\*\*/g, "").replace(/`/g, "").trim();
    const id = slugify(text);
    items.push({ depth, text, id });
  }
  return items;
}

// rehype-slug uses github-slugger, which converts to lowercase, replaces spaces with -, strips most punctuation.
// Keep this matched to that behavior for the TOC anchors.
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function DocLayout({
  title,
  subtitle,
  eyebrow,
  markdown,
  toc,
  showTopNav = true,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  markdown: string;
  toc: TocItem[];
  showTopNav?: boolean;
}) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      {showTopNav && <TopNav />}

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          {eyebrow && (
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-600">{eyebrow}</p>
          )}
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-600">{subtitle}</p>}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[14rem_1fr] lg:gap-12">
          {/* Sticky TOC sidebar (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-6">
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

          {/* Mobile TOC */}
          <details className="rounded-xl border border-slate-200 bg-white p-4 lg:hidden">
            <summary className="cursor-pointer text-sm font-semibold text-slate-900">On this page</summary>
            <nav className="mt-3 space-y-1 text-sm">
              {toc.map((it) => (
                <a
                  key={it.id}
                  href={`#${it.id}`}
                  className={it.depth === 2 ? "block text-slate-700" : "block pl-3 text-slate-500"}
                >
                  {it.text}
                </a>
              ))}
            </nav>
          </details>

          {/* Rendered markdown content */}
          <article className="prose prose-slate max-w-none prose-headings:scroll-mt-20 prose-headings:font-semibold prose-h2:mt-12 prose-h2:border-t prose-h2:border-slate-200 prose-h2:pt-8 prose-h2:text-2xl prose-h3:text-lg prose-a:text-indigo-700 prose-a:font-medium hover:prose-a:underline prose-strong:text-slate-900 prose-table:text-sm prose-th:bg-slate-50 prose-thead:border-b-2 prose-thead:border-slate-300 prose-blockquote:border-l-indigo-300 prose-blockquote:bg-indigo-50/50 prose-blockquote:not-italic prose-blockquote:font-normal prose-code:rounded prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-normal prose-code:text-slate-800 prose-pre:bg-slate-900">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSlug, [rehypeAutolinkHeadings, { behavior: "wrap" }]]}
            >
              {markdown}
            </ReactMarkdown>
          </article>
        </div>
      </div>

      <Footer />
    </main>
  );
}

export function TopNav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="text-sm font-semibold text-slate-900">
          Field Service AI Copilot · Roofing
        </Link>
        <div className="hidden items-center gap-1 text-sm sm:flex">
          <NavLink href="/submission">Submission</NavLink>
          <NavLink href="/jobs/cedar-lane">Demo</NavLink>
          <NavLink href="/eval">Eval results</NavLink>
          <NavLink href="/note">Product note</NavLink>
          <NavLink href="/eval-plan">Eval plan</NavLink>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
    >
      {children}
    </Link>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white py-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-xs text-slate-500 sm:px-6">
        <p>Field Service AI Copilot · Roofing · v1 prototype</p>
        <div className="flex items-center gap-3">
          <Link href="/submission" className="hover:text-slate-900">Submission</Link>
          <span aria-hidden="true">·</span>
          <Link href="/jobs/cedar-lane" className="hover:text-slate-900">Demo</Link>
          <span aria-hidden="true">·</span>
          <Link href="/eval" className="hover:text-slate-900">Eval results</Link>
        </div>
      </div>
    </footer>
  );
}
