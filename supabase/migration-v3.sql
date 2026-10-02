-- Run once in Supabase > SQL Editor (after schema.sql / migration-v2.sql).
alter table public.books add column if not exists location text not null default '';
alter table public.books add column if not exists started_on date;
alter table public.books add column if not exists current_page int;
alter table public.books add column if not exists priority text not null default '';
alter table public.books add column if not exists recommended_by text not null default '';
alter table public.books add column if not exists quotes jsonb not null default '[]'::jsonb;

create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb
);
alter table public.settings enable row level security; -- no policies: only the API can touch it
