import { randomUUID } from "node:crypto";
import type { OnboardingWrite } from "@/lib/db/types";

/**
 * In-memory stand-in for Supabase.
 *
 * The mockup runs without credentials, so writes land here instead. The shape
 * of the call is the shape the real writer needs: memoir first, then the rows
 * that reference it, with a slug collision retried rather than surfaced to
 * the person signing up.
 *
 * Replacing this with Supabase means one Postgres function
 * (`create_memoir_from_onboarding`) called after `auth.signUp` returns, so
 * the whole set is atomic and the RLS policies in db/schema.sql cover every
 * read that follows.
 */

type Row = Record<string, unknown> & { id: string };

const tables: Record<string, Row[]> = {
  profiles: [],
  memoirs: [],
  contributors: [],
  analytics_events: [],
};

function insert(table: string, row: Record<string, unknown>): Row {
  const stored = {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    ...row,
  } as Row;
  tables[table].push(stored);
  return stored;
}

function slugTaken(slug: string): boolean {
  return tables.memoirs.some((row) => row.share_slug === slug);
}

/** `share_slug` is unique, and two memoirs for a "John Byrne" is normal. */
function availableSlug(base: string): string {
  if (!slugTaken(base)) return base;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!slugTaken(candidate)) return candidate;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}

export type PersistedMemoir = {
  memoirId: string;
  shareSlug: string;
  invitationToken: string;
  rowsWritten: { table: string; count: number }[];
};

export function persistOnboarding(write: OnboardingWrite): PersistedMemoir {
  const profile = insert("profiles", {
    ...write.profile,
    updated_at: new Date().toISOString(),
  });

  const shareSlug = availableSlug(write.memoir.share_slug);
  const memoir = insert("memoirs", {
    ...write.memoir,
    owner_id: profile.id,
    share_slug: shareSlug,
  });

  insert("contributors", {
    ...write.ownerContributor,
    memoir_id: memoir.id,
  });

  insert("analytics_events", {
    ...write.analyticsEvent,
    memoir_id: memoir.id,
    occurred_at: new Date().toISOString(),
  });

  return {
    memoirId: memoir.id,
    shareSlug,
    invitationToken: write.invitationToken,
    rowsWritten: [
      { table: "profiles", count: 1 },
      { table: "memoirs", count: 1 },
      { table: "contributors", count: 1 },
      { table: "analytics_events", count: 1 },
    ],
  };
}

/** Email uniqueness is Supabase Auth's job; the mock keeps its own list. */
const authUsers = new Map<string, { id: string; password: string }>();

export function createAuthUser(
  email: string,
  password: string
): { id: string; existing: boolean } {
  const key = email.trim().toLowerCase();
  const existing = authUsers.get(key);
  if (existing) return { id: existing.id, existing: true };
  const id = randomUUID();
  // Plaintext, in memory, in a mockup. Supabase Auth stores a bcrypt digest
  // and this map does not survive a restart.
  authUsers.set(key, { id, password });
  return { id, existing: false };
}

export function verifyAuthUser(
  email: string,
  password: string
): { id: string } | null {
  const user = authUsers.get(email.trim().toLowerCase());
  if (!user || user.password !== password) return null;
  return { id: user.id };
}

export function findMemoirByOwner(ownerId: string): Row | undefined {
  return tables.memoirs.find((row) => row.owner_id === ownerId);
}
