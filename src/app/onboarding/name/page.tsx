"use client";

import { useEffect, useRef } from "react";
import { StepFrame } from "@/components/StepFrame";
import { useDraft } from "@/lib/draft-context";
import { possessive, pronouns } from "@/lib/draft";

/**
 * Step two: the name. The only answer this flow genuinely requires.
 *
 * The field is unlabelled, centred and underlined rather than boxed — closer
 * to writing a name on a title page than to filling in a form. The helper
 * line gives permission to use a nickname, which is the thing people hesitate
 * over: many families never used the name on the birth certificate.
 */
export default function NameStep() {
  const { draft, update, hydrated } = useDraft();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (hydrated) {
      const timer = setTimeout(() => inputRef.current?.focus(), 250);
      return () => clearTimeout(timer);
    }
  }, [hydrated]);

  const their = possessive(draft);

  return (
    <StepFrame
      slug="name"
      question={
        <span className="text-primary">
          What&apos;s {their} name?
        </span>
      }
      canContinue={draft.subjectName.trim().length > 0}
    >
      <div className="mx-auto max-w-md">
        <input
          ref={inputRef}
          value={draft.subjectName}
          onChange={(event) => update({ subjectName: event.target.value })}
          placeholder={`${their[0].toUpperCase()}${their.slice(1)} name`}
          aria-label="Their name"
          maxLength={200}
          autoComplete="off"
          spellCheck={false}
          className="ghost-field headline-md text-center text-on-surface"
        />

        <p className="body-md mt-6 text-on-surface-variant">
          However your family knows {pronouns(draft).object} — a nickname is
          perfect.
        </p>
      </div>
    </StepFrame>
  );
}
