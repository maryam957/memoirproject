# Database

Two files, applied in order:

```bash
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f db/seed.sql
```

With the Supabase CLI running locally, `$DATABASE_URL` is usually
`postgresql://postgres:postgres@localhost:54322/postgres`.

`schema.sql` is written as one transaction and assumes PostgreSQL 15 or newer
(it uses column-scoped `ON DELETE SET NULL`) and the `auth.users` table that
Supabase provides. On a plain PostgreSQL instance, create a stand-in first:

```sql
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
```

## Shape

`memoirs` is the aggregate root. Every content table carries `memoir_id`, and
memoir-scoped relationships are enforced with composite foreign keys against
`(memoir_id, id)` rather than plain `(id)` — so a contribution cannot reference
a contributor from a different memoir even if someone hands the API a valid
UUID from elsewhere.

Beyond the ERD, the schema adds the invariants that keep those tables honest:

| Guarantee | Where |
| --- | --- |
| A password exists exactly when `access_mode = 'password_protected'` | `memoirs_password_matches_access_mode` |
| `published_at` is set exactly when `status = 'published'` | `memoirs_published_at_matches_status` |
| A memory dated to a decade cannot carry a day | `memories_exact_has_full_date`, `memories_end_only_for_range` |
| AI-sourced rows always name the run that produced them | `*_ai_has_run` on chapters, placements, links, connections, memories |
| Media has exactly one uploader — organizer or contributor, never both | `media_single_uploader` |
| A comment targets exactly one memory or one asset | `comments_single_target` |
| One live subscription per memoir, history retained | `subscriptions_one_live_per_memoir` (partial unique index) |
| A PDF export cannot exist without a publication | `exports_pdf_requires_publication` |
| Each undirected memory pair is stored once | `connections_canonical_order` |

Row Level Security is enabled on every table. This feature ships only the
owner-side policies it needs (profiles, memoirs, invitation recipients,
contributor/contribution reads, subscription reads, public prompt library).
Every other table is deny-by-default for `anon` and `authenticated` until the
feature that uses it adds its policies; background jobs run as the service
role, which bypasses RLS.

## What onboarding writes

The flow in this repository fills exactly these rows, in this order, inside one
transaction (see [`src/lib/db/map-draft.ts`](../src/lib/db/map-draft.ts)):

1. `auth.users` — created by Supabase Auth on sign-up.
2. `profiles` — `display_name`.
3. `memoirs` — `subject_name`, `subject_birth_date`, `subject_death_date`,
   `short_description`, `share_slug`, `invitation_token_hash`,
   `access_mode = 'invited_only'`, `comment_permission = 'invited_only'`,
   `password_hash = null`, `status = 'collecting'`.
4. `contributors` — one row for the owner, carrying
   `relationship_to_subject` and `consented_at`.
5. `analytics_events` — a single `memoir_created` event.

Four notes on the mapping:

- **Year-only dates.** Onboarding takes years as free text — "1947", "the
  1940s" — because people know the year and stall on the day.
  `memoirs.subject_birth_date` is a `date`, so a parsed year is stored as
  `YYYY-01-01`, and text with no year in it is stored as null. Unlike
  `memories`, the `memoirs` table has no precision column, so that
  approximation is not recoverable from the row. If subject-date precision
  matters later, it wants the same `date_precision` treatment `memories`
  already has.
- **The relationship is inverted, and only where that is safe.** Onboarding
  asks "who is this story about?" and gets "My mother";
  `contributors.relationship_to_subject` wants the opposite direction, so that
  becomes `child`, grandparents become `grandchild`, and a partner stays
  `partner`. Anything else — "Someone else", or a phrase they typed — is
  stored as null rather than guessed. The exact phrase survives on the
  `memoir_created` event, and the console asks properly later.
- **`profiles.display_name` is a stand-in.** The flow never asks the owner for
  their own name: the memoir is about somebody else, and a "your name" field
  on the last screen is friction at the worst possible moment. The email local
  part fills the NOT NULL column until the console asks.
- **Billing is deliberately absent.** No `subscriptions` row is written. The
  account and billing surfaces are separate from the product surface, and
  nothing in this flow charges the owner.
