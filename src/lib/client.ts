import { useQuery } from "@tanstack/react-query";
import { me } from "./api";

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => me() });
}

const scriptCache = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
  let cached = scriptCache.get(src);
  if (!cached) {
    cached = new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(el);
    });
    scriptCache.set(src, cached);
  }
  return cached;
}

/** Extracts embedded text from a PDF in the browser (pdf.js, on-device). */
export async function pdfExtractText(file: File): Promise<string> {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
  const pdfjsLib = (window as unknown as { pdfjsLib: any }).pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = "";
  const pages = Math.min(pdf.numPages, 30);
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: { str?: string }) => it.str ?? "").join(" ") + "\n";
  }
  return text.trim();
}

/** Runs Tesseract.js OCR entirely on-device (no upload to any cloud service). */
export async function ocrImage(
  file: Blob,
  onProgress?: (pct: number) => void,
): Promise<string> {
  await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
  const Tesseract = (window as unknown as { Tesseract: any }).Tesseract;
  const { data } = await Tesseract.recognize(file, "eng", {
    logger: (m: { status?: string; progress?: number }) => {
      if (m.progress != null) onProgress?.(Math.round(m.progress * 100));
    },
  });
  return data.text as string;
}

/** Parses the two MRZ lines (TD3) of a passport from OCR text. */
export function parsePassportMrz(text: string): Record<string, string> {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/[^A-Za-z0-9<]/g, "").toUpperCase())
    .filter((l) => l.length >= 20);
  const start = lines.findIndex((l) => l.startsWith("P<"));
  if (start === -1 || start + 1 >= lines.length) return {};
  const l1 = lines[start];
  const l2 = lines[start + 1];
  const out: Record<string, string> = {};

  const namePart = l1.slice(5);
  const [surname, given] = namePart.split("<<");
  if (surname) out.surname = surname.replace(/</g, " ").trim();
  if (given) out.givenNames = given.replace(/</g, " ").trim();

  const passportNo = l2.slice(0, 9).replace(/</g, "");
  if (passportNo) out.passportNo = passportNo;
  const nationality = l2.slice(10, 13).replace(/</g, "");
  if (nationality) out.nationality = nationality;

  const toDate = (yy: string, dob: boolean) => {
    const n = Number(yy.slice(0, 2));
    const century = dob ? (n >= 30 ? 19 : 20) : n < 70 ? 20 : 19;
    return `${century}${yy.slice(0, 2)}-${yy.slice(2, 4)}-${yy.slice(4, 6)}`;
  };
  const dob = l2.slice(13, 19);
  if (/^\d{6}$/.test(dob)) out.dob = toDate(dob, true);
  const sex = l2.slice(20, 21);
  if (sex === "M" || sex === "F") out.sex = sex === "M" ? "Male" : "Female";
  const expiry = l2.slice(21, 27);
  if (/^\d{6}$/.test(expiry)) out.expiryDate = toDate(expiry, false);
  return out;
}

export async function sha256Hex(file: Blob): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function statusChip(status: string): { label: string; cls: string } {
  return status === "drive"
    ? { label: "Drive", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" }
    : { label: "Local", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" };
}
