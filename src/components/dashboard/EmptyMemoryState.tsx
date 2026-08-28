"use client";

type EmptyMemoryStateProps = {
  subjectName: string;
  onSelectPrompt: (promptText: string) => void;
  onOpenComposer: (mode?: "text" | "audio" | "photo") => void;
};

export const PROMPTS = [
  {
    id: "p1",
    label: "A familiar saying",
    question: "What was a phrase, proverb, or joke they always used to repeat?",
    hint: "Even two sentences will keep the sound of their voice alive.",
  },
  {
    id: "p2",
    label: "A quiet moment",
    question: "Describe a favorite evening, dinner, or ordinary Sunday with them.",
    hint: "The small rituals often matter more than the holidays.",
  },
  {
    id: "p3",
    label: "An early photograph",
    question: "Add a photograph of them when they were young, and what was happening.",
    hint: "Upload an image with a short note about the year or setting.",
  },
];

export function EmptyMemoryState({
  subjectName,
  onSelectPrompt,
  onOpenComposer,
}: EmptyMemoryStateProps) {
  const firstName = subjectName.trim().split(/\s+/)[0] || "their";

  return (
    <section className="animate-rise my-8 rounded-[16px] border border-outline-variant/60 bg-surface-container-lowest/80 p-8 text-center shadow-xs md:p-12">
      <div className="mx-auto max-w-xl">
        <span className="label-caps inline-block rounded-full bg-primary-fixed/40 px-3 py-1 text-primary">
          The Beginning of {firstName}&apos;s Book
        </span>

        <h2 className="headline-md mt-4 text-balance text-on-surface">
          Every life story begins with a single recollection.
        </h2>

        <p className="body-md mt-3 text-balance text-on-surface-variant">
          This workspace is where memories collect before they are bound and shared.
          There are no rules about where to start — write a few sentences, record a ninety-second voice note, or upload a cherished photograph.
        </p>

        {/* Quick action triggers */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => onOpenComposer("text")}
            className="btn-primary label-caps flex items-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Write a memory</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenComposer("audio")}
            className="btn-ghost label-caps flex items-center gap-2 border border-outline-variant text-on-surface"
          >
            <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <span>Record voice</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenComposer("photo")}
            className="btn-ghost label-caps flex items-center gap-2 border border-outline-variant text-on-surface"
          >
            <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Attach photograph</span>
          </button>
        </div>

        {/* Curated Prompt Sparks */}
        <div className="mt-12 text-left">
          <p className="label-caps text-on-surface-variant/80 text-center md:text-left">
            Or begin with a gentle prompt:
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {PROMPTS.map((prompt) => (
              <button
                key={prompt.id}
                type="button"
                onClick={() => onSelectPrompt(prompt.question)}
                className="group flex flex-col justify-between rounded-[12px] border border-outline-variant/50 bg-surface-container-low/60 p-4 text-left transition hover:border-primary hover:bg-surface-container-low"
              >
                <div>
                  <span className="label-caps block text-xs text-primary group-hover:underline">
                    {prompt.label}
                  </span>
                  <p className="body-md mt-2 text-sm font-medium text-on-surface">
                    &ldquo;{prompt.question}&rdquo;
                  </p>
                </div>
                <p className="body-sm mt-3 text-xs text-on-surface-variant">
                  {prompt.hint}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
