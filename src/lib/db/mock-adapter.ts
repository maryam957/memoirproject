import { randomUUID } from "node:crypto";
import type { OnboardingWrite } from "@/lib/db/types";

/**
 * In-memory stand-in for Supabase and Object Storage.
 *
 * The mockup runs without credentials, so writes land here instead.
 * Supports complete memory lifecycle: draft persistence, autosave,
 * media asset registry, direct presigned upload simulation, attachment,
 * editing, and soft deletion.
 */

type Row = Record<string, unknown> & { id: string };

export type MockMediaAsset = {
  id: string;
  memoir_id: string;
  kind: "photo" | "audio" | "video";
  storage_key: string;
  original_filename: string;
  mime_type: string;
  byte_size: number;
  caption: string | null;
  playback_url: string;
  duration_seconds?: number | null;
  created_at: string;
};

export type MockMemoryMedia = {
  memory_id: string;
  media_asset_id: string;
  memoir_id: string;
  link_type: "primary" | "reference";
  position: number;
  created_by: "owner" | "contributor" | "ai";
  confirmed_by_owner: boolean;
};

export type MockMemory = {
  id: string;
  memoir_id: string;
  author_participant_id: string;
  prompt_id: string | null;
  title: string | null;
  body_text: string | null;
  status: "draft" | "submitted";
  submitted_at: string | null;
  deleted_at: string | null;
  deleted_by_participant_id: string | null;
  created_at: string;
  updated_at: string;
};

export type HydratedMemory = MockMemory & {
  media: Array<{
    id: string;
    kind: "photo" | "audio" | "video";
    caption: string | null;
    playback_url: string;
    duration_seconds?: number | null;
  }>;
};

const tables: {
  profiles: Row[];
  memoirs: Row[];
  contributors: Row[];
  analytics_events: Row[];
  memory: MockMemory[];
  media_asset: MockMediaAsset[];
  memory_media: MockMemoryMedia[];
} = {
  profiles: [],
  memoirs: [],
  contributors: [],
  analytics_events: [],
  memory: [],
  media_asset: [],
  memory_media: [],
};

// Seed a default demo memoir for immediate review if empty
const DEMO_MEMOIR_ID = "demo-memoir-nadia-001";
const DEMO_OWNER_ID = "demo-owner-001";

