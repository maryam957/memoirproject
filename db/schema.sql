-- =====================================================================
-- The Memoir Project — PostgreSQL schema (Supabase flavour)
--
-- Apply with:
--   psql "$DATABASE_URL" -f db/schema.sql
--   psql "$DATABASE_URL" -f db/seed.sql
--
-- `memoirs` is the aggregate root: every content row carries memoir_id so
-- that RLS and composite foreign keys can guarantee a row never leaks
-- across memoir boundaries.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";  -- gen_random_uuid()
create extension if not exists "citext";    -- case-insensitive email

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type memoir_status              as enum ('collecting', 'under_review', 'published');
create type memoir_access_mode         as enum ('invited_only', 'password_protected', 'unlisted', 'public');
create type memoir_comment_permission  as enum ('disabled', 'invited_only', 'any_viewer');
create type contribution_status        as enum ('draft', 'submitted', 'withdrawn');
create type prompt_category_kind       as enum ('life_stage', 'theme', 'relationship');
create type ai_run_type                as enum ('transcription', 'chapter_clustering', 'timeline_inference', 'media_linking', 'account_connection');
create type processing_status          as enum ('queued', 'running', 'succeeded', 'failed');
create type organization_source        as enum ('human', 'ai', 'owner_override');
create type review_decision            as enum ('pending', 'accepted', 'rejected', 'overridden');
create type date_precision             as enum ('unknown', 'exact', 'month', 'year', 'decade', 'range', 'approximate');
create type media_kind                 as enum ('photo', 'audio', 'video');
create type media_storage_tier         as enum ('hot', 'cool', 'archive');
create type memory_media_role          as enum ('primary', 'supporting', 'original_recording', 'photograph', 'video', 'narration');
create type transcript_status          as enum ('pending', 'processing', 'ready', 'failed');
create type memory_connection_type     as enum ('same_event', 'conflicting_account', 'corroborating_account');
create type comment_status             as enum ('visible', 'hidden', 'removed');
create type notification_kind          as enum ('new_comment', 'memoir_published', 'weekly_digest', 'gentle_reminder');
create type delivery_status            as enum ('queued', 'sent', 'failed', 'suppressed');
create type subscription_status        as enum ('trialing', 'active', 'past_due', 'canceled', 'expired');
create type export_kind                as enum ('pdf', 'raw_archive');
create type export_status              as enum ('queued', 'processing', 'ready', 'failed');
create type analytics_event_type       as enum ('memoir_created', 'invitation_opened', 'contribution_started', 'contribution_submitted', 'memoir_published', 'memoir_viewed', 'search_performed', 'comment_posted', 'export_downloaded');
create type referral_touchpoint        as enum ('contributor', 'reader', 'commenter');
create type removal_scope              as enum ('memoir', 'contribution');
create type removal_status             as enum ('pending', 'approved', 'rejected', 'completed');

-- ---------------------------------------------------------------------
-- Shared trigger function: keep updated_at honest
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =====================================================================
-- Identity
-- =====================================================================

-- Authenticated organizers only. Contributors and readers never get a row here.
create table profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text        not null check (length(btrim(display_name)) between 1 and 120),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table profiles is 'Authenticated organizers only. 1:1 with auth.users.';

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- =====================================================================
-- Aggregate root
-- =====================================================================

