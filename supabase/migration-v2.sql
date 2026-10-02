-- Run once in Supabase SQL Editor if you already ran schema.sql earlier.
alter table public.books add column if not exists pages int;
alter table public.books add column if not exists language text not null default 'English';
alter table public.books add column if not exists finished_on date;
