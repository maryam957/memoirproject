"use client";

import { useDraft } from "@/lib/draft-context";
import { lifespanLabel, resolvedDedication } from "@/lib/draft";

/**
 * The cover.
 *
 * It is the reason this flow is not a form: the three things the owner is
 * asked for are exactly the three lines printed on it, so handing over the
 * information visibly produces the object they came here to make. It appears
 * whole at step five, and as a small sealed thumbnail on the account screen.
 */
export function BookCover({
  size = "full",
  className = "",
}: {
  size?: "full" | "thumb";
  className?: string;
}) {
  const { draft } = useDraft();
  const name = draft.subjectName.trim();
  const lifespan = lifespanLabel(draft);
  const dedication = resolvedDedication(draft);

  if (size === "thumb") {
    return (
      <div
        className={[
          "relative mx-auto aspect-[3/4] w-[132px] overflow-hidden rounded-[2px]",
          "border border-outline-variant/40 bg-gradient-to-br from-surface-container-lowest via-surface-container-low to-surface-container",
          "shadow-[0_18px_40px_-24px_rgba(28,28,25,0.5)]",
          className,
        ].join(" ")}
      >
        <span className="absolute inset-0 flex items-center justify-center font-display text-2xl text-primary/45">
          {name ? name[0].toUpperCase() : "·"}
        </span>
      </div>
    );
  }

  return (
    <figure
      className={[
        "relative mx-auto w-fit max-w-full rounded-[2px] bg-surface-container-low p-2.5",
        "shadow-[0_30px_60px_-30px_rgba(28,28,25,0.45)]",
        className,
      ].join(" ")}
    >
      {/* Board edge, so it reads as a bound book rather than a card. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-2 rounded-l-[2px] bg-surface-container-high"
      />

      {/* Sized by height and held to a portrait ratio, so the book stays a
          book on a short laptop instead of flattening into a card — and the
          type inside scales with it rather than overflowing. */}
      <div className="flex aspect-4/5 h-[clamp(230px,42vh,440px)] max-w-full flex-col items-center justify-center border border-outline-variant/40 px-6 text-center">
        <h2 className="font-display text-[clamp(1.25rem,3.6vh,2rem)] leading-tight font-semibold text-balance text-on-surface">
          {name || "Their name"}
        </h2>

        {lifespan ? (
          <p className="label-caps mt-[clamp(8px,1.8vh,16px)] animate-fade text-on-surface-variant">
            {lifespan}
          </p>
        ) : null}

        <span
          aria-hidden
          className="mt-[clamp(14px,2.8vh,28px)] block h-px w-20 bg-outline-variant/70"
        />

        <p className="mt-[clamp(14px,2.8vh,28px)] font-display text-[clamp(0.9rem,2.1vh,1.125rem)] italic leading-relaxed text-on-surface-variant">
          &ldquo;{dedication}&rdquo;
        </p>
      </div>
    </figure>
  );
}
