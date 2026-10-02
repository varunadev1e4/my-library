create extension if not exists "pgcrypto";

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  author text not null default '',
  cover text not null default '',
  year int,
  publisher text not null default '',
  blurb text not null default '',
  genre text not null default 'Fiction',
  rating int not null default 0 check (rating between 0 and 5),
  status text not null default 'read' check (status in ('read','reading','to_read')),
  notes text not null default '',
  -- lending history: [{ "to": "Ravi", "on": "2026-10-02", "returned": null | "2026-10-20" }]
  loans jsonb not null default '[]'::jsonb
);

-- Lock the table: no policies = the public anon key can do nothing.
-- Only the Vercel API (service role key, after PIN check) can read/write.
alter table public.books enable row level security;

-- v2 columns (safe to re-run)
alter table public.books add column if not exists pages int;
alter table public.books add column if not exists language text not null default 'English';
alter table public.books add column if not exists finished_on date;
