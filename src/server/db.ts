import postgres from "postgres";

let _db: ReturnType<typeof postgres> | null = null;

/** Lazily-created shared Postgres client (server-only — import dynamically inside server fns). */
export function db() {
  if (!_db) {
    _db = postgres(
      process.env.DATABASE_URL ?? "postgres://visa:visa_dev_pw@postgres:5432/visa",
      { max: 5 },
    );
  }
  return _db;
}
