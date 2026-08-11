"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "@/components/Wordmark";
import { nextPath, previousPath, STEPS, stepIndex } from "@/lib/steps";

type StepFrameProps = {
  slug: string;
  question: React.ReactNode;
  helper?: React.ReactNode;
  children?: React.ReactNode;
  canContinue: boolean;
  continueLabel?: string;
  /** Optional steps offer a skip that reads as a real choice, not a failure. */
  skippable?: boolean;
  onContinue?: () => void;
};

/**
 * One question per screen, centred, with the action at the foot of the
 * viewport.
 *
 * The frame is a fixed-height column rather than a page with a floating bar:
 * the question area takes the space that is left, so no step scrolls and the
 * action never moves between screens. Only the question area can scroll, and
 * only on a screen too short to hold it. Enter advances, so anybody typing
 * fast never reaches for the button at all.
 */
export function StepFrame({
  slug,
  question,
  helper,
  children,
  canContinue,
  continueLabel = "Continue",
  skippable = false,
  onContinue,
}: StepFrameProps) {
  const router = useRouter();
  const index = stepIndex(slug);

  const goNext = () => {
    if (!canContinue) return;
    if (onContinue) {
      onContinue();
      return;
    }
    router.push(nextPath(slug));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      // Textareas own their Enter key, and buttons handle their own.
      if (target?.tagName === "TEXTAREA" || target?.tagName === "BUTTON") return;
      if (!canContinue) return;
      event.preventDefault();
      goNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canContinue, slug, onContinue]);

  return (
    <>
      <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 py-4">
        <div key={slug} className="w-full max-w-[720px] animate-rise text-center">
          <p className="label-caps text-secondary">
            Step {index + 1} of {STEPS.length}
          </p>

          <h1 className="display-lg mx-auto mt-4 max-w-xl text-balance text-on-surface">
            {question}
          </h1>

          {helper ? (
            <p className="body-md mx-auto mt-4 max-w-md text-on-surface-variant">
              {helper}
            </p>
          ) : null}

          {children ? <div className="mt-8">{children}</div> : null}
        </div>
      </main>

      <footer className="w-full shrink-0 px-6 pb-6 pt-2">
        <div className="mx-auto flex w-full max-w-[720px] items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <Link
              href={previousPath(slug)}
              className="body-md text-on-surface-variant underline-offset-4 transition hover:text-primary hover:underline"
            >
              Back
            </Link>
            {skippable ? (
              <Link
                href={nextPath(slug)}
                className="label-caps text-on-surface-variant underline underline-offset-4 transition hover:text-primary"
              >
                Skip for now
              </Link>
            ) : null}
          </div>

          <button
            type="button"
            onClick={goNext}
            disabled={!canContinue}
            className="btn-primary label-caps min-w-[180px]"
          >
            <span>{continueLabel}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </>
  );
}
