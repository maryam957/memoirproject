import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export const metadata = { title: "Privacy Policy · The Memoir Project" };

/**
 * A placeholder, not a policy — same reasoning as /terms.
 */
export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex w-full justify-center pt-6">
        <Wordmark />
      </header>
      <main className="mx-auto w-full max-w-[720px] flex-1 px-6 py-16">
        <h1 className="display-lg text-on-surface">Privacy Policy</h1>
        <p className="body-lg mt-6 text-on-surface-variant">
          Not written yet. What this build actually does with data, in the
          meantime:
        </p>
        <ul className="body-md mt-6 space-y-3 text-on-surface-variant">
          <li className="border-t border-outline-variant/50 pt-3">
            Your answers stay in this browser&apos;s local storage until you
            create an account. Nothing is sent to a server before that.
          </li>
          <li className="border-t border-outline-variant/50 pt-3">
            Creating an account writes five rows: an auth user, a profile, the
            memoir, your contributor record, and one analytics event.
          </li>
          <li className="border-t border-outline-variant/50 pt-3">
            Memoirs are private by default. Nothing is published, indexed or
            shared with anyone until you decide it is.
          </li>
          <li className="border-t border-outline-variant/50 pt-3">
            Share links are stored as a SHA-256 hash. The link itself is shown
            to you once.
          </li>
        </ul>
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
