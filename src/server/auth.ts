// Signed-cookie role sessions. Two roles only: admin (full control) and agent (read-only).
export type Role = "admin" | "agent";

function secret() {
  return process.env.SESSION_SECRET || "dev-insecure-session-secret";
}

export async function issueToken(role: Role): Promise<string> {
  const { createHmac } = await import("node:crypto");
  const exp = Date.now() + 30 * 24 * 3600 * 1000;
  const payload = `${role}:${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}:${sig}`;
}

export async function verifyToken(token: string | undefined): Promise<Role | null> {
  if (!token) return null;
  const parts = token.split(":");
  if (parts.length !== 3) return null;
  const [role, expRaw, sig] = parts;
  if (role !== "admin" && role !== "agent") return null;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = createHmac("sha256", secret()).update(`${role}:${expRaw}`).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return role;
}

export async function checkAccessCode(role: Role, code: string): Promise<boolean> {
  const expected = role === "admin" ? process.env.ADMIN_ACCESS_CODE : process.env.AGENT_ACCESS_CODE;
  if (!expected) return false;
  return code === expected;
}

export const SESSION_COOKIE = "vsession";
