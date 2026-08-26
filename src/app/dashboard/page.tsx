"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/Wordmark";
import { EmptyMemoryState } from "@/components/dashboard/EmptyMemoryState";
import { MemoryFeed } from "@/components/dashboard/MemoryFeed";
import { MemoryComposer } from "@/components/dashboard/MemoryComposer";
import {
  deleteMemoryAction,
  getDashboardData,
  type MemoirDashboardData,
} from "@/app/actions";
import { WELCOME_STORAGE_KEY, type WelcomeResult } from "@/lib/welcome-result";
import type { HydratedMemory } from "@/lib/db/mock-adapter";

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<MemoirDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [editingMemory, setEditingMemory] = useState<HydratedMemory | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadData = () => {
    startTransition(async () => {
      let activeMemoirId: string | undefined = undefined;

      try {
        const storedWelcome = window.sessionStorage.getItem(WELCOME_STORAGE_KEY);
        if (storedWelcome) {
          const parsed = JSON.parse(storedWelcome) as WelcomeResult;
          activeMemoirId = parsed.memoirId;
        }
      } catch {
        // Fallback to default/demo memoir
      }

      const result = await getDashboardData(activeMemoirId);
      setData(result);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenComposer = (mode?: "text" | "audio" | "photo") => {
    setEditingMemory(null);
    setSelectedPrompt(null);
    setComposerOpen(true);
  };

  const handleSelectPrompt = (promptText: string) => {
    setEditingMemory(null);
    setSelectedPrompt(promptText);
    setComposerOpen(true);
  };

  const handleEditMemory = (memory: HydratedMemory) => {
    setSelectedPrompt(null);
    setEditingMemory(memory);
    setComposerOpen(true);
  };

  const handleDeleteMemory = async (memoryId: string) => {
    if (!data) return;
    await deleteMemoryAction({
      memoirId: data.memoir.id,
      memoryId,
    });
    loadData();
  };

  const handleSignOut = () => {
    try {
      window.sessionStorage.removeItem(WELCOME_STORAGE_KEY);
    } catch {
      // Ignore
    }
    router.push("/sign-in");
  };

  if (loading || !data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[720px] flex-col items-center justify-center px-6 text-center">
        <p className="font-display text-lg text-on-surface-variant animate-pulse">
          Opening the book…
        </p>
      </main>
    );
  }

  const { memoir, memories } = data;
  const birthYear = memoir.birthDate ? memoir.birthDate.slice(0, 4) : "";
  const deathYear = memoir.deathDate ? memoir.deathDate.slice(0, 4) : "";
  const yearsSpan =
    birthYear && deathYear
      ? `${birthYear} — ${deathYear}`
      : birthYear
      ? `Born ${birthYear}`
      : "";

  return (
    <div className="flex min-h-screen flex-col pb-24">
      {/* Top navigation header */}
      <header className="sticky top-0 z-30 border-b border-outline-variant/50 bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Wordmark />

          <div className="flex items-center gap-4">
            <span className="label-caps hidden text-xs text-secondary sm:inline-block">
              Status: {memoir.status === "collecting" ? "Gathering memories" : memoir.status}
            </span>

            <button
              type="button"
              onClick={handleSignOut}
              className="label-caps text-xs text-on-surface-variant hover:text-primary transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Memoir Hero Header */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pt-10">
        <div className="animate-rise border-b border-outline-variant/60 pb-8 text-left sm:text-center">
          <span className="label-caps text-xs text-primary">The Memoir Book</span>
          <h1 className="display-lg mt-3 text-balance text-on-surface">
            {memoir.subjectName}&apos;s Story
          </h1>

          {yearsSpan && (
            <p className="font-mono text-sm tracking-wider text-secondary mt-2">
              {yearsSpan}
            </p>
          )}

          {memoir.dedication && (
            <p className="body-lg mx-auto mt-4 max-w-lg italic text-on-surface-variant">
              &ldquo;{memoir.dedication}&rdquo;
            </p>
          )}

          {/* Add Memory Button */}
          <div className="mt-8 flex justify-start sm:justify-center">
            <button
              type="button"
              onClick={() => handleOpenComposer()}
              className="btn-primary headline-sm flex items-center gap-2.5 px-6 py-3 text-base shadow-sm"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add a memory</span>
            </button>
          </div>
        </div>

        {/* Content Section: Empty State or Memory Feed */}
        <section className="mt-10">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="headline-sm text-on-surface">
              Memories ({memories.length})
            </h2>
            {memories.length > 0 && (
              <span className="label-caps text-xs text-on-surface-variant">
                Unpublished · Editable
              </span>
            )}
          </div>

          {memories.length === 0 ? (
            <EmptyMemoryState
              subjectName={memoir.subjectName}
              onSelectPrompt={handleSelectPrompt}
              onOpenComposer={handleOpenComposer}
            />
          ) : (
            <MemoryFeed
              memories={memories}
              onEditMemory={handleEditMemory}
              onDeleteMemory={handleDeleteMemory}
            />
          )}
        </section>
      </main>

      {/* Composer Modal */}
      {composerOpen && (
        <MemoryComposer
          memoirId={memoir.id}
          subjectName={memoir.subjectName}
          initialMemory={editingMemory}
          initialPrompt={selectedPrompt}
          onClose={() => setComposerOpen(false)}
          onSaved={() => {
            setComposerOpen(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
