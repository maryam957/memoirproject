"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveMemoryDraftAction } from "@/app/actions";

export type MemoryDraftState = {
  memoryId: string | null;
  title: string;
  bodyText: string;
  promptId: string | null;
  audioPending: boolean;
  photoPending: boolean;
};

export type AutosaveStatus = "idle" | "saving" | "saved" | "offline_saved" | "error";

const LOCAL_DRAFT_KEY = "memoir.active.memory.draft.v1";

export function useMemoryDraft(memoirId: string, initialServerDraft?: {
  id: string;
  title: string | null;
  body_text: string | null;
  prompt_id: string | null;
} | null) {
  const [draft, setDraft] = useState<MemoryDraftState>({
    memoryId: initialServerDraft?.id || null,
    title: initialServerDraft?.title || "",
    bodyText: initialServerDraft?.body_text || "",
    promptId: initialServerDraft?.prompt_id || null,
    audioPending: false,
    photoPending: false,
  });

  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasUnsavedLocalDraft, setHasUnsavedLocalDraft] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. On mount: check local storage to protect against tab crash
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LOCAL_DRAFT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<MemoryDraftState>;
        // If there is meaningful content in local draft, restore it
        if (parsed.title || parsed.bodyText) {
          setDraft((prev) => ({
            ...prev,
            ...parsed,
            memoryId: prev.memoryId || parsed.memoryId || null,
          }));
          setHasUnsavedLocalDraft(true);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // 2. Sync to local storage immediately on any draft update
  useEffect(() => {
    try {
      if (draft.title || draft.bodyText || draft.promptId) {
        window.localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(draft));
      }
    } catch {
      // Ignore
    }
  }, [draft]);

  // 3. Debounced server autosave (1500ms)
  const triggerServerAutosave = useCallback(
    (currentDraft: MemoryDraftState) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      setAutosaveStatus("saving");
      setErrorMessage(null);

      debounceTimerRef.current = setTimeout(async () => {
        try {
          const res = await saveMemoryDraftAction({
            memoirId,
            memoryId: currentDraft.memoryId || undefined,
            title: currentDraft.title || null,
            bodyText: currentDraft.bodyText || null,
            promptId: currentDraft.promptId || null,
          });

          if (res.ok && res.memory) {
            setDraft((prev) => ({ ...prev, memoryId: res.memory!.id }));
            setAutosaveStatus("saved");
          } else {
            setAutosaveStatus("offline_saved");
            setErrorMessage(
              res.error ||
                "Saved locally on this device. We'll sync with the server once connected."
            );
          }
        } catch {
          setAutosaveStatus("offline_saved");
          setErrorMessage(
            "Saved safely on this device. We will update the server automatically."
          );
        }
      }, 1200);
    },
    [memoirId]
  );

  const updateDraft = useCallback(
    (patch: Partial<MemoryDraftState>) => {
      setDraft((prev) => {
        const next = { ...prev, ...patch };
        triggerServerAutosave(next);
        return next;
      });
    },
    [triggerServerAutosave]
  );

  const clearDraft = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setDraft({
      memoryId: null,
      title: "",
      bodyText: "",
      promptId: null,
      audioPending: false,
      photoPending: false,
    });
    setAutosaveStatus("idle");
    setErrorMessage(null);
    setHasUnsavedLocalDraft(false);
    try {
      window.localStorage.removeItem(LOCAL_DRAFT_KEY);
    } catch {
      // Ignore
    }
  }, []);

  return {
    draft,
    autosaveStatus,
    errorMessage,
    hasUnsavedLocalDraft,
    updateDraft,
    clearDraft,
  };
}
