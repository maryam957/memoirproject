"use server";

import { isDraftComplete, type MemoirDraft } from "@/lib/draft";
import { mapDraftToWrite } from "@/lib/db/map-draft";
import {
  createAuthUser,
  persistOnboarding,
  verifyAuthUser,
  type PersistedMemoir,
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
 * The one write in the whole flow.
 *
 * Authentication runs last, so this is where four screens of answers finally
 * become rows: an auth user, a profile, the memoir, the owner's contributor
 * record, and a single `memoir_created` event.
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

  // `profiles.display_name` is NOT NULL and onboarding never asks the owner
  // for their own name — the memoir is about somebody else, and a "your name"
  // field on the last screen is friction at the worst possible moment. The
  // email local part stands in until the console asks properly.
  const displayName = email.split("@")[0];

  const write = mapDraftToWrite(input.draft, {
    id: user.id,
    displayName,
    email,
  });

  return { ok: true, ...persistOnboarding(write) };
}

export type SignInResult =
  | { ok: true }
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
  return { ok: true };
}