tables.profiles.push({
  id: DEMO_OWNER_ID,
  display_name: "Sarah",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

tables.memoirs.push({
  id: DEMO_MEMOIR_ID,
  owner_id: DEMO_OWNER_ID,
  subject_name: "Nadia",
  subject_birth_date: "1947-01-01",
  subject_death_date: "2024-01-01",
  short_description: "She gave everyone a second chance and made the world warmer.",
  share_slug: "nadia",
  invitation_token_hash: "mock_demo_token_hash",
  status: "collecting",
  access_mode: "invited_only",
  password_hash: null,
  comment_permission: "invited_only",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

function insert(table: keyof typeof tables, row: Record<string, unknown>): Row {
  const stored = {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    ...row,
  } as Row;
  (tables[table] as Row[]).push(stored);
  return stored;
}

function slugTaken(slug: string): boolean {
  return tables.memoirs.some((row) => row.share_slug === slug);
}

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

const authUsers = new Map<string, { id: string; password: string }>();

// Pre-seed a demo account: demo@memoir.com / password123
authUsers.set("demo@memoir.com", { id: DEMO_OWNER_ID, password: "password123" });

export function createAuthUser(
  email: string,
  password: string
): { id: string; existing: boolean } {
  const key = email.trim().toLowerCase();
  const existing = authUsers.get(key);
  if (existing) return { id: existing.id, existing: true };
  const id = randomUUID();
  authUsers.set(key, { id, password });
  return { id, existing: false };
}

export function verifyAuthUser(
  email: string,
  password: string
): { id: string; memoirId?: string } | null {
  const user = authUsers.get(email.trim().toLowerCase());
  if (!user || user.password !== password) return null;
  const memoir = findMemoirByOwner(user.id);
  return { id: user.id, memoirId: memoir?.id };
}

export function findMemoirByOwner(ownerId: string): Row | undefined {
  return tables.memoirs.find((row) => row.owner_id === ownerId);
}

export function getMemoirById(memoirId: string): Row | undefined {
  return tables.memoirs.find((row) => row.id === memoirId) || tables.memoirs[0];
}

/* =========================================================================
   Memory Capture & Lifecycle Functions
   ========================================================================= */

export function createMemoryDraft(
  memoirId: string,
  authorParticipantId: string,
  promptId?: string | null
): MockMemory {
  const memory: MockMemory = {
    id: randomUUID(),
    memoir_id: memoirId,
    author_participant_id: authorParticipantId,
    prompt_id: promptId || null,
    title: null,
    body_text: null,
    status: "draft",
    submitted_at: null,
    deleted_at: null,
    deleted_by_participant_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  tables.memory.push(memory);
  return memory;
}

export function patchMemory(
  memoirId: string,
  memoryId: string,
  patch: { title?: string | null; body_text?: string | null; prompt_id?: string | null }
): MockMemory {
  const memory = tables.memory.find(
    (m) => m.id === memoryId && m.memoir_id === memoirId && !m.deleted_at
  );
  if (!memory) {
    throw new Error("Memory not found");
  }

  if (patch.title !== undefined) memory.title = patch.title;
  if (patch.body_text !== undefined) memory.body_text = patch.body_text;
  if (patch.prompt_id !== undefined) memory.prompt_id = patch.prompt_id;
  memory.updated_at = new Date().toISOString();

  return memory;
}

export function submitMemory(memoirId: string, memoryId: string): MockMemory {
  const memory = tables.memory.find(
    (m) => m.id === memoryId && m.memoir_id === memoirId && !m.deleted_at
  );
  if (!memory) throw new Error("Memory not found");

  if (memory.status === "submitted") return memory;

  const linkedMedia = tables.memory_media.filter(
    (mm) => mm.memoir_id === memoirId && mm.memory_id === memoryId
  );
  const hasText = Boolean(memory.title?.trim() || memory.body_text?.trim());

  if (!hasText && linkedMedia.length === 0) {
    throw new Error("Cannot submit an empty memory. Add text, audio, or a photograph first.");
  }

  memory.status = "submitted";
  memory.submitted_at = new Date().toISOString();
  memory.updated_at = new Date().toISOString();
  return memory;
}

export function listMemories(memoirId: string): HydratedMemory[] {
  const memories = tables.memory
    .filter((m) => m.memoir_id === memoirId && !m.deleted_at && m.status === "submitted")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return memories.map((m) => hydrateMemory(memoirId, m));
}

export function getActiveDraft(memoirId: string): HydratedMemory | null {
  const draft = tables.memory
    .filter((m) => m.memoir_id === memoirId && !m.deleted_at && m.status === "draft")
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];

  if (!draft) return null;
  return hydrateMemory(memoirId, draft);
}

export function getMemory(memoirId: string, memoryId: string): HydratedMemory | null {
  const memory = tables.memory.find(
    (m) => m.id === memoryId && m.memoir_id === memoirId && !m.deleted_at
  );
  if (!memory) return null;
  return hydrateMemory(memoirId, memory);
}

function hydrateMemory(memoirId: string, memory: MockMemory): HydratedMemory {
  const links = tables.memory_media
    .filter((mm) => mm.memoir_id === memoirId && mm.memory_id === memory.id)
    .sort((a, b) => a.position - b.position);

  const media = links
    .map((l) => {
      const asset = tables.media_asset.find((a) => a.id === l.media_asset_id);
      if (!asset) return null;
      return {
        id: asset.id,
        kind: asset.kind,
        caption: asset.caption,
        playback_url: asset.playback_url,
        duration_seconds: asset.duration_seconds,
      };
    })
    .filter(Boolean) as HydratedMemory["media"];

  return { ...memory, media };
}

export function deleteMemory(
  memoirId: string,
  memoryId: string,
  ownerParticipantId: string
): void {
  const memory = tables.memory.find(
    (m) => m.id === memoryId && m.memoir_id === memoirId && !m.deleted_at
  );
  if (!memory) throw new Error("Memory not found");

  memory.deleted_at = new Date().toISOString();
  memory.deleted_by_participant_id = ownerParticipantId;
  memory.updated_at = new Date().toISOString();

  // Unlink media
  tables.memory_media = tables.memory_media.filter(
    (mm) => !(mm.memoir_id === memoirId && mm.memory_id === memoryId)
  );
}

/* =========================================================================
   Media Upload & Linking Functions
   ========================================================================= */

export type PresignMediaResult = {
  mediaAssetId: string;
  uploadUrl: string;
  storageKey: string;
  playbackUrl: string;
  uploadMethod: "PUT";
  headers: Record<string, string>;
};

export function presignMediaUpload(
  memoirId: string,
  input: {
    kind: "photo" | "audio" | "video";
    filename: string;
    mimeType: string;
    byteSize: number;
    caption?: string | null;
    playbackUrl?: string; // Optional direct simulated storage ref
  }
): PresignMediaResult {
  const assetId = randomUUID();
  const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `memoirs/${memoirId}/${input.kind}/${assetId}_${safeFilename}`;
  const uploadUrl = `/api/storage/mock/${assetId}`;
  const playbackUrl = input.playbackUrl || `/api/storage/mock/${assetId}`;

  const asset: MockMediaAsset = {
    id: assetId,
    memoir_id: memoirId,
    kind: input.kind,
    storage_key: storageKey,
    original_filename: input.filename,
    mime_type: input.mimeType,
    byte_size: input.byteSize,
    caption: input.caption || null,
    playback_url: playbackUrl,
    created_at: new Date().toISOString(),
  };

  tables.media_asset.push(asset);

  return {
    mediaAssetId: assetId,
    uploadUrl,
    storageKey,
    playbackUrl,
    uploadMethod: "PUT",
    headers: { "Content-Type": input.mimeType },
  };
}

export function updateMediaAsset(
  memoirId: string,
  mediaAssetId: string,
  updates: { playbackUrl?: string; caption?: string | null; durationSeconds?: number | null }
): MockMediaAsset {
  const asset = tables.media_asset.find(
    (a) => a.id === mediaAssetId && a.memoir_id === memoirId
  );
  if (!asset) throw new Error("Media asset not found");

  if (updates.playbackUrl) asset.playback_url = updates.playbackUrl;
  if (updates.caption !== undefined) asset.caption = updates.caption;
  if (updates.durationSeconds !== undefined) asset.duration_seconds = updates.durationSeconds;

  return asset;
}

export function attachMediaToMemory(
  memoirId: string,
  memoryId: string,
  mediaAssetId: string
): void {
  const existing = tables.memory_media.find(
    (mm) =>
      mm.memoir_id === memoirId &&
      mm.memory_id === memoryId &&
      mm.media_asset_id === mediaAssetId
  );
  if (existing) return;

  const currentLinks = tables.memory_media.filter(
    (mm) => mm.memoir_id === memoirId && mm.memory_id === memoryId
  );

  tables.memory_media.push({
    memory_id: memoryId,
    media_asset_id: mediaAssetId,
    memoir_id: memoirId,
    link_type: "primary",
    position: currentLinks.length + 1,
    created_by: "owner",
    confirmed_by_owner: true,
  });

  const memory = tables.memory.find((m) => m.id === memoryId);
  if (memory) memory.updated_at = new Date().toISOString();
}

export function detachMediaFromMemory(
  memoirId: string,
  memoryId: string,
  mediaAssetId: string
): void {
  tables.memory_media = tables.memory_media.filter(
    (mm) =>
      !(
        mm.memoir_id === memoirId &&
        mm.memory_id === memoryId &&
        mm.media_asset_id === mediaAssetId
      )
  );

  const memory = tables.memory.find((m) => m.id === memoryId);
  if (memory) memory.updated_at = new Date().toISOString();
}
