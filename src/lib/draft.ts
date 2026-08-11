/**
 * The onboarding draft.
 *
 * Everything the owner tells us before they have an account lives here, in
 * one shape, kept on the device. Nothing is written to the database until the
 * account exists — there is no owner to hang a memoir off until then, and
 * somebody who abandons the flow should not leave rows behind.
 */

export type Pronoun = "she" | "he" | "they";

export type LivingStatus = "living" | "passed" | "unsaid";

export type MemoirDraft = {
  /** "My mother", "My grandfather", or whatever they typed themselves. */
  relationship: string;
  pronoun: Pronoun;
  subjectName: string;
  livingStatus: LivingStatus;
  /** Exactly what they typed — "1947", "the 1940s", "just after partition". */
  bornRaw: string;
  passedRaw: string;
  /** The line under the name. Becomes memoirs.short_description. */
  dedication: string;
};

export const emptyDraft: MemoirDraft = {
  relationship: "",
  pronoun: "they",
  subjectName: "",
  livingStatus: "unsaid",
  bornRaw: "",
  passedRaw: "",
  dedication: "",
};

/**
 * The relationship cards.
 *
 * The pronoun rides along with the choice rather than being guessed from the
 * name, which lets the rest of the flow say "her name" instead of "their
 * name" without ever inferring gender from a name. "Someone else" carries no
 * assumption and asks.
 */
export const RELATIONSHIP_CARDS: {
  label: string;
  pronoun: Pronoun;
  asks: boolean;
}[] = [
  { label: "My mother", pronoun: "she", asks: false },
  { label: "My father", pronoun: "he", asks: false },
  { label: "My grandmother", pronoun: "she", asks: false },
  { label: "My grandfather", pronoun: "he", asks: false },
  { label: "My partner", pronoun: "they", asks: true },
  { label: "Someone else", pronoun: "they", asks: true },
];

export const PRONOUN_OPTIONS: { value: Pronoun; label: string }[] = [
  { value: "she", label: "she / her" },
  { value: "he", label: "he / him" },
  { value: "they", label: "they / them" },
];

type PronounForms = {
  subject: string;
  object: string;
  possessive: string;
  isPlural: boolean;
};

const FORMS: Record<Pronoun, PronounForms> = {
  she: { subject: "she", object: "her", possessive: "her", isPlural: false },
  he: { subject: "he", object: "him", possessive: "his", isPlural: false },
  they: {
    subject: "they",
    object: "them",
    possessive: "their",
    isPlural: true,
  },
};

export function pronouns(draft: MemoirDraft): PronounForms {
  return FORMS[draft.pronoun];
}

/** "her", "his", "their" — used all through the copy. */
export function possessive(draft: MemoirDraft): string {
  return FORMS[draft.pronoun].possessive;
}

/** "is" / "are", so "Is Nadia still with us?" stays grammatical. */
export function toBe(draft: MemoirDraft, past = false): string {
  const plural = FORMS[draft.pronoun].isPlural;
  if (past) return plural ? "were" : "was";
  return plural ? "are" : "is";
}

/** First name only, so the copy sounds like a person talking. */
export function firstName(draft: MemoirDraft): string {
  const name = draft.subjectName.trim();
  if (!name) return FORMS[draft.pronoun].object;
  return name.split(/\s+/)[0];
}

export function initial(draft: MemoirDraft): string {
  const name = draft.subjectName.trim();
  return name ? name[0].toUpperCase() : "·";
}

/**
 * Years are typed as free text on purpose — people write "the 1940s" or
 * "just after the war" far more readily than they pick a date from a
 * calendar, and a date picker asking for an exact date of death is a cruel
 * thing to put in front of somebody three weeks after a funeral.
 *
 * This pulls a year out of whatever they wrote. A decade becomes its first
 * year; anything unparseable is kept as text and stored as no date at all.
 */
export function parseYear(raw: string): number | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;

  // "1947", "b. 1947", "born in 1947", and decades: "the 1940s" → 1940.
  // The trailing s is optional and consumed, so the word boundary still lands.
  const fourDigit = text.match(/\b(1[5-9]\d{2}|20\d{2})s?\b/);
  if (fourDigit) {
    const year = Number(fourDigit[1]);
    if (year >= 1500 && year <= CURRENT_YEAR) return year;
  }

  // "the 40s", "'40s" — read as the twentieth century unless that would be
  // in the future.
  const twoDigit = text.match(/(?:^|[\s'’])(\d{2})s\b/);
  if (twoDigit) {
    const decade = Number(twoDigit[1]);
    return 2000 + decade <= CURRENT_YEAR ? 2000 + decade : 1900 + decade;
  }

  return null;
}

export const CURRENT_YEAR = 2026;

/** What the cover shows under the name. */
export function lifespanLabel(draft: MemoirDraft): string {
  const born = parseYear(draft.bornRaw);
  const passed = parseYear(draft.passedRaw);

  if (draft.livingStatus === "living") {
    return born ? `${born} —` : "";
  }
  if (born && passed) return `${born} — ${passed}`;
  if (born) return `${born} —`;
  if (passed) return `— ${passed}`;
  return "";
}

/**
 * Slug for the share link. Matches the schema's
 * `share_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'` constraint; uniqueness is the
 * database's job, and the writer retries with a suffix on conflict.
 */
export function slugify(value: string): string {
  const base = value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "memoir";
}

/** A memoir needs a name. Everything else in this flow can be skipped. */
export function isDraftComplete(draft: MemoirDraft): boolean {
  return draft.subjectName.trim().length > 0;
}

/**
 * `memoirs.short_description` is NOT NULL, so a skipped dedication still has
 * to produce a line. This is the one place the product writes on the owner's
 * behalf, and it says only what it was told.
 */
export function resolvedDedication(draft: MemoirDraft): string {
  const written = draft.dedication.trim();
  if (written) return written;
  const name = draft.subjectName.trim() || "someone loved";
  const relation = draft.relationship.trim().toLowerCase();
  return relation
    ? `The memoir of ${name}, ${relation.replace(/^my /, "")}.`
    : `The memoir of ${name}.`;
}