create table memoirs (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid        not null references profiles (id) on delete restrict,
  subject_name           text        not null check (length(btrim(subject_name)) between 1 and 200),
  subject_birth_date     date,
  subject_death_date     date,
  short_description      text        not null check (length(btrim(short_description)) between 1 and 500),
  cover_media_id         uuid,       -- FK added after media_assets exists (circular reference)
  share_slug             text        not null unique check (share_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  invitation_token_hash  text        not null unique,
  status                 memoir_status             not null default 'collecting',
  access_mode            memoir_access_mode        not null default 'invited_only',
  password_hash          text,
  comment_permission     memoir_comment_permission not null default 'invited_only',
  published_at           timestamptz,
  deleted_at             timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- A password exists exactly when the memoir is password protected.
  constraint memoirs_password_matches_access_mode check (
    (access_mode = 'password_protected' and password_hash is not null)
    or (access_mode <> 'password_protected' and password_hash is null)
  ),
  -- published_at is set exactly when the memoir is published.
  constraint memoirs_published_at_matches_status check (
    (status = 'published' and published_at is not null)
    or (status <> 'published' and published_at is null)
  ),
  constraint memoirs_death_after_birth check (
    subject_birth_date is null
    or subject_death_date is null
    or subject_death_date >= subject_birth_date
  ),
  -- Composite target for memoir-scoped foreign keys throughout the schema.
  constraint memoirs_id_unique unique (id)
);

comment on table memoirs is 'Aggregate root. One memoir has one owner and one subject.';

create index memoirs_owner_id_idx on memoirs (owner_id) where deleted_at is null;
create index memoirs_status_idx   on memoirs (status)   where deleted_at is null;

create trigger memoirs_set_updated_at
  before update on memoirs
  for each row execute function set_updated_at();

-- =====================================================================
-- Invitation and contribution flow
-- =====================================================================

-- Named recipients of the memoir-wide share link. Anonymous opens stay analytics events.
create table invitation_recipients (
  id                uuid primary key default gen_random_uuid(),
  memoir_id         uuid        not null references memoirs (id) on delete cascade,
  invitee_name      text        not null check (length(btrim(invitee_name)) between 1 and 200),
  invitee_email     citext      check (invitee_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  invited_at        timestamptz not null default now(),
  opened_at         timestamptz,
  reminder_sent_at  timestamptz,
  created_at        timestamptz not null default now(),

  constraint invitation_recipients_memoir_id_id_key unique (memoir_id, id)
);

-- One address is invited to a given memoir once.
create unique index invitation_recipients_memoir_email_uniq
  on invitation_recipients (memoir_id, invitee_email)
  where invitee_email is not null;

create index invitation_recipients_memoir_id_idx on invitation_recipients (memoir_id);

-- Memoir-scoped identity; no account is required.
create table contributors (
  id                       uuid primary key default gen_random_uuid(),
  memoir_id                uuid        not null references memoirs (id) on delete cascade,
  invitation_recipient_id  uuid        unique references invitation_recipients (id) on delete set null,
  display_name             text        not null check (length(btrim(display_name)) between 1 and 200),
  email                    citext,
  relationship_to_subject  text        check (relationship_to_subject is null or length(btrim(relationship_to_subject)) <= 120),
  consented_at             timestamptz not null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint contributors_memoir_id_id_key unique (memoir_id, id)
);

create index contributors_memoir_id_idx on contributors (memoir_id);

create trigger contributors_set_updated_at
  before update on contributors
  for each row execute function set_updated_at();

-- One submission package containing one or more memories/media.
create table contributions (
  id                 uuid primary key default gen_random_uuid(),
  memoir_id          uuid        not null references memoirs (id) on delete cascade,
  contributor_id     uuid        not null,
  status             contribution_status not null default 'draft',
  access_token_hash  text        not null unique,
  submitted_at       timestamptz,
  withdrawn_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- The contributor must belong to the same memoir as the contribution.
  constraint contributions_contributor_same_memoir
    foreign key (memoir_id, contributor_id)
    references contributors (memoir_id, id) on delete cascade,

  -- A draft has never been submitted; a submitted package records when.
  -- A withdrawn package keeps whatever submitted_at it had.
  constraint contributions_draft_not_submitted check (status <> 'draft' or submitted_at is null),
  constraint contributions_submitted_has_time check (status <> 'submitted' or submitted_at is not null),
  constraint contributions_withdrawn_at_matches_status check (
    (status = 'withdrawn' and withdrawn_at is not null)
    or (status <> 'withdrawn' and withdrawn_at is null)
  ),
  constraint contributions_memoir_id_id_key unique (memoir_id, id)
);

create index contributions_memoir_id_idx      on contributions (memoir_id);
create index contributions_contributor_id_idx on contributions (contributor_id);

create trigger contributions_set_updated_at
  before update on contributions
  for each row execute function set_updated_at();

-- =====================================================================
-- Curated prompt library (global, not memoir scoped)
-- =====================================================================

create table prompts (
  id             uuid primary key default gen_random_uuid(),
  question_text  text        not null check (length(btrim(question_text)) between 1 and 500),
  is_active      boolean     not null default true,
  sort_order     integer     not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index prompts_active_sort_idx on prompts (sort_order) where is_active;

create trigger prompts_set_updated_at
  before update on prompts
  for each row execute function set_updated_at();

create table prompt_categories (
  id          uuid primary key default gen_random_uuid(),
  kind        prompt_category_kind not null,
  name        text        not null check (length(btrim(name)) between 1 and 120),
  created_at  timestamptz not null default now(),

  constraint prompt_categories_kind_name_key unique (kind, name)
);

-- Many-to-many: a prompt may belong to several classification categories.
create table prompt_category_assignments (
  prompt_id    uuid not null references prompts (id) on delete cascade,
  category_id  uuid not null references prompt_categories (id) on delete cascade,

  primary key (prompt_id, category_id)
);

create index prompt_category_assignments_category_idx on prompt_category_assignments (category_id);

-- =====================================================================
-- AI provenance
-- =====================================================================

create table ai_processing_runs (
  id              uuid primary key default gen_random_uuid(),
  memoir_id       uuid        not null references memoirs (id) on delete cascade,
  run_type        ai_run_type       not null,
  model_name      text        not null,
  model_version   text,
  prompt_version  text,
  status          processing_status not null default 'queued',
  started_at      timestamptz,
  completed_at    timestamptz,
  error_message   text,
  created_at      timestamptz not null default now(),

  constraint ai_runs_started_before_completed check (
    started_at is null or completed_at is null or completed_at >= started_at
  ),
  constraint ai_runs_failure_has_message check (
    status <> 'failed' or error_message is not null
  ),
  constraint ai_processing_runs_memoir_id_id_key unique (memoir_id, id)
);

create index ai_processing_runs_memoir_idx on ai_processing_runs (memoir_id, run_type);

-- =====================================================================
-- Human content and AI organization
-- =====================================================================

-- Smallest narrative unit displayed, searched, organized, removed and commented on.
create table memories (
  id                    uuid primary key default gen_random_uuid(),
  memoir_id             uuid not null references memoirs (id) on delete cascade,
  contribution_id       uuid not null,
  prompt_id             uuid references prompts (id) on delete set null,
  title                 text check (title is null or length(btrim(title)) <= 200),
  written_text          text,
  date_precision        date_precision not null default 'unknown',
  occurred_start_year   smallint check (occurred_start_year  between 1800 and 2200),
  occurred_start_month  smallint check (occurred_start_month between 1 and 12),
  occurred_start_day    smallint check (occurred_start_day   between 1 and 31),
  occurred_end_year     smallint check (occurred_end_year    between 1800 and 2200),
  occurred_end_month    smallint check (occurred_end_month   between 1 and 12),
  occurred_end_day      smallint check (occurred_end_day     between 1 and 31),
  timeline_source       organization_source,
  timeline_run_id       uuid references ai_processing_runs (id) on delete set null,
  timeline_confidence   numeric(5,4) check (timeline_confidence between 0 and 1),
  timeline_review       review_decision not null default 'pending',
  removed_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint memories_contribution_same_memoir
    foreign key (memoir_id, contribution_id)
    references contributions (memoir_id, id) on delete cascade,

  -- 'unknown' carries no date parts; every other precision needs at least a year.
  constraint memories_precision_requires_year check (
    (date_precision = 'unknown' and occurred_start_year is null)
    or (date_precision <> 'unknown' and occurred_start_year is not null)
  ),
  -- Only a range uses the end columns.
  constraint memories_end_only_for_range check (
    date_precision = 'range'
    or (occurred_end_year is null and occurred_end_month is null and occurred_end_day is null)
  ),
  constraint memories_range_has_end check (
    date_precision <> 'range' or occurred_end_year is not null
  ),
  -- Day requires month; both only make sense at exact precision.
  constraint memories_day_requires_month check (occurred_start_day is null or occurred_start_month is not null),
  constraint memories_exact_has_full_date check (
    date_precision <> 'exact' or (occurred_start_month is not null and occurred_start_day is not null)
  ),
  constraint memories_range_ordered check (
    occurred_end_year is null or occurred_start_year is null or occurred_end_year >= occurred_start_year
  ),
  -- AI-inferred timelines must point at the run that produced them.
  constraint memories_ai_timeline_has_run check (
    timeline_source is distinct from 'ai' or timeline_run_id is not null
  ),
  constraint memories_memoir_id_id_key unique (memoir_id, id)
);

create index memories_memoir_idx        on memories (memoir_id) where removed_at is null;
create index memories_contribution_idx  on memories (contribution_id);
create index memories_prompt_idx        on memories (prompt_id) where prompt_id is not null;

create trigger memories_set_updated_at
  before update on memories
  for each row execute function set_updated_at();

create table chapters (
  id                   uuid primary key default gen_random_uuid(),
  memoir_id            uuid not null references memoirs (id) on delete cascade,
  title                text not null check (length(btrim(title)) between 1 and 200),
  description          text,
  position             integer not null check (position >= 0),
  source               organization_source not null default 'human',
  generated_by_run_id  uuid references ai_processing_runs (id) on delete set null,
  review_status        review_decision not null default 'pending',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint chapters_ai_has_run check (source is distinct from 'ai' or generated_by_run_id is not null),
  constraint chapters_memoir_position_key unique (memoir_id, position) deferrable initially deferred,
  constraint chapters_memoir_id_id_key unique (memoir_id, id)
);

create trigger chapters_set_updated_at
  before update on chapters
  for each row execute function set_updated_at();

-- Placement, order, AI provenance and owner review.
-- Primary key on memory_id: one memory has at most one final chapter.
create table chapter_memory_placements (
  memory_id            uuid primary key,
  memoir_id            uuid not null references memoirs (id) on delete cascade,
  chapter_id           uuid not null,
  position             integer not null check (position >= 0),
  source               organization_source not null default 'ai',
  generated_by_run_id  uuid references ai_processing_runs (id) on delete set null,
  confidence           numeric(5,4) check (confidence between 0 and 1),
  review_status        review_decision not null default 'pending',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint placements_memory_same_memoir
    foreign key (memoir_id, memory_id)
    references memories (memoir_id, id) on delete cascade,
  constraint placements_chapter_same_memoir
    foreign key (memoir_id, chapter_id)
    references chapters (memoir_id, id) on delete cascade,
  constraint placements_ai_has_run check (source is distinct from 'ai' or generated_by_run_id is not null),
  constraint placements_chapter_position_key unique (chapter_id, position) deferrable initially deferred
);

create index placements_chapter_idx on chapter_memory_placements (chapter_id);
create index placements_memoir_idx  on chapter_memory_placements (memoir_id);

create trigger placements_set_updated_at
  before update on chapter_memory_placements
  for each row execute function set_updated_at();

-- =====================================================================
-- Media and transcripts
-- =====================================================================

-- Metadata and Supabase Storage reference; file bytes are not stored in PostgreSQL.
create table media_assets (
  id                          uuid primary key default gen_random_uuid(),
  memoir_id                   uuid not null references memoirs (id) on delete cascade,
  contribution_id             uuid,
  uploaded_by_profile_id      uuid references profiles (id) on delete set null,
  uploaded_by_contributor_id  uuid,
  kind                        media_kind not null,
  storage_bucket              text   not null,
  storage_path                text   not null unique,
  original_filename           text   not null,
  mime_type                   text   not null,
  byte_size                   bigint not null check (byte_size > 0),
  duration_seconds            numeric(10,3) check (duration_seconds > 0),
  width_pixels                integer check (width_pixels > 0),
  height_pixels               integer check (height_pixels > 0),
  caption                     text,
  narrates_media_id           uuid references media_assets (id) on delete set null,
  storage_tier                media_storage_tier not null default 'hot',
  archived_at                 timestamptz,
  deleted_at                  timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  constraint media_contribution_same_memoir
    foreign key (memoir_id, contribution_id)
    references contributions (memoir_id, id) on delete set null,
  constraint media_contributor_same_memoir
    foreign key (memoir_id, uploaded_by_contributor_id)
    references contributors (memoir_id, id) on delete set null,

  -- Exactly one uploader identity: an organizer or a contributor, never both.
  constraint media_single_uploader check (
    (uploaded_by_profile_id is not null)::int + (uploaded_by_contributor_id is not null)::int = 1
  ),
  -- Time-based media carries a duration; photos do not.
  constraint media_duration_matches_kind check (
    (kind in ('audio', 'video') and duration_seconds is not null)
    or (kind = 'photo' and duration_seconds is null)
  ),
  -- Only audio narrates another asset.
  constraint media_narration_is_audio check (narrates_media_id is null or kind = 'audio'),
  constraint media_no_self_narration check (narrates_media_id is null or narrates_media_id <> id),
  constraint media_archived_tier check (archived_at is null or storage_tier = 'archive'),
  constraint media_assets_memoir_id_id_key unique (memoir_id, id)
);

create index media_assets_memoir_idx       on media_assets (memoir_id) where deleted_at is null;
create index media_assets_contribution_idx on media_assets (contribution_id) where contribution_id is not null;

create trigger media_assets_set_updated_at
  before update on media_assets
  for each row execute function set_updated_at();

-- Deferred circular reference: a memoir's cover is one of its own assets.
-- Column-scoped SET NULL (PostgreSQL 15+) so deleting the asset clears the
-- cover without touching memoirs.id.
alter table memoirs
  add constraint memoirs_cover_media_fk
  foreign key (id, cover_media_id)
  references media_assets (memoir_id, id)
  on delete set null (cover_media_id);

-- Many-to-many: one photograph can support multiple memories.
create table memory_media_links (
  memoir_id            uuid not null references memoirs (id) on delete cascade,
  memory_id            uuid not null,
  media_asset_id       uuid not null,
  role                 memory_media_role not null,
  display_order        integer not null default 0 check (display_order >= 0),
  source               organization_source not null default 'human',
  generated_by_run_id  uuid references ai_processing_runs (id) on delete set null,
  confidence           numeric(5,4) check (confidence between 0 and 1),
  review_status        review_decision not null default 'pending',
  created_at           timestamptz not null default now(),

  primary key (memory_id, media_asset_id),

  constraint links_memory_same_memoir
    foreign key (memoir_id, memory_id)
    references memories (memoir_id, id) on delete cascade,
  constraint links_media_same_memoir
    foreign key (memoir_id, media_asset_id)
    references media_assets (memoir_id, id) on delete cascade,
  constraint links_ai_has_run check (source is distinct from 'ai' or generated_by_run_id is not null)
);

-- At most one primary asset per memory.
create unique index memory_media_links_single_primary
  on memory_media_links (memory_id)
  where role = 'primary';

create index memory_media_links_media_idx on memory_media_links (media_asset_id);

-- Original machine transcript and optional human-corrected text stay distinct.
create table transcripts (
  id                       uuid primary key default gen_random_uuid(),
  memoir_id                uuid not null references memoirs (id) on delete cascade,
  media_asset_id           uuid not null unique,
  processing_run_id        uuid references ai_processing_runs (id) on delete set null,
  status                   transcript_status not null default 'pending',
  original_text            text,
  edited_text              text,
  edited_by_profile_id     uuid references profiles (id) on delete set null,
  edited_by_contributor_id uuid,
  edited_at                timestamptz,
  language_code            varchar(16),
  confidence               numeric(5,4) check (confidence between 0 and 1),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint transcripts_media_same_memoir
    foreign key (memoir_id, media_asset_id)
    references media_assets (memoir_id, id) on delete cascade,
  constraint transcripts_editor_same_memoir
    foreign key (memoir_id, edited_by_contributor_id)
    references contributors (memoir_id, id) on delete set null,

  constraint transcripts_ready_has_text check (status <> 'ready' or original_text is not null),
  -- An edit records exactly one editor and a timestamp.
  constraint transcripts_edit_is_attributed check (
    (edited_text is null and edited_at is null
      and edited_by_profile_id is null and edited_by_contributor_id is null)
    or (edited_text is not null and edited_at is not null
      and (edited_by_profile_id is not null)::int + (edited_by_contributor_id is not null)::int = 1)
  )
);

create index transcripts_memoir_idx on transcripts (memoir_id);

create trigger transcripts_set_updated_at
  before update on transcripts
  for each row execute function set_updated_at();

-- Preserves conflicting/corroborating accounts without merging them.
create table memory_connections (
  id                   uuid primary key default gen_random_uuid(),
  memoir_id            uuid not null references memoirs (id) on delete cascade,
  left_memory_id       uuid not null,
  right_memory_id      uuid not null,
  connection_type      memory_connection_type not null,
  source               organization_source not null default 'ai',
  generated_by_run_id  uuid references ai_processing_runs (id) on delete set null,
  confidence           numeric(5,4) check (confidence between 0 and 1),
  review_status        review_decision not null default 'pending',
  created_at           timestamptz not null default now(),

  constraint connections_left_same_memoir
    foreign key (memoir_id, left_memory_id)
    references memories (memoir_id, id) on delete cascade,
  constraint connections_right_same_memoir
    foreign key (memoir_id, right_memory_id)
    references memories (memoir_id, id) on delete cascade,

  -- Store each undirected pair once, in a canonical order.
  constraint connections_canonical_order check (left_memory_id < right_memory_id),
  constraint connections_ai_has_run check (source is distinct from 'ai' or generated_by_run_id is not null),
  constraint connections_unique_pair unique (memoir_id, left_memory_id, right_memory_id, connection_type)
);

-- =====================================================================
-- Publication, comments, notifications
-- =====================================================================

-- One-way publication boundary and digest of the ordered final content.
create table publications (
  id                      uuid primary key default gen_random_uuid(),
  memoir_id               uuid not null unique references memoirs (id) on delete cascade,
  published_by_profile_id uuid not null references profiles (id) on delete restrict,
  snapshot_version        integer not null default 1 check (snapshot_version > 0),
  content_sha256          char(64) not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  created_at              timestamptz not null default now()
);

-- Living layer outside the immutable publication; exactly one target is required.
create table comments (
  id                  uuid primary key default gen_random_uuid(),
  memoir_id           uuid not null references memoirs (id) on delete cascade,
  memory_id           uuid,
  media_asset_id      uuid,
  author_name         text not null check (length(btrim(author_name)) between 1 and 200),
  author_email        citext,
  body                text not null check (length(btrim(body)) between 1 and 5000),
  status              comment_status not null default 'visible',
  hidden_at           timestamptz,
  hidden_by_profile_id uuid references profiles (id) on delete set null,
  removed_at          timestamptz,
  created_at          timestamptz not null default now(),

  constraint comments_memory_same_memoir
    foreign key (memoir_id, memory_id)
    references memories (memoir_id, id) on delete cascade,
  constraint comments_media_same_memoir
    foreign key (memoir_id, media_asset_id)
    references media_assets (memoir_id, id) on delete cascade,

  constraint comments_single_target check (
    (memory_id is not null)::int + (media_asset_id is not null)::int = 1
  ),
  constraint comments_hidden_is_attributed check (
    (status = 'hidden' and hidden_at is not null and hidden_by_profile_id is not null)
    or (status <> 'hidden' and hidden_at is null and hidden_by_profile_id is null)
  ),
  constraint comments_removed_at_matches_status check (
    (status = 'removed') = (removed_at is not null)
  )
);

create index comments_memory_idx on comments (memory_id) where status = 'visible';
create index comments_memoir_idx on comments (memoir_id, created_at desc);

create table notification_preferences (
  id                      uuid primary key default gen_random_uuid(),
  memoir_id               uuid not null references memoirs (id) on delete cascade,
  recipient_email         citext not null,
  kind                    notification_kind not null,
  enabled                 boolean not null default true,
  unsubscribe_token_hash  text not null unique,
  opted_out_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint notification_preferences_unique unique (memoir_id, recipient_email, kind),
  constraint notification_prefs_opt_out_disables check (opted_out_at is null or enabled = false)
);

create trigger notification_preferences_set_updated_at
  before update on notification_preferences
  for each row execute function set_updated_at();

-- Exact tone-reviewed copy and delivery result.
create table notifications (
  id                uuid primary key default gen_random_uuid(),
  memoir_id         uuid not null references memoirs (id) on delete cascade,
  preference_id     uuid references notification_preferences (id) on delete set null,
  comment_id        uuid references comments (id) on delete set null,
  recipient_email   citext not null,
  kind              notification_kind not null,
  subject           text not null,
  body              text not null,
  template_version  text not null,
  status            delivery_status not null default 'queued',
  queued_at         timestamptz not null default now(),
  sent_at           timestamptz,
  error_message     text,
  created_at        timestamptz not null default now(),

  constraint notifications_sent_at_matches_status check (
    (status = 'sent') = (sent_at is not null)
  ),
  constraint notifications_failure_has_message check (
    status <> 'failed' or error_message is not null
  ),
  constraint notifications_comment_only_for_comment_kind check (
    comment_id is null or kind = 'new_comment'
  )
);

create index notifications_memoir_idx on notifications (memoir_id, queued_at desc);
create index notifications_pending_idx on notifications (queued_at) where status = 'queued';

-- =====================================================================
-- Billing and exports
-- =====================================================================

create table subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  memoir_id                 uuid not null references memoirs (id) on delete cascade,
  owner_id                  uuid not null references profiles (id) on delete restrict,
  plan_code                 text not null,
  amount_cents              integer not null check (amount_cents >= 0),
  currency                  char(3) not null check (currency ~ '^[A-Z]{3}$'),
  provider                  text not null default 'stripe',
  provider_customer_id      text,
  provider_subscription_id  text unique,
  status                    subscription_status not null default 'trialing',
  current_period_start      timestamptz not null,
  current_period_end        timestamptz not null,
  cancel_at_period_end      boolean not null default false,
  canceled_at               timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint subscriptions_period_ordered check (current_period_end > current_period_start),
  constraint subscriptions_canceled_at_matches_status check (
    status <> 'canceled' or canceled_at is not null
  )
);

-- A memoir has at most one live subscription; historical rows stay queryable.
create unique index subscriptions_one_live_per_memoir
  on subscriptions (memoir_id)
  where status in ('trialing', 'active', 'past_due');

create index subscriptions_owner_idx on subscriptions (owner_id);

create trigger subscriptions_set_updated_at
  before update on subscriptions
  for each row execute function set_updated_at();

-- PDF requires a publication; raw archives may be requested before publication.
create table exports (
  id                        uuid primary key default gen_random_uuid(),
  memoir_id                 uuid not null references memoirs (id) on delete cascade,
  publication_id            uuid references publications (id) on delete set null,
  requested_by_profile_id   uuid not null references profiles (id) on delete restrict,
  kind                      export_kind not null,
  status                    export_status not null default 'queued',
  storage_bucket            text,
  storage_path              text,
  content_sha256            char(64) check (content_sha256 ~ '^[0-9a-f]{64}$'),
  byte_size                 bigint check (byte_size > 0),
  completed_at              timestamptz,
  error_message             text,
  created_at                timestamptz not null default now(),

  constraint exports_pdf_requires_publication check (kind <> 'pdf' or publication_id is not null),
  constraint exports_ready_has_file check (
    status <> 'ready'
    or (storage_bucket is not null and storage_path is not null
        and content_sha256 is not null and byte_size is not null and completed_at is not null)
  ),
  constraint exports_failure_has_message check (status <> 'failed' or error_message is not null)
);

create index exports_memoir_idx on exports (memoir_id, created_at desc);

-- =====================================================================
-- Analytics, referral, removal
-- =====================================================================

-- Append-only events for PRD success metrics and anonymous return visits.
create table analytics_events (
  id                       bigint generated always as identity primary key,
  memoir_id                uuid not null references memoirs (id) on delete cascade,
  invitation_recipient_id  uuid references invitation_recipients (id) on delete set null,
  contributor_id           uuid references contributors (id) on delete set null,
  contribution_id          uuid references contributions (id) on delete set null,
  comment_id               uuid references comments (id) on delete set null,
  visitor_id               uuid,
  session_id               uuid not null,
  event_type               analytics_event_type not null,
  metadata                 jsonb not null default '{}'::jsonb,
  occurred_at              timestamptz not null default now(),

  constraint analytics_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create index analytics_events_memoir_time_idx on analytics_events (memoir_id, occurred_at desc);
create index analytics_events_type_time_idx   on analytics_events (event_type, occurred_at desc);
create index analytics_events_visitor_idx     on analytics_events (visitor_id) where visitor_id is not null;

-- Links a new memoir to a prior contributor, reader or commenter touchpoint.
create table referral_attributions (
  id                     uuid primary key default gen_random_uuid(),
  new_memoir_id          uuid not null unique references memoirs (id) on delete cascade,
  source_memoir_id       uuid not null references memoirs (id) on delete cascade,
  source_event_id        bigint not null references analytics_events (id) on delete restrict,
  touchpoint             referral_touchpoint not null,
  source_contributor_id  uuid references contributors (id) on delete set null,
  source_comment_id      uuid references comments (id) on delete set null,
  source_visitor_id      uuid,
  attributed_at          timestamptz not null default now(),

  constraint referral_not_self check (new_memoir_id <> source_memoir_id),
  constraint referral_touchpoint_has_actor check (
    (touchpoint = 'contributor' and source_contributor_id is not null)
    or (touchpoint = 'commenter'  and source_comment_id is not null)
    or (touchpoint = 'reader'     and source_visitor_id is not null)
  )
);

create index referral_attributions_source_idx on referral_attributions (source_memoir_id);

-- Exceptional workflow for whole-memoir or individual-contribution deletion.
create table removal_requests (
  id                          uuid primary key default gen_random_uuid(),
  memoir_id                   uuid not null references memoirs (id) on delete cascade,
  contribution_id             uuid,
  scope                       removal_scope not null,
  requested_by_profile_id     uuid references profiles (id) on delete set null,
  requested_by_contributor_id uuid,
  requester_name              text not null,
  requester_email             citext,
  reason                      text,
  status                      removal_status not null default 'pending',
  decision_reason             text,
  decided_by_profile_id       uuid references profiles (id) on delete set null,
  decided_at                  timestamptz,
  completed_at                timestamptz,
  created_at                  timestamptz not null default now(),

  constraint removal_contribution_same_memoir
    foreign key (memoir_id, contribution_id)
    references contributions (memoir_id, id) on delete cascade,
  constraint removal_requester_same_memoir
    foreign key (memoir_id, requested_by_contributor_id)
    references contributors (memoir_id, id) on delete set null,

  constraint removal_scope_matches_target check (
    (scope = 'contribution' and contribution_id is not null)
    or (scope = 'memoir' and contribution_id is null)
  ),
  constraint removal_decision_is_attributed check (
    status = 'pending'
    or (decided_at is not null and decided_by_profile_id is not null)
  ),
  constraint removal_completed_was_approved check (
    status <> 'completed' or completed_at is not null
  )
);

create index removal_requests_memoir_idx  on removal_requests (memoir_id);
create index removal_requests_pending_idx on removal_requests (created_at) where status = 'pending';

-- =====================================================================
-- Row Level Security
--
-- Every table is protected. This feature (onboarding + authentication)
-- ships the owner-side policies it needs; the contributor, reader and
-- service-role policies land with the features that use them, so those
-- tables stay deny-by-default for the anon and authenticated roles until
-- then. Background jobs use the service role, which bypasses RLS.
-- =====================================================================

alter table profiles                    enable row level security;
alter table memoirs                     enable row level security;
alter table invitation_recipients       enable row level security;
alter table contributors                enable row level security;
alter table contributions               enable row level security;
alter table prompts                     enable row level security;
alter table prompt_categories           enable row level security;
alter table prompt_category_assignments enable row level security;
alter table ai_processing_runs          enable row level security;
alter table memories                    enable row level security;
alter table chapters                    enable row level security;
alter table chapter_memory_placements   enable row level security;
alter table media_assets                enable row level security;
alter table memory_media_links          enable row level security;
alter table transcripts                 enable row level security;
alter table memory_connections          enable row level security;
alter table publications                enable row level security;
alter table comments                    enable row level security;
alter table notification_preferences    enable row level security;
alter table notifications               enable row level security;
alter table subscriptions               enable row level security;
alter table exports                     enable row level security;
alter table analytics_events            enable row level security;
alter table referral_attributions       enable row level security;
alter table removal_requests            enable row level security;

-- Does the current user own this memoir?
create or replace function owns_memoir(target_memoir_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from memoirs m
    where m.id = target_memoir_id
      and m.owner_id = auth.uid()
      and m.deleted_at is null
  );
$$;

-- profiles: a user reads and edits only their own row.
create policy profiles_select_own on profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_insert_own on profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- memoirs: owners see and manage their own, undeleted, memoirs.
create policy memoirs_select_own on memoirs
  for select to authenticated using (owner_id = auth.uid() and deleted_at is null);
create policy memoirs_insert_own on memoirs
  for insert to authenticated with check (owner_id = auth.uid());
create policy memoirs_update_own on memoirs
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- invitation_recipients: the owner builds the invite list during onboarding.
create policy invitation_recipients_owner_all on invitation_recipients
  for all to authenticated using (owns_memoir(memoir_id)) with check (owns_memoir(memoir_id));

-- contributors / contributions: owner-side read for the console.
create policy contributors_owner_select on contributors
  for select to authenticated using (owns_memoir(memoir_id));
create policy contributions_owner_select on contributions
  for select to authenticated using (owns_memoir(memoir_id));

-- subscriptions: the owner reads their own billing state; writes come from
-- the billing job via the service role after Stripe confirms them.
create policy subscriptions_owner_select on subscriptions
  for select to authenticated using (owner_id = auth.uid());

-- prompts: the curated library is world-readable, service-role writable.
create policy prompts_read_all on prompts
  for select to anon, authenticated using (is_active);
create policy prompt_categories_read_all on prompt_categories
  for select to anon, authenticated using (true);
create policy prompt_category_assignments_read_all on prompt_category_assignments
  for select to anon, authenticated using (true);

commit;
