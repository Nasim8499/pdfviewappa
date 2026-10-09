import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  ScanLine, Upload, Loader2, Save, FileText, Trash2, ClipboardCheck, Camera, FilePlus2,
} from "lucide-react";
import { AppShell } from "../components/AppShell";
import { getApplicant, savePassportData, uploadDocument, deleteDocument, fetchFile } from "../lib/api";
import { fileToBase64, ocrImage, parsePassportMrz, pdfExtractText, sha256Hex, fmtDate, statusChip, useMe } from "../lib/client";

export const Route = createFileRoute("/applicants/$id")({
  beforeLoad: async () => {
    const { me } = await import("../lib/api");
    if (!(await me())) throw redirect({ to: "/login" });
  },
  component: ApplicantDetail,
});

const PASSPORT_FIELDS: { key: string; label: string }[] = [
  { key: "surname", label: "Surname" },
  { key: "givenNames", label: "Given names" },
  { key: "passportNo", label: "Passport no." },
  { key: "nationality", label: "Nationality" },
  { key: "dob", label: "Date of birth" },
  { key: "sex", label: "Sex" },
  { key: "expiryDate", label: "Expiry date" },
];

function ApplicantDetail() {
  const { id } = Route.useParams();
  const applicantId = Number(id);
  const qc = useQueryClient();
  const meQuery = useMe();
  const isAdmin = meQuery.data?.role === "admin";

  const data = useQuery({ queryKey: ["applicant", applicantId], queryFn: () => getApplicant({ data: { id: applicantId } }) });

  const [fields, setFields] = useState<Record<string, string> | null>(null);
  const [ocrPct, setOcrPct] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const passportRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  const applicant = data.data?.applicant;
  const saved = (fields ?? (applicant?.passport_data as Record<string, string> | undefined)) ?? {};

  const runOcr = async (file: File) => {
    setMsg(null);
    setOcrPct(0);
    try {
      const text = await ocrImage(file, setOcrPct);
      const parsed = parsePassportMrz(text);
      if (Object.keys(parsed).length === 0) {
        setMsg("OCR finished but no passport MRZ lines were found — enter the details manually.");
      }
      setFields({ ...saved, ...parsed });
      // Keep the scanned passport image itself as an applicant document.
      await uploadDocument({
        data: {
          title: `Passport scan — ${file.name}`,
          mime: file.type || "image/jpeg",
          size: file.size,
          sha256: await sha256Hex(file),
          base64: await fileToBase64(file),
          kind: "applicant",
          category: "passport",
          applicantId,
          text,
        },
      });
      await qc.invalidateQueries({ queryKey: ["applicant", applicantId] });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "OCR failed");
    } finally {
      setOcrPct(null);
      if (passportRef.current) passportRef.current.value = "";
    }
  };

  const saveFields = async () => {
    if (!fields) return;
    setMsg(null);
    try {
      await savePassportData({ data: { applicantId, data: fields } });
      setMsg("Passport details saved.");
      await qc.invalidateQueries({ queryKey: ["applicant", applicantId] });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    }
  };

  const openForm = () => {
    sessionStorage.setItem("visaPrefill", JSON.stringify(saved));
    window.location.assign("/visa-assistant.html");
  };

  const uploadDoc = async (file: File) => {
    if (!isAdmin) return;
    setMsg(null);
    setOcrPct(0);
    try {
      let text = "";
      if (file.type === "application/pdf" && file.size < 10_000_000) {
        try {
          text = await pdfExtractText(file);
        } catch {
          text = "";
        }
      }
      await uploadDocument({
        data: {
          title: file.name,
          mime: file.type || "application/octet-stream",
          size: file.size,
          sha256: await sha256Hex(file),
          base64: await fileToBase64(file),
          kind: "applicant",
          category: "other",
          applicantId,
          text,
        },
      });
      await qc.invalidateQueries({ queryKey: ["applicant", applicantId] });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setOcrPct(null);
      if (docRef.current) docRef.current.value = "";
    }
  };

  const removeDoc = async (docId: number) => {
    await deleteDocument({ data: { id: docId } });
    await qc.invalidateQueries({ queryKey: ["applicant", applicantId] });
  };

  const preview = async (docId: number, driveLink?: string | null) => {
    if (driveLink) {
      window.open(driveLink, "_blank");
      return;
    }
    try {
      const file = await fetchFile({ data: { id: docId } });
      if (!file.base64) return;
      const blob = new Blob([Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0))], {
        type: file.mime ?? "application/octet-stream",
      });
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Preview failed");
    }
  };

  if (data.isLoading) {
    return (
      <AppShell title="Applicant">
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={applicant?.name ?? "Applicant"}>
      <Link to="/applicants" className="mb-3 inline-block text-xs font-semibold text-indigo-600">
        ← All applicants
      </Link>

      {/* Step 1 — capture passport, on-device OCR */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-bold text-indigo-700">
          <ScanLine className="h-5 w-5" /> 1 · Passport scan (on-device OCR)
        </div>
        <input
          ref={passportRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && runOcr(e.target.files[0])}
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => isAdmin && passportRef.current?.click()}
            disabled={!isAdmin || ocrPct !== null}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {ocrPct !== null ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />} Upload
          </button>
          <button
            onClick={() => isAdmin && passportRef.current?.click()}
            disabled={!isAdmin || ocrPct !== null}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-indigo-600 py-3 text-sm font-bold text-indigo-600 disabled:opacity-50"
          >
            <Camera className="h-5 w-5" /> Camera
          </button>
        </div>
        {ocrPct !== null && (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${ocrPct}%` }} />
            </div>
            <p className="mt-1 text-center text-xs text-slate-500">Reading passport… {ocrPct}%</p>
          </div>
        )}

        {ocrPct === null && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {PASSPORT_FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{f.label}</span>
                  <input
                    value={saved[f.key] ?? ""}
                    onChange={(e) => setFields({ ...saved, [f.key]: e.target.value })}
                    readOnly={!isAdmin}
                    className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-indigo-500"
                  />
                </label>
              ))}
            </div>
            {isAdmin && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={saveFields}
                  className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white"
                >
                  <Save className="h-4 w-4" /> Save
                </button>
                <button
                  onClick={openForm}
                  className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white"
                >
                  <ClipboardCheck className="h-4 w-4" /> Fill visa form
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {msg && <p className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-center text-xs text-slate-600">{msg}</p>}

      {/* Step 2 — applicant documents */}
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-bold text-emerald-700">
          <FilePlus2 className="h-5 w-5" /> 2 · Applicant documents
        </div>
        <input
          ref={docRef}
          type="file"
          accept=".pdf,image/*,.doc,.docx"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && uploadDoc(e.target.files[0])}
        />
        {isAdmin && (
          <button
            onClick={() => docRef.current?.click()}
            disabled={ocrPct !== null}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            <Upload className="h-5 w-5" /> Upload document
          </button>
        )}
        <div className="mt-3 space-y-2">
          {(data.data?.documents ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">
              No documents yet.
            </p>
          ) : (
            (data.data?.documents ?? []).map((doc) => {
              const chip = statusChip(doc.status);
              return (
                <div key={doc.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-900">{doc.title}</p>
                    <p className="text-[10px] text-slate-500">
                      {doc.category} · {fmtDate(doc.created_at)} ·{" "}
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${chip.cls}`}>
                        {chip.label}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => preview(doc.id, doc.drive_link)}
                    className="text-xs font-bold text-indigo-600"
                  >
                    Open
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => removeDoc(doc.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </AppShell>
  );
}
