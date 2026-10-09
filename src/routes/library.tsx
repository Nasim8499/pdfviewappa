import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { CloudUpload, Trash2, Link2, CloudOff, Loader2 } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { driveStatus, listDocuments, uploadDocument, deleteDocument } from "../lib/api";
import { fileToBase64, pdfExtractText, sha256Hex, fmtDate, statusChip, useMe } from "../lib/client";

export const Route = createFileRoute("/library")({
  beforeLoad: async () => {
    const { me } = await import("../lib/api");
    if (!(await me())) throw redirect({ to: "/login" });
  },
  component: Library,
});

const COUNTRIES = ["Schengen", "Singapore", "New Zealand", "Malta", "Moldova", "Myanmar", "Other"];

function Library() {
  const qc = useQueryClient();
  const meQuery = useMe();
  const isAdmin = meQuery.data?.role === "admin";
  const drive = useQuery({ queryKey: ["drive"], queryFn: () => driveStatus() });
  const docs = useQuery({ queryKey: ["docs"], queryFn: () => listDocuments() });
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const libraryDocs = (docs.data ?? []).filter((d) => d.kind === "library");

  const upload = async (file: File) => {
    if (!isAdmin) return;
    setBusy(`Uploading ${file.name}…`);
    setMsg(null);
    try {
      let text = "";
      if (file.type === "application/pdf" && file.size < 10_000_000) {
        try {
          text = await pdfExtractText(file);
        } catch {
          text = "";
        }
      }
      const res = await uploadDocument({
        data: {
          title: file.name,
          mime: file.type || "application/octet-stream",
          size: file.size,
          sha256: await sha256Hex(file),
          base64: await fileToBase64(file),
          kind: "library",
          country,
          text,
        },
      });
      if (res.duplicate) setMsg("Already in the library — skipped duplicate.");
      else setMsg(res.status === "drive" ? "Stored in Google Drive." : "Stored locally (Drive not connected yet).");
      await qc.invalidateQueries({ queryKey: ["docs"] });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (id: number) => {
    if (!isAdmin) return;
    await deleteDocument({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["docs"] });
  };

  const grouped = COUNTRIES.filter((c) => libraryDocs.some((d) => d.country === c));

  return (
    <AppShell title="Document Library">
      <div
        className={`mb-4 flex items-center gap-2 rounded-2xl border p-3 text-sm ${
          drive.data?.configured
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-amber-200 bg-amber-50 text-amber-700"
        }`}
      >
        {drive.data?.configured ? <Link2 className="h-5 w-5" /> : <CloudOff className="h-5 w-5" />}
        {drive.data?.configured
          ? "Google Drive connected — files are stored there."
          : "Google Drive not connected yet — files are kept locally until you add credentials."}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {COUNTRIES.map((c) => (
          <button
            key={c}
            onClick={() => setCountry(c)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
              country === c ? "border-amber-500 bg-amber-100 text-amber-700" : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {isAdmin && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.gdoc"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={!!busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-4 text-base font-bold text-white disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CloudUpload className="h-6 w-6" />}
            {busy ?? `Upload to ${country}`}
          </button>
        </>
      )}

      {msg && <p className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-center text-xs text-slate-600">{msg}</p>}

      {grouped.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
          No library documents yet.
        </p>
      )}

      {grouped.map((c) => (
        <section key={c} className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">{c}</h2>
          <div className="space-y-2">
            {libraryDocs
              .filter((d) => d.country === c)
              .map((doc) => {
                const chip = statusChip(doc.status);
                return (
                  <div key={doc.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{doc.title}</p>
                      <p className="text-xs text-slate-500">
                        {fmtDate(doc.created_at)} ·{" "}
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${chip.cls}`}>
                          {chip.label}
                        </span>
                      </p>
                    </div>
                    {doc.drive_link && (
                      <a
                        href={doc.drive_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-indigo-600"
                      >
                        Drive
                      </a>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => remove(doc.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Delete document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </AppShell>
  );
}
