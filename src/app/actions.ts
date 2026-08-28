"use server";

import { isDraftComplete, type MemoirDraft } from "@/lib/draft";
import { mapDraftToWrite } from "@/lib/db/map-draft";
import {
  attachMediaToMemory,
  createAuthUser,
  createMemoryDraft,
  deleteMemory as dbDeleteMemory,
  detachMediaFromMemory,
  getActiveDraft,
  getMemoirById,
  listMemories,
  patchMemory,
  persistOnboarding,
  presignMediaUpload,
  submitMemory as dbSubmitMemory,
  verifyAuthUser,
  type HydratedMemory,
  type MockMemory,
  type PersistedMemoir,
  type PresignMediaResult,
} from "@/lib/db/mock-adapter";

export type CreateAccountInput = {
  draft: MemoirDraft;
  email: string;
  password: string;
};

export type CreateAccountResult =
  | ({ ok: true } & PersistedMemoir)
  | { ok: false; field: "email" | "password" | "draft"; message: string };

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * The one write in the whole onboarding flow.
 */
export async function createOwnerAccount(
  input: CreateAccountInput
): Promise<CreateAccountResult> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!EMAIL_PATTERN.test(email)) {
    return {
      ok: false,
      field: "email",
      message: "That email address does not look right.",
    };
  }

  if (password.length < 8) {
    return {
      ok: false,
      field: "password",
      message: "Passwords need at least 8 characters.",
    };
  }

  if (!isDraftComplete(input.draft)) {
    return {
      ok: false,
      field: "draft",
      message: "The memoir still needs a name.",
    };
  }

  const user = createAuthUser(email, password);
  if (user.existing) {
    return {
      ok: false,
      field: "email",
      message: "An account already uses that email. Sign in instead.",
    };
  }

  const displayName = email.split("@")[0];

  const write = mapDraftToWrite(input.draft, {
    id: user.id,
    displayName,
    email,
  });

  return { ok: true, ...persistOnboarding(write) };
}

export type SignInResult =
  | { ok: true; ownerId?: string; memoirId?: string }
  | { ok: false; message: string };

/** The returning half of authentication. */
export async function signIn(
  email: string,
  password: string
): Promise<SignInResult> {
  const user = verifyAuthUser(email, password);
  if (!user) {
    return { ok: false, message: "We could not match that email and password." };
  }
  return { ok: true, ownerId: user.id, memoirId: user.memoirId };
}

/* =========================================================================
   Dashboard & Memory Server Actions
   ========================================================================= */

export type MemoirDashboardData = {
  memoir: {
    id: string;
    subjectName: string;
    birthDate: string | null;
    deathDate: string | null;
    dedication: string;
    status: string;
    shareSlug: string;
  };
  memories: HydratedMemory[];
  activeDraft: HydratedMemory | null;
};

export async function getDashboardData(
  memoirId?: string
): Promise<MemoirDashboardData | null> {
  const memoir = getMemoirById(memoirId || "demo-memoir-nadia-001");
  if (!memoir) return null;

  const mId = memoir.id as string;
  const memories = listMemories(mId);
  const activeDraft = getActiveDraft(mId);

  return {
    memoir: {
      id: mId,
      subjectName: (memoir.subject_name as string) || "Nadia",
      birthDate: (memoir.subject_birth_date as string) || null,
      deathDate: (memoir.subject_death_date as string) || null,
      dedication: (memoir.short_description as string) || "",
      status: (memoir.status as string) || "collecting",
      shareSlug: (memoir.share_slug as string) || "nadia",
    },
    memories,
    activeDraft,
  };
}

export async function saveMemoryDraftAction(input: {
  memoirId: string;
  memoryId?: string;
  title?: string | null;
  bodyText?: string | null;
  promptId?: string | null;
}): Promise<{ ok: boolean; memory?: MockMemory; error?: string }> {
  try {
    let memory: MockMemory;
    if (input.memoryId) {
      memory = patchMemory(input.memoirId, input.memoryId, {
        title: input.title,
        body_text: input.bodyText,
        prompt_id: input.promptId,
      });
    } else {
      memory = createMemoryDraft(input.memoirId, "current-owner", input.promptId);
      if (input.title || input.bodyText) {
        memory = patchMemory(input.memoirId, memory.id, {
          title: input.title,
          body_text: input.bodyText,
        });
      }
    }
    return { ok: true, memory };
  } catch (err: unknown) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function submitMemoryAction(input: {
  memoirId: string;
  memoryId: string;
}): Promise<{ ok: boolean; memory?: MockMemory; error?: string }> {
  try {
    const memory = dbSubmitMemory(input.memoirId, input.memoryId);
    return { ok: true, memory };
  } catch (err: unknown) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteMemoryAction(input: {
  memoirId: string;
  memoryId: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    dbDeleteMemory(input.memoirId, input.memoryId, "current-owner");
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function presignMediaAction(input: {
  memoirId: string;
  kind: "photo" | "audio" | "video";
  filename: string;
  mimeType: string;
  byteSize: number;
  caption?: string | null;
  playbackUrl?: string;
}): Promise<{ ok: boolean; presign?: PresignMediaResult; error?: string }> {
  try {
    const presign = presignMediaUpload(input.memoirId, input);
    return { ok: true, presign };
  } catch (err: unknown) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function attachMediaAction(input: {
  memoirId: string;
  memoryId: string;
  mediaAssetId: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    attachMediaToMemory(input.memoirId, input.memoryId, input.mediaAssetId);
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function detachMediaAction(input: {
  memoirId: string;
  memoryId: string;
  mediaAssetId: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    detachMediaFromMemory(input.memoirId, input.memoryId, input.mediaAssetId);
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: (err as Error).message };
  }
}
