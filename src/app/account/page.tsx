"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createOwnerAccount } from "@/app/actions";
import { BookCover } from "@/components/BookCover";
import { ArrowRight } from "@/components/Wordmark";
import { useDraft } from "@/lib/draft-context";
import { firstName, isDraftComplete, possessive } from "@/lib/draft";
import { WELCOME_STORAGE_KEY } from "@/lib/welcome-result";

/**
 * Authentication, last.
 *
 * By now the owner has made something, so the account reads as keeping it
 * rather than as the price of entry — the cover sits at the top of the screen
 * while they type. Two fields, no confirm-password (people mistype it and
 * then leave), and no "your name" field: the memoir is about somebody else,
 * and the console can ask later.
 */
export default function AccountPage() {
  const router = useRouter();
  const { draft, hydrated, reset } = useDraft();
  const [pending, startTransition] = useTransition();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ field: string; message: string } | null>(
    null
  );

  const name = firstName(draft);

  if (hydrated && !isDraftComplete(draft)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[720px] flex-col justify-center px-6 text-center">
        <h1 className="headline-md text-on-surface">
          Let&apos;s name them first.
        </h1>
        <p className="body-md mt-4 text-on-surface-variant">
          An account needs something to hold, and the memoir does not have a
          name on it yet.
        </p>
        <Link
          href="/onboarding/about"
          className="btn-primary label-caps mx-auto mt-8 w-fit"
        >
          <span>Back to the questions</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </main>
    );
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createOwnerAccount({ draft, email, password });

      if (!result.ok) {
        setError({ field: result.field, message: result.message });
        return;
      }

      try {
        window.sessionStorage.setItem(
          WELCOME_STORAGE_KEY,
          JSON.stringify({
            memoirId: result.memoirId,
            shareSlug: result.shareSlug,
            invitationToken: result.invitationToken,
            rowsWritten: result.rowsWritten,
            subjectName: draft.subjectName,
            pronoun: draft.pronoun,
          })
        );
      } catch {
        // The welcome screen has a fallback for this.
      }

      // The draft has become rows; nothing should be left on the device.
      reset();
      router.push("/welcome");
    });
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[720px] flex-col items-center justify-center px-6 py-5">
      <div className="w-full max-w-md animate-rise text-center">
        {/* The cover stands down on short screens so the form still fits in
            one view — it is reassurance, not information. */}
        <BookCover size="thumb" className="tall-only-block" />

        <h1 className="display-lg mt-6 text-on-surface">
          Save {possessive(draft)} story
        </h1>

        <p className="body-lg mt-3 text-on-surface-variant">
          Create an account so {name}&apos;s memoir is kept safe.
        </p>

        {/* Placeholder: wiring this to Supabase's Google provider is a
            configuration step, not a code one, and it does not exist here. */}
        <button
          type="button"
          onClick={() =>
            setError({
              field: "email",
              message:
                "Google sign-in is not wired up in this mockup — use an email address.",
            })
          }
          className="btn-ghost label-caps mt-6 w-full text-on-surface"
        >
          <GoogleMark className="h-5 w-5" />
          <span>Continue with Google</span>
        </button>

        <div className="my-5 flex items-center gap-4">
          <span className="h-px flex-1 bg-outline-variant/60" />
          <span className="label-caps text-on-surface-variant">or</span>
          <span className="h-px flex-1 bg-outline-variant/60" />
        </div>

        <form onSubmit={submit} className="space-y-4 text-left" noValidate>
          <div>
            <label htmlFor="email" className="label-caps block text-on-surface-variant">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="Enter your email"
              className="field mt-2"
            />
            <FieldError error={error} field="email" />
          </div>

          <div>
            <label
              htmlFor="password"
              className="label-caps block text-on-surface-variant"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Create a password"
              className="field mt-2"
            />
            <FieldError error={error} field="password" />
          </div>

          {error?.field === "draft" ? (
            <p className="body-md text-error">{error.message}</p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="btn-primary headline-sm w-full text-base"
          >
            <span>{pending ? "Saving…" : "Save and continue"}</span>
            <ArrowRight className="h-5 w-5" />
          </button>
        </form>

        <p className="body-md mt-5 text-on-surface-variant">
          By creating an account, you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-4">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>

        <Link
          href="/sign-in"
          className="label-caps mt-4 inline-block text-on-surface underline underline-offset-4 transition hover:text-primary"
        >
          I already have an account — sign in
        </Link>
      </div>
    </main>
  );
}

function FieldError({
  error,
  field,
}: {
  error: { field: string; message: string } | null;
  field: string;
}) {
  if (!error || error.field !== field) return null;
  return <p className="mt-2 animate-fade text-sm text-error">{error.message}</p>;
}

function GoogleMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
      />
    </svg>
  );
}
