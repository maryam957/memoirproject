# The Memoir Project — onboarding and authentication

A working mockup of the memoir owner's path, from first arrival to an account
existing, plus the database the whole product will sit on.

Two things are in this repository and nothing else is:

1. **The onboarding and authentication flow** — Next.js App Router, five
   collection screens then the account, built to the supplied design.
2. **The database** — the full ERD as PostgreSQL, with the constraints,
   partial indexes and RLS the ERD implies.

Building the memoir — memory capture, transcription, chapters, publishing,
comments — is out of scope, as is the contributor's experience of opening the
share link.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
```

No environment variables are needed. With `NEXT_PUBLIC_SUPABASE_URL` unset,
the account screen writes through an in-memory adapter
([`src/lib/db/mock-adapter.ts`](src/lib/db/mock-adapter.ts)) rather than
Supabase. Everything else — validation, the draft→rows mapping, token
hashing — is the real thing.

The welcome screen has a "what this wrote to the database" disclosure, so the
write is inspectable without a database attached.

## The database

```bash
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f db/seed.sql
```

See [`db/README.md`](db/README.md) for the shape, the invariants the schema
enforces beyond the ERD, the RLS position, and exactly which rows onboarding
writes.

## The flow

[`FLOW.md`](FLOW.md) is the flow specification: every screen, what it asks
for, what is required versus optional, and why the sequence is in that order.

## Layout

```
db/
  schema.sql            every table, enum, constraint, index and policy
  seed.sql              the curated prompt library
src/app/
  page.tsx              arrival
  onboarding/           about → name → life → line → cover
  account/              authentication, and the one write in the flow
  welcome/              the handover to the console
  sign-in/              returning owners
  actions.ts            server actions: create account, sign in
src/components/         StepFrame, BookCover, wordmark and icons
src/lib/
  draft.ts              the draft model, pronouns, year parsing
  draft-context.tsx     draft state, persisted to localStorage
  steps.ts              the step registry and its ordering
  db/map-draft.ts       draft → rows, pure and testable
  db/mock-adapter.ts    the stand-in for Supabase
```

## Notes for review

- Design tokens live only in [`src/app/globals.css`](src/app/globals.css), taken
  from the design's Tailwind config, so a re-skin does not touch screens.
- Nothing is written to any database until the account exists — there is no
  owner to attach a memoir to before then, and an abandoned flow should not
  leave rows behind.
- Three places approximate rather than pretend: year-only dates, the inverted
  relationship, and the stand-in `profiles.display_name`. All three are
  documented in `db/README.md` and flagged in the code.
- The share link is stored as a SHA-256 hash and shown to the owner exactly
  once, on the welcome screen.
