import type { Pronoun } from "@/lib/draft";

/**
 * The handover between account creation and the welcome screen.
 *
 * Kept in sessionStorage rather than in the URL: the share token is in here,
 * and tokens have no business sitting in browser history or a referrer
 * header.
 */

export const WELCOME_STORAGE_KEY = "memoir.onboarding.result.v1";

export type WelcomeResult = {
  memoirId: string;
  shareSlug: string;
  invitationToken: string;
  rowsWritten: { table: string; count: number }[];
  subjectName: string;
  pronoun: Pronoun;
};
