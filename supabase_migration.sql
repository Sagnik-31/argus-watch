-- ══════════════════════════════════════════
-- ARGUS Proctoring System — Supabase Tables
-- Run this in Supabase SQL Editor
-- ══════════════════════════════════════════

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ── TABLE 1: exam_sessions ──
create table if not exists exam_sessions (
  id uuid primary key default uuid_generate_v4(),
  student_name text not null,
  exam_code text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  suspicion_score integer default 0,
  total_flags integer default 0,
  verdict text,
  ai_report text,
  reference_snapshot text,
  created_at timestamptz default now()
);

-- ── TABLE 2: flags ──
create table if not exists flags (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references exam_sessions(id) on delete cascade,
  flag_type text not null,
  detail text,
  timestamp timestamptz not null default now(),
  elapsed_seconds integer,
  snapshot_url text,
  created_at timestamptz default now()
);

-- ── TABLE 3: snapshots ──
create table if not exists snapshots (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references exam_sessions(id) on delete cascade,
  image_data text,
  captured_at timestamptz not null default now(),
  elapsed_seconds integer,
  reason text,
  created_at timestamptz default now()
);

-- ── Indexes for performance ──
create index if not exists idx_flags_session_id on flags(session_id);
create index if not exists idx_snapshots_session_id on snapshots(session_id);
create index if not exists idx_exam_sessions_exam_code on exam_sessions(exam_code);
create index if not exists idx_exam_sessions_student on exam_sessions(student_name);

-- ── Disable RLS for hackathon (open access) ──
alter table exam_sessions enable row level security;
alter table flags enable row level security;
alter table snapshots enable row level security;

-- Allow all operations from anon/authenticated
create policy "Allow all on exam_sessions" on exam_sessions for all using (true) with check (true);
create policy "Allow all on flags" on flags for all using (true) with check (true);
create policy "Allow all on snapshots" on snapshots for all using (true) with check (true);

-- ── Enable Realtime for flags table ──
alter publication supabase_realtime add table flags;
alter publication supabase_realtime add table exam_sessions;
