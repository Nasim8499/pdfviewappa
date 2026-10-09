import { createServerFn } from "@tanstack/react-start";
import type { Role } from "../server/auth";

// All server-only modules are imported dynamically inside handlers so the
// client bundle never pulls them in (server-fn handler bodies are stripped
// from the client build).

export type AppRole = Role;

export const login = createServerFn({ method: "POST" })
  .validator((data: { role: Role; code: string }) => data)
  .handler(async ({ data }) => {
    const { checkAccessCode, issueToken, SESSION_COOKIE } = await import("../server/auth");
    const { setCookie } = await import("@tanstack/react-start/server");
    if (!(await checkAccessCode(data.role, data.code))) {
      return { ok: false as const, error: "wrong-code" };
    }
    setCookie(SESSION_COOKIE, await issueToken(data.role), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 3600,
    });
    return { ok: true as const, role: data.role };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { SESSION_COOKIE } = await import("../server/auth");
  const { setCookie } = await import("@tanstack/react-start/server");
  setCookie(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return { ok: true };
});

export const me = createServerFn({ method: "GET" }).handler(async () => {
  const { verifyToken, SESSION_COOKIE } = await import("../server/auth");
  const { getCookie } = await import("@tanstack/react-start/server");
  const role = await verifyToken(getCookie(SESSION_COOKIE));
  return role ? { role } : null;
});

/** Throws for non-admin callers — server-side authorization, not just hidden UI. */
async function requireAdmin() {
  const { verifyToken, SESSION_COOKIE } = await import("../server/auth");
  const { getCookie } = await import("@tanstack/react-start/server");
  const role = await verifyToken(getCookie(SESSION_COOKIE));
  if (!role) throw new Error("Please sign in first");
  if (role !== "admin") throw new Error("Only the administrator can do this");
  return role;
}

async function currentRole(): Promise<Role | null> {
  const { verifyToken, SESSION_COOKIE } = await import("../server/auth");
  const { getCookie } = await import("@tanstack/react-start/server");
  return verifyToken(getCookie(SESSION_COOKIE));
}

export const driveStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { driveConfigured } = await import("../server/drive");
  return { configured: driveConfigured() };
});

export const listApplicants = createServerFn({ method: "GET" }).handler(async () => {
  if (!(await currentRole())) throw new Error("Please sign in first");
  const { db } = await import("../server/db");
  return db()`select a.id, a.name, a.country, a.status, a.passport_data, a.created_at,
    (select count(*) from documents d where d.applicant_id = a.id)::int as doc_count
    from applicants a order by a.created_at desc`;
});

export const createApplicant = createServerFn({ method: "POST" })
  .validator((data: { name: string; country: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { db } = await import("../server/db");
    const [row] = await db()`insert into applicants (name, country) values (${data.name}, ${data.country}) returning id, name, country`;
    return row;
  });

export const getApplicant = createServerFn({ method: "GET" })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    if (!(await currentRole())) throw new Error("Please sign in first");
    const { db } = await import("../server/db");
    const [applicant] = await db()`select * from applicants where id = ${data.id}`;
    if (!applicant) throw new Error("Applicant not found");
    const documents = await db()`select id, kind, category, country, title, drive_file_id, drive_link,
      mime, size, status, created_at, length(text_content)::int as has_text
      from documents where applicant_id = ${data.id} order by created_at desc`;
    return { applicant, documents };
  });

export const savePassportData = createServerFn({ method: "POST" })
  .validator((data: { applicantId: number; data: Record<string, string> }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { db } = await import("../server/db");
    await db()`update applicants set passport_data = ${JSON.stringify(data.data)}::jsonb where id = ${data.applicantId}`;
    return { ok: true };
  });

export type DocRow = {
  id: number;
  applicant_id: number | null;
  applicant_name: string | null;
  kind: string;
  category: string;
  country: string;
  title: string;
  drive_file_id: string | null;
  drive_link: string | null;
  mime: string;
  size: number;
  status: string;
  created_at: string;
};

export const listDocuments = createServerFn({ method: "GET" }).handler(async () => {
  if (!(await currentRole())) throw new Error("Please sign in first");
  const { db } = await import("../server/db");
  return db()`select d.id, d.applicant_id, d.kind, d.category, d.country, d.title, d.drive_file_id,
    d.drive_link, d.mime, d.size, d.status, d.created_at, a.name as applicant_name
    from documents d left join applicants a on a.id = d.applicant_id
    order by d.created_at desc`;
});

