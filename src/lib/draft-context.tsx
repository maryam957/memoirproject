"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { emptyDraft, type MemoirDraft } from "@/lib/draft";

const STORAGE_KEY = "memoir.onboarding.draft.v1";

type DraftContextValue = {
  draft: MemoirDraft;
  /** True once localStorage has been read; screens wait for it before painting. */
  hydrated: boolean;
  update: (patch: Partial<MemoirDraft>) => void;
  reset: () => void;
};

const DraftContext = createContext<DraftContextValue | null>(null);

/**
 * Draft state lives in localStorage rather than on the server, for one
 * reason: this flow runs before the account exists. A closed tab, a phone
 * that rings, a person who needs to go and ask a sibling for a date — none of
 * those should cost the answers already given.
 */
export function DraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<MemoirDraft>(emptyDraft);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<MemoirDraft>;
        setDraft({ ...emptyDraft, ...parsed });
      }
    } catch {
      // A malformed or unavailable store is not worth interrupting anyone for.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Private browsing, quota, and so on. The flow still works in-memory.
    }
  }, [draft, hydrated]);

  const update = useCallback((patch: Partial<MemoirDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setDraft(emptyDraft);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(
    () => ({ draft, hydrated, update, reset }),
    [draft, hydrated, update, reset]
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): DraftContextValue {
  const context = useContext(DraftContext);
  if (!context) {
    throw new Error("useDraft must be used inside a DraftProvider");
  }
  return context;
}
