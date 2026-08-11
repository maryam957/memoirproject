"use client";

import { useEffect, useRef, useState } from "react";
import { StepFrame } from "@/components/StepFrame";
import { useDraft } from "@/lib/draft-context";
import { firstName, pronouns } from "@/lib/draft";

/**
 * Step four: the dedication.
 *
 * The hardest question in the flow, so it is asked last and it is skippable.
 * The placeholder is a real example rather than an instruction — seeing
 * somebody else's specific, slightly funny line about their grandmother is
 * what gives people permission to write one of their own, instead of
 * producing the eulogy they think is expected.
 *
 * If it is skipped, `resolvedDedication()` writes a plain factual line, since
 * `memoirs.short_description` is NOT NULL.
 */
const EXAMPLES = [
  "She made the best parathas in Rawalpindi and never lost an argument.",
  "He fixed everything in the house twice, and the second time it worked.",
  "She fed everyone who came through the door and never asked who they were.",
];

export default function LineStep() {
  const { draft, update } = useDraft();
  const [example, setExample] = useState(EXAMPLES[0]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const name = firstName(draft);
  const forms = pronouns(draft);

  // Chosen once on mount rather than during render, so the server and client
  // agree on the first paint.
  useEffect(() => {
    setExample(EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]);
  }, []);

  return (
    <StepFrame
      slug="line"
      question={<>How would you describe {forms.object} in one line?</>}
      canContinue
      skippable
    >
      <div className="mx-auto max-w-xl text-left">
        <label htmlFor="dedication" className="sr-only">
          One line about {name}
        </label>
        <textarea
          id="dedication"
          ref={textareaRef}
          value={draft.dedication}
          onChange={(event) => update({ dedication: event.target.value })}
          placeholder={example}
          rows={3}
          maxLength={500}
          className="ghost-field resize-none font-display text-2xl italic leading-relaxed text-on-surface placeholder:text-outline-variant/70"
        />

        <div className="mt-5 flex items-start justify-between gap-6">
          <p className="body-md italic text-on-surface-variant">
            This will sit under {forms.possessive} name, like a dedication.
          </p>
          <span className="label-caps shrink-0 pt-1 text-on-surface-variant/70">
            {draft.dedication.length}/500
          </span>
        </div>
      </div>
    </StepFrame>
  );
}
