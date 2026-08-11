import Link from "next/link";
import { ArrowRight, BookMark } from "@/components/Wordmark";

/**
 * Arrival, one viewport tall.
 *
 * No sign-up wall and no pricing. One sentence about what this is, one
 * finished memoir so the destination is visible from the door, and a first
 * step that costs nothing. Authentication is five screens away, and the
 * caption says so.
 *
 * The three-line explainer is held back until there is height to spare —
 * nothing here is worth making the first screen scroll for.
 */
export default function Home() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex w-full shrink-0 justify-center py-4">
        <span className="inline-flex items-center gap-2 text-primary">
          <BookMark className="h-5 w-5" />
          <span className="font-display text-lg font-bold tracking-tight">
            The Memoir Project
          </span>
        </span>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-6 py-3 text-center">
        <div className="w-full max-w-[720px]">
          <h1 className="display-lg mx-auto max-w-xl animate-rise text-balance text-on-surface">
            Every family has one story they never wrote down.
          </h1>

          <p className="body-lg mx-auto mt-4 max-w-md animate-rise text-on-surface-variant delay-1">
            Gather memories from the people who love them — in their own voices
            — into one beautiful memoir.
          </p>
        </div>

        {/* A finished cover, not a screenshot of the product. */}
        <figure className="relative w-fit max-w-full animate-settle rounded-[2px] bg-surface-container-low p-2.5 shadow-[0_30px_60px_-30px_rgba(28,28,25,0.45)] delay-2">
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-2 rounded-l-[2px] bg-surface-container-high"
          />
          {/* Portrait, sized by height, so it stays a book on every screen. */}
          <div className="flex aspect-4/5 h-[clamp(190px,34vh,400px)] max-w-full flex-col items-center justify-center px-7 text-center">
            <span className="flex items-center gap-3 text-outline-variant">
              <span className="h-px w-12 bg-current" />
              <BookMark className="h-4 w-4 text-primary/50" />
              <span className="h-px w-12 bg-current" />
            </span>

            <h2 className="mt-[clamp(16px,3vh,28px)] font-display text-[clamp(1.25rem,3.4vh,2rem)] leading-tight font-semibold text-on-surface">
              Ammi Jaan
            </h2>
            <p className="label-caps mt-[clamp(8px,1.4vh,12px)] text-on-surface-variant">
              1948 — 2023
            </p>

            <p className="mt-[clamp(12px,2.4vh,24px)] font-display text-[clamp(0.9rem,2vh,1.125rem)] italic leading-relaxed text-on-surface-variant">
              &ldquo;For the matriarch who held our world together with stories
              and spice.&rdquo;
            </p>
          </div>
        </figure>

        <ul className="body-md tall-only w-full max-w-lg gap-6 text-left sm:grid-cols-3">
          <li>
            <span className="label-caps block text-primary">You start it</span>
            <span className="mt-1 block text-on-surface-variant">
              Four questions about them.
            </span>
          </li>
          <li>
            <span className="label-caps block text-primary">They add to it</span>
            <span className="mt-1 block text-on-surface-variant">
              One link. No account, no app.
            </span>
          </li>
          <li>
            <span className="label-caps block text-primary">You keep it</span>
            <span className="mt-1 block text-on-surface-variant">
              Published when you say so.
            </span>
          </li>
        </ul>
      </main>

      <footer className="w-full shrink-0 px-6 pb-6 pt-2">
        <div className="mx-auto w-full max-w-[720px]">
          <Link
            href="/onboarding/about"
            className="btn-primary headline-sm w-full text-lg"
          >
            <span>Begin their story</span>
            <ArrowRight className="h-5 w-5" />
          </Link>
          <div className="mt-3 flex items-center justify-between">
            <p className="label-caps text-on-surface-variant/80">
              No account needed yet
            </p>
            <Link
              href="/sign-in"
              className="label-caps text-on-surface-variant underline underline-offset-4 transition hover:text-primary"
            >
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
