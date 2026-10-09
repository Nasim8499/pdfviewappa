import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { UserPlus, Users, FileText, Loader2 } from "lucide-react";
import { AppShell } from "../../components/AppShell";
import { listApplicants, createApplicant } from "../../lib/api";
import { fmtDate, useMe } from "../../lib/client";

export const Route = createFileRoute("/applicants/")({
  beforeLoad: async () => {
    const { me } = await import("../../lib/api");
    if (!(await me())) throw redirect({ to: "/login" });
  },
  component: Applicants,
});

function Applicants() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const meQuery = useMe();
  const isAdmin = meQuery.data?.role === "admin";
  const applicants = useQuery({ queryKey: ["applicants"], queryFn: () => listApplicants() });
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const row = await createApplicant({ data: { name: name.trim(), country: country.trim() } });
      setName("");
      setCountry("");
      await qc.invalidateQueries({ queryKey: ["applicants"] });
      if (row?.id) navigate({ to: "/applicants/$id", params: { id: String(row.id) } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="Applicants">
      {isAdmin && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-700">
            <UserPlus className="h-5 w-5" /> Add applicant
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="rounded-xl border-2 border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
            />
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Visa country"
              className="rounded-xl border-2 border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
            />
            <button
              onClick={create}
              disabled={busy || !name.trim()}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50"
            >
              {busy && <Loader2 className="h-5 w-5 animate-spin" />} Create & open
            </button>
          </div>
        </div>
      )}

      {(applicants.data ?? []).length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
          No applicants yet.
        </p>
      ) : (
        <div className="space-y-2">
          {(applicants.data ?? []).map((a) => (
            <Link
              key={a.id}
              to="/applicants/$id"
              params={{ id: String(a.id) }}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Users className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{a.name}</p>
                <p className="text-xs text-slate-500">
                  {a.country || "—"} · {a.doc_count} documents · {fmtDate(a.created_at)}
                </p>
              </div>
              <FileText className="h-4 w-4 shrink-0 text-slate-300" />
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
