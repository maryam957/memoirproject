import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export const metadata = { title: "Terms of Service · The Memoir Project" };

/**
 * A placeholder, not a policy.
 *
 * The account screen links here, so the link should not 404 — but inventing
 * terms of service for a product that has none would be worse than saying so.
 */
export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex w-full justify-center pt-6">
        <Wordmark />
      </header>
      <main className="mx-auto w-full max-w-[720px] flex-1 px-6 py-16">
        <h1 className="display-lg text-on-surface">Terms of Service</h1>
        <p className="body-lg mt-6 text-on-surface-variant">
          Not written yet. This build covers onboarding and authentication
          only, and publishing invented terms would be worse than an empty
          page.
        </p>
        <p className="body-md mt-6 text-on-surface-variant">
          What they will have to cover: who owns a memoir and its contributions,
          what happens to a memoir if the owner stops paying or dies, how a
          contributor withdraws what they submitted, and how removal requests
          are handled.
        </p>
        <Link
          href="/account"
          className="label-caps mt-10 inline-block text-primary underline underline-offset-4"
        >
          Back
        </Link>
      </main>
    </div>
  );
}
