import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { jobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { CopilotClient } from "./CopilotClient";
import { TopNav } from "@/app/_components/DocLayout";

export const dynamic = "force-dynamic";

export default async function JobPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [job] = await db.select().from(jobs).where(eq(jobs.id, slug)).limit(1);
  if (!job) notFound();

  const visitCount = job.priorVisits.length;
  const tone = visitCount >= 2 ? "rose" : visitCount === 1 ? "amber" : "emerald";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <TopNav />
      {/* Header — slate, dense, identity-forward */}
      <header className="border-b border-slate-800/10 bg-slate-900 text-white">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-1 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Field Service Copilot · Roofing
              </p>
              <h1 className="truncate text-xl font-semibold sm:text-2xl">
                Job {job.id}
                <span className="ml-2 font-mono text-base font-normal text-slate-400 sm:text-lg">·</span>
                <span className="ml-2 text-base font-medium text-slate-200 sm:text-lg">{job.customerName}</span>
              </h1>
              <p className="mt-1 truncate text-sm text-slate-300">{job.address}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusPill tone={tone}>
                {visitCount === 0 ? "First visit" : `Visit ${visitCount + 1} · recurring`}
              </StatusPill>
              <span className="hidden rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 sm:inline-block">
                Tech: {job.assignedTechName}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
        {/* Job context — surfaced as a real "snapshot" the tech reads first */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Job Context</h2>

          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <Field label="Customer">
              <div className="text-base font-medium sm:text-[15px]">{job.customerName}</div>
              {job.customerPhone && <div className="text-sm text-slate-500">{job.customerPhone}</div>}
            </Field>

            <Field label="Address">
              <div className="text-base sm:text-[15px]">{job.address}</div>
            </Field>

            <Field label="Asset" full>
              <div className="text-base sm:text-[15px]">
                {job.asset.type} <span className="text-slate-500">·</span>{" "}
                <span className="font-semibold text-slate-900">{job.asset.ageYears} yrs</span>{" "}
                <span className="text-slate-500">·</span> {job.asset.material}
              </div>
              {job.asset.notes && <div className="mt-1 text-sm leading-relaxed text-slate-600">{job.asset.notes}</div>}
            </Field>

            <Field label="Warranty status">
              <div className="text-sm leading-relaxed text-slate-700">{job.warrantyStatus}</div>
            </Field>

            <Field label="Issue reported" full>
              <div className="rounded-lg border-l-4 border-slate-300 bg-slate-50 px-4 py-3 text-base leading-relaxed text-slate-800 sm:text-[15px]">
                {job.issueSummary}
              </div>
            </Field>

            <Field label={`Prior visits (${visitCount})`} full>
              {visitCount === 0 ? (
                <span className="text-slate-500">None on record.</span>
              ) : (
                <Timeline visits={job.priorVisits} />
              )}
            </Field>

            <Field label={`Open tasks (${job.openTasks.length})`} full>
              <ul className="space-y-1.5">
                {job.openTasks.map((t, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-700">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Field>

            {job.technicianNotes && (
              <Field label="Existing technician notes" full>
                <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950 ring-1 ring-amber-100">
                  {job.technicianNotes}
                </div>
              </Field>
            )}
          </div>
        </section>

        <CopilotClient jobId={job.id} />
      </div>

      <footer className="mt-8 border-t border-slate-200 bg-white py-6">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <p className="text-center text-xs text-slate-400">
            Prototype · Voice-enabled diagnostic copilot · structured outputs reviewed before save
          </p>
        </div>
      </footer>
    </main>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-slate-900">{children}</div>
    </div>
  );
}

function StatusPill({ tone, children }: { tone: "rose" | "amber" | "emerald"; children: React.ReactNode }) {
  const map = {
    rose: "bg-rose-500/10 text-rose-200 ring-rose-400/40",
    amber: "bg-amber-500/10 text-amber-200 ring-amber-400/40",
    emerald: "bg-emerald-500/10 text-emerald-200 ring-emerald-400/40",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${map[tone]}`}>
      {children}
    </span>
  );
}

function Timeline({ visits }: { visits: Array<{ date: string; techName: string; summary: string; actionsTaken: string[] }> }) {
  return (
    <ol className="relative space-y-4 border-l-2 border-slate-200 pl-5 sm:pl-6">
      {visits.map((v, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[26px] top-1 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-slate-400 ring-2 ring-slate-200 sm:-left-[29px]" />
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-500">{v.date}</span>
              <span className="text-sm font-semibold text-slate-900">{v.techName}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                Visit {i + 1}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{v.summary}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {v.actionsTaken.map((a, j) => (
                <span key={j} className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200">
                  {a}
                </span>
              ))}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
