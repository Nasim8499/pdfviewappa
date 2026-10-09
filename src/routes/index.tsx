import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, ScanLine, FolderPlus, FileText } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { StepFlow } from "../components/StepFlow";
import { listDocuments, searchDocuments } from "../lib/api";
import { fmtDate, statusChip, useMe } from "../lib/client";
import type { DocRow } from "../lib/api";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { me } = await import("../lib/api");
    if (!(await me())) throw redirect({ to: "/login" });
  },
  component: Dashboard,
});

function DocCard({ doc, snippet }: { doc: DocRow; snippet?: string | null }) {
  const chip = statusChip(doc.status);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{doc.title}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {doc.kind === "library" ? `Library · ${doc.country || "General"}` : `Applicant · ${doc.applicant_name ?? ""}`}
            {" · "}
            {fmtDate(doc.created_at)}
          </p>
          {snippet && <p className="mt-2 line-clamp-2 rounded-lg bg-slate-50 px-2 py-1 text-xs italic text-slate-600">{snippet}</p>}
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${chip.cls}`}>{chip.label}</span>
      </div>
    </div>
  );
}

function Dashboard() {
  const [q, setQ] = useState("");
  const meQuery = useMe();
  const isAdmin = meQuery.data?.role === "admin";

  const recent = useQuery({ queryKey: ["docs"], queryFn: () => listDocuments() });
  const search = useQuery({
    queryKey: ["search", q],
    queryFn: () => searchDocuments({ data: { q } }),
    enabled: q.trim().length > 1,
  });

  const results = q.trim().length > 1 ? search.data ?? [] : recent.data ?? [];

  return (
    <AppShell title="Visa Desk">
      <div className="sticky top-16 z-10 -mx-4 mb-4 bg-slate-50 px-4 pb-2 pt-1">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search document contents…"
            className="w-full rounded-2xl border-2 border-slate-200 bg-white py-3 pl-12 pr-4 text-base outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <StepFlow
        steps={[
          { icon: <ScanLine className="text-indigo-600" />, label: "Scan passport", to: "/applicants" },
          { icon: <FolderPlus className="text-amber-600" />, label: "Add documents", to: "/library" },
          { icon: <FileText className="text-rose-600" />, label: "Fill visa form", to: "/form" },
        ]}
      />

      <h2 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wide text-slate-500">
        {q.trim().length > 1 ? `Results (${results.length})` : "Recent documents"}
      </h2>

      {results.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
          {q.trim().length > 1 ? "No documents match that keyword yet." : "No documents yet."}
        </p>
      ) : (
        <div className="space-y-2">
          {results.map((doc) => (
            <DocCard key={doc.id} doc={doc} snippet={"snippet" in doc ? doc.snippet : undefined} />
          ))}
        </div>
      )}

      {!isAdmin && (
        <p className="mt-6 rounded-xl bg-slate-100 px-4 py-3 text-center text-xs text-slate-500">
          Agent view — documents are read-only
        </p>
      )}
    </AppShell>
  );
}
