"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookCover } from "@/components/BookCover";
import { ArrowRight } from "@/components/Wordmark";
import { useDraft } from "@/lib/draft-context";
import { firstName, possessive } from "@/lib/draft";
import { ACCOUNT_PATH } from "@/lib/steps";

/**
 * Step five: the payoff, and the handover to authentication.
 *
 * Four answers become a bound book with their name on it. This is the moment
 * the account request stops being a toll and starts being the obvious next
 * thing — there is now something to lose. The button says what it saves.
 */
export default function CoverStep() {
  const router = useRouter();
  const { draft } = useDraft();
  const name = firstName(draft);

  return (
    <>
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-6 py-3">
        <div className="w-full animate-rise text-center">
          <p className="label-caps text-secondary">Step 5 of 5</p>
          <h1 className="headline-md mx-auto mt-3 max-w-md text-balance text-on-surface">
            Here&apos;s the beginning of {possessive(draft)} story.
          </h1>
        </div>

        <div className="w-full animate-settle delay-1">
          <BookCover />
        </div>

        <p className="body-md max-w-md animate-fade text-center text-on-surface-variant delay-2">
          Nothing is published. The next step creates your account.
        </p>
      </main>

      <footer className="w-full shrink-0 px-6 pb-6 pt-2">
        <div className="mx-auto w-full max-w-[720px]">
          <button
            type="button"
            onClick={() => router.push(ACCOUNT_PATH)}
            className="btn-primary headline-sm w-full text-lg"
          >
            <span>Save {name}&apos;s story</span>
            <ArrowRight className="h-5 w-5" />
          </button>

          <div className="mt-3 flex items-center justify-between">
            <Link
              href="/onboarding/line"
              className="body-md text-on-surface-variant underline-offset-4 transition hover:text-primary hover:underline"
            >
              Back
            </Link>
            <p className="label-caps text-on-surface-variant/80">
              Free to start · invite family in minutes
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
