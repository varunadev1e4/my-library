-- Run once in Supabase > SQL Editor (after migration-v4.sql).
alter table public.books add column if not exists isbn text not null default '';
alter table public.books add column if not exists binding text not null default '';
alter table public.books add column if not exists series text not null default '';
alter table public.books add column if not exists shelves jsonb not null default '[]'::jsonb;
alter table public.books add column if not exists read_count int not null default 0;
alter table public.books add column if not exists goodreads_id text not null default '';