export const searchDocuments = createServerFn({ method: "GET" })
  .validator((data: { q: string }) => data)
  .handler(async ({ data }) => {
    if (!(await currentRole())) throw new Error("Please sign in first");
    const { db } = await import("../server/db");
    const q = data.q.trim();
    if (!q) return [];
    const pattern = `%${q}%`;
    const rows = await db()`select d.id, d.applicant_id, d.kind, d.category, d.country, d.title,
      d.drive_file_id, d.drive_link, d.mime, d.size, d.status, d.created_at,
      a.name as applicant_name, d.text_content
      from documents d left join applicants a on a.id = d.applicant_id
      where d.title ilike ${pattern} or d.text_content ilike ${pattern}
      order by d.created_at desc limit 50`;
    return rows.map((r: any) => {
      const idx = r.text_content ? r.text_content.toLowerCase().indexOf(q.toLowerCase()) : -1;
      const snippet =
        idx >= 0
          ? "…" + r.text_content.slice(Math.max(0, idx - 40), idx + q.length + 80).replace(/\s+/g, " ") + "…"
          : null;
      const { text_content, ...rest } = r;
      return { ...rest, snippet };
    });
  });

export const uploadDocument = createServerFn({ method: "POST" })
  .validator((data: {
    title: string;
    mime: string;
    size: number;
    sha256: string;
    base64: string;
    kind: "library" | "applicant";
    category?: string;
    country?: string;
    applicantId?: number | null;
    text?: string;
  }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    if (data.base64.length > 13_000_000) throw new Error("File is too large (max ~9 MB)");

    const { db } = await import("../server/db");
    const { uploadToDrive, driveConfigured } = await import("../server/drive");

    // Canonical reference library: one copy per identical file.
    if (data.kind === "library") {
      const [existing] = await db()`select id from documents where kind = 'library' and sha256 = ${data.sha256}`;
      if (existing) return { duplicate: true as const, id: existing.id };
    }

    const stored = await uploadToDrive(data.title, data.mime, data.base64);
    const fileData = stored ? Buffer.from(data.base64, "base64") : null;
    const [row] = await db()`insert into documents
      (applicant_id, kind, category, country, title, drive_file_id, drive_link, mime, size, sha256, status, file_data, text_content)
      values (${data.applicantId ?? null}, ${data.kind}, ${data.category ?? "other"}, ${data.country ?? ""},
        ${data.title}, ${stored?.id ?? null}, ${stored?.link ?? null}, ${data.mime}, ${data.size},
        ${data.sha256}, ${stored ? "drive" : "local"}, ${fileData}, ${data.text ?? ""})
      returning id, status`;
    return { duplicate: false as const, id: row.id, status: row.status, drive: driveConfigured() };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { db } = await import("../server/db");
    const [row] = await db()`select drive_file_id from documents where id = ${data.id}`;
    if (row?.drive_file_id) {
      const { getAccessToken } = await import("../server/drive");
      const token = await getAccessToken();
      if (token) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${row.drive_file_id}`, {
          method: "DELETE",
          headers: { authorization: `Bearer ${token}` },
        }).catch(() => undefined);
      }
    }
    await db()`delete from documents where id = ${data.id}`;
    return { ok: true };
  });

export const fetchFile = createServerFn({ method: "GET" })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    if (!(await currentRole())) throw new Error("Please sign in first");
    const { db } = await import("../server/db");
    const [row] = await db()`select title, mime, drive_file_id, file_data from documents where id = ${data.id}`;
    if (!row) throw new Error("Document not found");
    if (row.file_data) {
      return { title: row.title, mime: row.mime, base64: Buffer.from(row.file_data).toString("base64") };
    }
    if (row.drive_file_id) {
      const { downloadFromDrive } = await import("../server/drive");
      const base64 = await downloadFromDrive(row.drive_file_id);
      if (base64) return { title: row.title, mime: row.mime, base64 };
      return { title: row.title, mime: null, base64: null, driveLink: row.drive_link };
    }
    throw new Error("No stored file for this document");
  });
