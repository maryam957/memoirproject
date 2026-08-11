import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  parseYear,
  resolvedDedication,
  slugify,
  type MemoirDraft,
} from "@/lib/draft";
import type { OnboardingWrite } from "@/lib/db/types";

/**
 * Draft → rows.
 *
 * Pure apart from token generation, so the mapping can be reasoned about and
 * tested without a database in front of it.
 */

export type OwnerAccount = {
  id: string;
  displayName: string;
  email: string;
};

/** The share link token. The database only ever sees its SHA-256 hash. */
export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Onboarding collects years, not dates. `memoirs.subject_birth_date` is a
 * `date` with no precision column, so a year becomes the 1st of January and
 * the approximation is not recoverable from the row — see db/README.md.
 */
export function yearToDate(year: number | null): string | null {
  if (!year) return null;
  return `${String(year).padStart(4, "0")}-01-01`;
}

/**
 * `contributors.relationship_to_subject` describes the contributor's
 * relation to the subject, and onboarding asks the opposite question ("who is
 * this story about?"). Inverting it is only safe where the answer is
 * unambiguous, so anything else is stored as null rather than guessed — the
 * phrase the owner chose is preserved on the `memoir_created` event, and the
 * console asks them directly later.
 */
export function inverseRelationship(relationship: string): string | null {
  switch (relationship.trim().toLowerCase()) {
    case "my mother":
    case "my father":
      return "child";
    case "my grandmother":
    case "my grandfather":
      return "grandchild";
    case "my partner":
      return "partner";
    default:
      return null;
  }
}

export function mapDraftToWrite(
  draft: MemoirDraft,
  owner: OwnerAccount,
  sessionId: string = randomUUID()
): OnboardingWrite {
  const invitationToken = generateInvitationToken();
  const now = new Date().toISOString();

  const birthYear = parseYear(draft.bornRaw);
  const deathYear =
    draft.livingStatus === "living" ? null : parseYear(draft.passedRaw);

  return {
    profile: {
      id: owner.id,
      display_name: owner.displayName.trim(),
    },
    memoir: {
      owner_id: owner.id,
      subject_name: draft.subjectName.trim(),
      subject_birth_date: yearToDate(birthYear),
      subject_death_date: yearToDate(deathYear),
      short_description: resolvedDedication(draft),
      share_slug: slugify(draft.subjectName),
      invitation_token_hash: hashToken(invitationToken),
      status: "collecting",
      // Onboarding does not ask about visibility. The strictest setting is the
      // only defensible default, and the console offers the rest once the
      // owner has something worth showing.
      access_mode: "invited_only",
      password_hash: null,
      comment_permission: "invited_only",
    },
    // The owner is contributor number one: they will submit memories like
    // everybody else, and this is where their consent timestamp lives.
    ownerContributor: {
      memoir_id: "", // set by the writer once the memoir row exists
      display_name: owner.displayName.trim(),
      email: owner.email.trim().toLowerCase(),
      relationship_to_subject: inverseRelationship(draft.relationship),
      consented_at: now,
    },
    analyticsEvent: {
      memoir_id: "",
      session_id: sessionId,
      event_type: "memoir_created",
      metadata: {
        relationship: draft.relationship.trim() || null,
        pronoun: draft.pronoun,
        living_status: draft.livingStatus,
        has_birth_year: birthYear !== null,
        has_death_year: deathYear !== null,
        dedication_written: draft.dedication.trim().length > 0,
      },
    },
    invitationToken,
  };
}
