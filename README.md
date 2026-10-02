# My Library

Personal library + read list. React (Vite) frontend, Vercel serverless API, Supabase Postgres.
One 6-digit PIN, checked on the server, works on every device.

## How the PIN stays secure
- The `books` table has Row Level Security on with **no policies**, so the public Supabase key can't read or write anything.
- The browser never talks to Supabase. It calls `/api/books` with your PIN in a header. The API compares it to `LIBRARY_PIN`, then uses the service-role key.
- Each device remembers the PIN in `localStorage` after the first unlock (tap **Lock** to forget it). A wrong guess is delayed 1 second.

## Setup (about 10 minutes)
1. **Supabase**: create a project, open SQL Editor, paste and run `supabase/schema.sql`.
   Then Project Settings > API: copy the **Project URL** and the **service_role** key (keep it secret).
2. **GitHub**: push this folder to a new private repo.
3. **Vercel**: Import the repo (Framework: Vite). Add three Environment Variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `LIBRARY_PIN` (your 6 digits)
   Deploy. Open the URL on laptop and phone, enter the PIN.
4. Tap **Add books > Paste a list** and paste your 150+ titles (one per line, `Title - Author`). Covers and years are fetched from Open Library.

## Run locally
```
npm install
cp .env.example .env.local   # fill in the values
npx vercel dev               # runs the site and /api together
```
(`npm run dev` alone serves only the frontend; the API needs `vercel dev`.)

## Changing the PIN
Edit `LIBRARY_PIN` in Vercel and redeploy. Devices will ask for the new PIN on next load.

## Upgrading from the first version
Run `supabase/migration-v2.sql` once in the Supabase SQL Editor (adds pages, language, finished date), then `git push`.

## What you get
- 3D horizontal shelf (wheel/drag to scroll, hover pulls a book out), click for the detail view, arrow keys to flip between books
- Shelves: All, Read, Reading, To read, Lent out. Genre pills and search (title, author, notes, borrower)
- Lending: who has it, since when, mark returned, full history per book
- Rating, notes, status and genre editable per book
- Due dates on loans (default 2 weeks), overdue badges, extend by 7 days, one-tap WhatsApp reminder to the borrower (saves their number for next time)
- Stats: genre, language, finished per year, top borrowers, most-lent books, average rating, pages read
- Sort by title, author, recently added, rating, date finished or due date; Shelf view or Grid view (better on phones)
- Edit title, author, language, pages, year, finished date, publisher and cover URL on any book
- Duplicate check when adding (single and pasted list)
- Pick my next read (random from your read list)
- Export CSV and Backup JSON
