# Cali Pro

A mobile-first PWA for calisthenics athletes: build training programs, design
mesocycles from an exercise library, and track workouts on a calendar.

## Features

- **Create a program**: full body, split (straight/bent arm, push/pull,
  upper/lower) or mixed with a sport (sport days are scheduled around).
- **Skills are exercises**: the admin marks an exercise with the `skill`
  attribute (front lever, planche, …); athletes add skill work to their
  workouts from the library, and each progression carries its own description.
- **Periodization**: none (same workout every training day), Daily Undulating,
  or High–Low — with day-level high/low volume highlights in the designer.
- **Mesocycle designer**: 6–8 weeks (last week deload), per-day exercise
  plans prefilled from admin defaults, per-set reps + optional weight + rest,
  intra/inter-exercise progression methods, copy day / copy week.
- **Tracking**: calendar of sessions, workout logging, and last-volume memory
  for intra-exercise progression (remembers weight, sets, per-set reps).
- **Runs**: repeat a finished program as many times as you like.
- **Admin area**: manage the exercise library (unique titles, per-progression
  descriptions), recommended defaults, and inter-exercise progression
  techniques.

## Development

```bash
npm install
npm run dev        # local JSON database (data/db.json), auto-seeded
```

You are signed in as a dev athlete automatically. Enable **admin mode** in
Settings to open the admin area.

```bash
npm test           # vitest domain tests
npm run test:e2e   # playwright wizard smoke test (kill `npm run dev` first)
npm run lint
npm run typecheck
npm run db:reset   # wipe + reseed the local JSON database
npm run export-seed  # regenerate supabase/seed.sql from data/db.json
```

## Production (Supabase)

The project is wired to the "Overcoming Gravity" Supabase project (schema +
content seed already applied). Env vars (see `.env.example` / `.env.local`):

| Variable | Value |
| --- | --- |
| `DATA_BACKEND` | `supabase` (defaults to `supabase` in production builds, `json` in dev) |
| `NEXT_PUBLIC_SUPABASE_URL` | the project's API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the publishable (anon) key |

Every signup is a **normal user** (`profiles.is_admin` defaults to `false`).
Grant admin manually:

```sql
update public.profiles set is_admin = true where email = 'you@example.com';
```

To point at a fresh project: apply `supabase/migrations/0001_init.sql`, run
`supabase/seed.sql`, and swap the two env values.

## Architecture

- Next.js App Router + TypeScript + Tailwind + shadcn/ui, Zod for validation.
- All persistence goes through the `DataStore` interface
  ([src/lib/data/store.ts](src/lib/data/store.ts)) with two implementations:
  lowdb JSON (dev) and Supabase with RLS (prod), chosen by `DATA_BACKEND`.
- Auth sits behind the same seam ([src/lib/auth](src/lib/auth/index.ts)):
  mock session in dev, Supabase Auth (+ middleware gate) in prod.
- PWA: `public/manifest.webmanifest` + hand-rolled `public/sw.js`
  (offline app shell; registered in production only).
