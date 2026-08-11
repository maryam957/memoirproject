"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import {
  WELCOME_STORAGE_KEY,
  type WelcomeResult,
} from "@/lib/welcome-result";

/**
 * The end of onboarding, and the handover to the console.
 *
 * One thing to do next — send the link — and an honest account of what has
 * and has not happened. Gathering memories is the next feature; this screen
 * closes the loop the flow opened.
 */
export default function WelcomePage() {
  const [result, setResult] = useState<WelcomeResult | null>(null);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    try {
      const stored = window.sessionStorage.getItem(WELCOME_STORAGE_KEY);
      if (stored) setResult(JSON.parse(stored) as WelcomeResult);
    } catch {
      // Falls through to the generic state below.
    }
  }, []);

  if (!result) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[720px] flex-col justify-center px-6 text-center">
        <h1 className="headline-md text-on-surface">Your memoir is saved.</h1>
        <p className="body-md mt-4 text-on-surface-variant">
          We could not find the details of this session in this browser.
        </p>
        <Link href="/" className="label-caps mt-8 text-primary underline">
          Back to the start
        </Link>
      </main>
    );
  }

  const first = result.subjectName.trim().split(/\s+/)[0] || "their";
  const possessive =
    result.pronoun === "she" ? "her" : result.pronoun === "he" ? "his" : "their";
  const fullLink = `${origin}/m/${result.shareSlug}?invite=${result.invitationToken}`;
  const shownLink = `${origin}/m/${result.shareSlug}?invite=${result.invitationToken.slice(
    0,
    10
  )}…`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex w-full justify-center pt-6">
        <Wordmark />
      </header>

      <main className="mx-auto w-full max-w-[720px] flex-1 px-6 py-14">
        <div className="animate-rise text-center">
          <p className="label-caps text-secondary">Saved</p>
          <h1 className="display-lg mt-5 text-balance text-on-surface">
            {first}&apos;s memoir exists now.
          </h1>
          <p className="body-lg mx-auto mt-5 max-w-md text-on-surface-variant">
            It is private, it is yours, and it is waiting for other people&apos;s
            memories of {possessive === "their" ? "them" : possessive === "her" ? "her" : "him"}.
          </p>
        </div>

        <section className="mt-12 animate-settle rounded-[12px] border border-outline-variant/60 bg-surface-container-lowest/60 p-6 delay-1">
          <p className="label-caps text-on-surface-variant">
            The link that gathers everything
          </p>
          <p className="mt-3 break-all font-mono text-sm text-on-surface">
            {shownLink}
          </p>
          <button
            type="button"
            onClick={copy}
            className="btn-primary label-caps mt-5 w-full sm:w-auto"
          >
            {copied ? "Copied" : "Copy the link"}
          </button>
          <p className="body-md mt-4 text-on-surface-variant">
            Nobody has been emailed. Send it to whoever should be in the book —
            they will not need an account.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="headline-sm text-on-surface">What happens next</h2>
          <ol className="body-md mt-5 space-y-5 text-on-surface-variant">
            <li className="border-t border-outline-variant/50 pt-4">
              <span className="label-caps block text-primary">
                1 · You send the link
              </span>
              Whoever opens it can record or write a memory. No account, no app.
            </li>
            <li className="border-t border-outline-variant/50 pt-4">
              <span className="label-caps block text-primary">
                2 · Memories arrive
              </span>
              Recordings are transcribed, and chapters and dates are proposed
              for you to accept or reject.
            </li>
            <li className="border-t border-outline-variant/50 pt-4">
              <span className="label-caps block text-primary">
                3 · You publish, when it is ready
              </span>
              Not before. Publishing is a one-way door, and it is yours to open.
            </li>
          </ol>
        </section>

        {/* Visible in the mockup so the database side of the flow is inspectable. */}
        <details className="mt-14 rounded-[12px] border border-dashed border-outline-variant p-5">
          <summary className="body-md cursor-pointer text-on-surface-variant">
            What this wrote to the database
          </summary>
          <ul className="mt-4 space-y-1 font-mono text-xs text-on-surface-variant">
            {result.rowsWritten.map((row) => (
              <li key={row.table}>
                {row.table}: {row.count} row{row.count === 1 ? "" : "s"}
              </li>
            ))}
            <li>memoir_id: {result.memoirId}</li>
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-on-surface-variant">
            Written through the in-memory adapter, in the order the real
            transaction uses. Only the SHA-256 hash of the invitation token is
            stored; the link above is shown once and never again.
          </p>
        </details>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-outline-variant/50 pt-8">
          <span className="label-caps text-on-surface-variant/70">
            The console arrives with the next feature
          </span>
          <Link
            href="/"
            className="label-caps text-primary underline underline-offset-4"
          >
            Back to the start
          </Link>
        </div>
      </main>
    </div>
  );
}
