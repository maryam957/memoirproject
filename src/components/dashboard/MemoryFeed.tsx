"use client";

import { useState } from "react";
import Image from "next/image";
import { AudioPlayer } from "./AudioPlayer";
import type { HydratedMemory } from "@/lib/db/mock-adapter";

type MemoryFeedProps = {
  memories: HydratedMemory[];
  onEditMemory: (memory: HydratedMemory) => void;
  onDeleteMemory: (memoryId: string) => Promise<void>;
};

export function MemoryFeed({
  memories,
  onEditMemory,
  onDeleteMemory,
}: MemoryFeedProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteMemory(id);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date(isoString));
    } catch {
      return "Recent memory";
    }
  };

  return (
    <div className="space-y-6">
      {memories.map((memory) => {
        const audioAssets = memory.media.filter((m) => m.kind === "audio");
        const photoAssets = memory.media.filter((m) => m.kind === "photo");

        return (
          <article
            key={memory.id}
            className="animate-rise rounded-[14px] border border-outline-variant/60 bg-surface-container-lowest/90 p-6 shadow-xs transition hover:border-outline-variant md:p-8"
          >
            {/* Header: Date and Actions */}
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-4">
              <time className="font-mono text-xs text-on-surface-variant">
                {formatDate(memory.created_at)}
              </time>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onEditMemory(memory)}
                  className="rounded-[6px] px-2.5 py-1 text-xs font-medium text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(memory.id)}
                  className="rounded-[6px] px-2.5 py-1 text-xs font-medium text-error/80 transition hover:bg-error/10 hover:text-error"
                >
                  Remove
                </button>
              </div>
            </div>

            {/* Title (if present) */}
            {memory.title && (
              <h3 className="headline-sm mt-5 text-on-surface">
                {memory.title}
              </h3>
            )}

            {/* Narrative Body Text (if present) */}
            {memory.body_text && (
              <div className="body-lg mt-3 whitespace-pre-wrap leading-relaxed text-on-surface-variant">
                {memory.body_text}
              </div>
            )}

            {/* Voice Recording(s) */}
            {audioAssets.length > 0 && (
              <div className="mt-5 space-y-3">
                {audioAssets.map((audio) => (
                  <div key={audio.id}>
                    <span className="label-caps mb-1.5 block text-xs text-secondary">
                      Voice recording
                    </span>
                    <AudioPlayer
                      src={audio.playback_url}
                      durationSeconds={audio.duration_seconds}
                    />
                    {audio.caption && (
                      <p className="body-sm mt-1 text-xs italic text-on-surface-variant">
                        {audio.caption}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Photograph(s) */}
            {photoAssets.length > 0 && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {photoAssets.map((photo) => (
                  <figure
                    key={photo.id}
                    className="overflow-hidden rounded-[10px] border border-outline-variant/60 bg-surface-container-low"
                  >
                    <div className="relative aspect-4/3 w-full bg-surface-dim">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.playback_url}
                        alt={photo.caption || "Attached memory photograph"}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    {photo.caption && (
                      <figcaption className="body-sm p-3 text-xs text-on-surface-variant">
                        {photo.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            )}

            {/* Delete Confirmation Dialog */}
            {confirmDeleteId === memory.id && (
              <div className="animate-fade mt-5 rounded-[8px] border border-error/30 bg-error/5 p-4">
                <p className="body-md text-sm font-medium text-on-surface">
                  Remove this memory from the book?
                </p>
                <p className="body-sm mt-1 text-xs text-on-surface-variant">
                  You can always re-create or write it again. This will not affect other memories.
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    disabled={deletingId === memory.id}
                    onClick={() => handleDelete(memory.id)}
                    className="rounded-[6px] bg-error px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-error/90"
                  >
                    {deletingId === memory.id ? "Removing…" : "Yes, remove"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="rounded-[6px] border border-outline-variant px-3 py-1.5 text-xs font-medium text-on-surface hover:bg-surface-container"
                  >
                    Keep memory
                  </button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
