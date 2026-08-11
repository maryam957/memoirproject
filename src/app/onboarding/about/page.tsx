"use client";

import { useState } from "react";
import { StepFrame } from "@/components/StepFrame";
import { useDraft } from "@/lib/draft-context";
import {
  PRONOUN_OPTIONS,
  RELATIONSHIP_CARDS,
  type Pronoun,
} from "@/lib/draft";

/**
 * Step one: who the memoir is about, in relation to the person starting it.
 *
 * It is asked first because it is the easiest question in the flow — a tap,
 * no typing, no recall — and because the answer changes every screen after
 * it. The pronoun travels with the card, so the rest of the flow can say
 * "her name" without ever inferring gender from a name. The two cards that
 * carry no assumption ask instead.
 */
export default function AboutStep() {
  const { draft, update } = useDraft();
  const [custom, setCustom] = useState(
    RELATIONSHIP_CARDS.some((card) => card.label === draft.relationship)
      ? ""
      : draft.relationship
  );

  const selectedCard = RELATIONSHIP_CARDS.find(
    (card) => card.label === draft.relationship
  );
  const asksMore = selectedCard?.asks ?? false;
  const isSomeoneElse = draft.relationship === "Someone else";

  return (
    <StepFrame
      slug="about"
      question={<>Who is this story about?</>}
      helper="It only takes a few answers to begin. Everything can be changed later."
      canContinue={draft.relationship.trim().length > 0}
      skippable
    >
      <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
        {RELATIONSHIP_CARDS.map((card) => (
          <button
            key={card.label}
            type="button"
            data-selected={draft.relationship === card.label}
            onClick={() => {
              update({ relationship: card.label, pronoun: card.pronoun });
              setCustom("");
            }}
            className="choice-card body-md text-on-surface"
          >
            {card.label}
          </button>
        ))}
      </div>

      {asksMore ? (
        <div className="mx-auto mt-8 max-w-md animate-settle space-y-6">
          {isSomeoneElse ? (
            <div>
              <label
                htmlFor="custom-relationship"
                className="label-caps block text-on-surface-variant"
              >
                Who were they to you?
              </label>
              <input
                id="custom-relationship"
                value={custom}
                onChange={(event) => {
                  setCustom(event.target.value);
                }}
                onBlur={() => {
                  if (custom.trim()) update({ relationship: custom.trim() });
                }}
                placeholder="My aunt, my oldest friend, my teacher…"
                maxLength={120}
                className="ghost-field mt-3 text-center font-display text-xl"
              />
            </div>
          ) : null}

          <div>
            <p className="label-caps text-on-surface-variant">
              Which words should we use?
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {PRONOUN_OPTIONS.map((option) => (
                <PronounChip
                  key={option.value}
                  value={option.value}
                  label={option.label}
                  selected={draft.pronoun === option.value}
                  onSelect={() => update({ pronoun: option.value })}
                />
              ))}
            </div>
            <p className="mt-3 text-sm text-on-surface-variant/80">
              We would rather ask than guess from a name.
            </p>
          </div>
        </div>
      ) : null}
    </StepFrame>
  );
}

function PronounChip({
  value,
  label,
  selected,
  onSelect,
}: {
  value: Pronoun;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      data-pronoun={value}
      className={[
        "rounded-[12px] border px-4 py-2 text-sm transition",
        selected
          ? "border-primary bg-primary/8 text-primary"
          : "border-outline-variant text-on-surface-variant hover:border-primary-container",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
