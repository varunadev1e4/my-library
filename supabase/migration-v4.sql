-- Run once in Supabase > SQL Editor (after migration-v3.sql).
create table if not exists public.journal (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  day date not null default current_date,
  book_id uuid references public.books(id) on delete set null,
  book_title text not null default '',   -- kept even if the book is later deleted
  pages int,                              -- pages read that day
  page_now int,                           -- page you reached
  text text not null default ''
);
create index if not exists journal_day_idx on public.journal (day desc);
alter table public.journal enable row level security; -- no policies: only the API can touch it
