"use client";

import { StepFrame } from "@/components/StepFrame";
import { useDraft } from "@/lib/draft-context";
import {
  firstName,
  parseYear,
  pronouns,
  toBe,
  type LivingStatus,
} from "@/lib/draft";

/**
 * Step three: whether they are still here, and roughly when.
 *
 * The living/remembering choice is asked before the dates because it changes
 * what the product is doing for this person — celebrating a life, or holding
 * a memory — and the copy on both cards says so plainly.
 *
 * The year fields take free text. People write "the 1940s" or "just after
 * partition" far more readily than they pick a date, and a calendar widget
 * asking for an exact date of death is a cruel thing to hand somebody three
 * weeks after a funeral. Whatever they write is echoed back as the year we
 * understood, so nothing is silently reinterpreted.
 */
export default function LifeStep() {
  const { draft, update } = useDraft();
  const name = firstName(draft);
  const forms = pronouns(draft);

  const options: {
    value: LivingStatus;
    title: string;
    detail: string;
  }[] = [
    {
      value: "living",
      // "She's" / "He's" / "They're" — the contraction is how people speak.
      title: `${forms.subject[0].toUpperCase()}${forms.subject.slice(1)}${
        forms.isPlural ? "'re" : "'s"
      } with us`,
      detail: `We'll help you celebrate ${forms.possessive} life`,
    },
    {
      value: "passed",
      title: `We're remembering ${forms.object}`,
      detail: `We'll help you honour ${forms.possessive} memory`,
    },
  ];

  const bornYear = parseYear(draft.bornRaw);
  const passedYear = parseYear(draft.passedRaw);

  return (
    <StepFrame
      slug="life"
      question={
        <>
          {toBe(draft)[0].toUpperCase()}
          {toBe(draft).slice(1)} {name} still with us?
        </>
      }
      canContinue
      skippable
    >
      <div className="mx-auto max-w-md space-y-3">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            data-selected={draft.livingStatus === option.value}
            onClick={() =>
              update({
                livingStatus: option.value,
                passedRaw: option.value === "living" ? "" : draft.passedRaw,
              })
            }
            className="choice-card"
          >
            <span className="headline-sm block text-on-surface">
              {option.title}
            </span>
            <span className="body-md mt-1 block text-on-surface-variant">
              {option.detail}
            </span>
          </button>
        ))}
      </div>

      {draft.livingStatus !== "unsaid" ? (
        <div className="mx-auto mt-10 grid max-w-md animate-settle grid-cols-2 gap-5 text-left">
          <YearField
            id="born"
            label="Born"
            value={draft.bornRaw}
            placeholder="e.g. 1947 or 'the 1940s'"
            understood={bornYear}
            onChange={(value) => update({ bornRaw: value })}
          />

          {draft.livingStatus === "passed" ? (
            <YearField
              id="passed"
              label="Passed"
              value={draft.passedRaw}
              placeholder="e.g. 2023 or 'recently'"
              understood={passedYear}
              onChange={(value) => update({ passedRaw: value })}
            />
          ) : null}
        </div>
      ) : null}
    </StepFrame>
  );
}

function YearField({
  id,
  label,
  value,
  placeholder,
  understood,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  understood: number | null;
  onChange: (value: string) => void;
}) {
  const typed = value.trim().length > 0;

  return (
    <div>
      <label htmlFor={id} className="label-caps block text-on-surface-variant">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={80}
        autoComplete="off"
        className="ghost-field mt-2 font-display text-xl text-on-surface"
      />
      <p className="mt-2 min-h-[20px] text-sm text-on-surface-variant/80">
        {typed
          ? understood
            ? `Recorded as ${understood}.`
            : "No year in that yet — leave it, and add one whenever you know."
          : ""}
      </p>
    </div>
  );
}
