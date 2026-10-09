// Applies the database schema. Idempotent — safe to run on every boot.
import postgres from "postgres";

const sql = postgres(
  process.env.DATABASE_URL ?? "postgres://visa:visa_dev_pw@postgres:5432/visa",
  { max: 1 },
);

await sql.unsafe(`
create table if not exists applicants (
  id serial primary key,
  name text not null,
  country text not null default '',
  status text not null default 'in_progress',
  passport_data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id serial primary key,
  applicant_id integer references applicants(id) on delete cascade,
  kind text not null,                       -- 'library' | 'applicant'
  category text not null default 'other',   -- 'passport' | 'form' | 'other'
  country text not null default '',
  title text not null,
  drive_file_id text,
  drive_link text,
  mime text not null default 'application/pdf',
  size integer not null default 0,
  sha256 text not null default '',
  status text not null default 'ready',     -- 'drive' | 'local'
  file_data bytea,
  text_content text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists documents_library_sha on documents (sha256) where kind = 'library';
create index if not exists documents_applicant_idx on documents (applicant_id);
`);

await sql.end();
console.log("migrations applied");
