/**
 * Row types for the tables this feature writes.
 *
 * Hand-written rather than generated, and deliberately partial: only the
 * tables onboarding touches are here. Against a real Supabase project this
 * file is replaced by `supabase gen types typescript`.
 */

export type MemoirStatus = "collecting" | "under_review" | "published";

export type MemoirAccessMode =
  | "invited_only"
  | "password_protected"
  | "unlisted"
  | "public";

export type MemoirCommentPermission = "disabled" | "invited_only" | "any_viewer";

export type AnalyticsEventType =
  | "memoir_created"
  | "invitation_opened"
  | "contribution_started"
  | "contribution_submitted"
  | "memoir_published"
  | "memoir_viewed"
  | "search_performed"
  | "comment_posted"
  | "export_downloaded";

export type ProfileInsert = {
  id: string;
  display_name: string;
};

export type MemoirInsert = {
  owner_id: string;
  subject_name: string;
  subject_birth_date: string | null;
  subject_death_date: string | null;
  short_description: string;
  share_slug: string;
  invitation_token_hash: string;
  status: MemoirStatus;
  access_mode: MemoirAccessMode;
  password_hash: string | null;
  comment_permission: MemoirCommentPermission;
};

export type ContributorInsert = {
  memoir_id: string;
  display_name: string;
  email: string | null;
  relationship_to_subject: string | null;
  consented_at: string;
};

export type AnalyticsEventInsert = {
  memoir_id: string;
  session_id: string;
  event_type: AnalyticsEventType;
  metadata: Record<string, unknown>;
};

/** Everything one completed onboarding produces, in write order. */
export type OnboardingWrite = {
  profile: ProfileInsert;
  memoir: MemoirInsert;
  ownerContributor: ContributorInsert;
  analyticsEvent: AnalyticsEventInsert;
  /** The raw invitation token. Only its hash is stored; shown to the owner once. */
  invitationToken: string;
};
