"use client";

import { useEffect, useRef, useState } from "react";
import { useAudioRecorder } from "@/lib/use-audio-recorder";
import { useMemoryDraft } from "@/lib/use-memory-draft";
import {
  attachMediaAction,
  detachMediaAction,
  presignMediaAction,
  submitMemoryAction,
} from "@/app/actions";
import type { HydratedMemory } from "@/lib/db/mock-adapter";

type MemoryComposerProps = {
  memoirId: string;
  subjectName: string;
  initialMemory?: HydratedMemory | null;
  initialPrompt?: string | null;
  onClose: () => void;
  onSaved: () => void;
};

export function MemoryComposer({
  memoirId,
  subjectName,
  initialMemory,
  initialPrompt,
  onClose,
  onSaved,
}: MemoryComposerProps) {
  const firstName = subjectName.trim().split(/\s+/)[0] || "their";

  // Dual-tier draft management
  const {
    draft,
    autosaveStatus,
    errorMessage: draftError,
    updateDraft,
    clearDraft,
  } = useMemoryDraft(memoirId, initialMemory);

  // Audio recording hook
  const audioRecorder = useAudioRecorder();

  // Local media state for items attached to this memory
  const [attachedMedia, setAttachedMedia] = useState<
    Array<{
      id: string;
      kind: "photo" | "audio";
      playbackUrl: string;
      caption: string | null;
      durationSeconds?: number | null;
      isUploading?: boolean;
    }>
  >(
    (initialMemory?.media || []).map((m) => ({
      id: m.id,
      kind: m.kind === "video" ? "photo" : m.kind,
      playbackUrl: m.playback_url,
      caption: m.caption,
      durationSeconds: m.duration_seconds,
    }))
  );

  const [photoCaption, setPhotoCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // If initialPrompt was passed and title is blank, fill it
  useEffect(() => {
    if (initialPrompt && !draft.title && !draft.bodyText) {
      updateDraft({ title: initialPrompt });
    }
  }, [initialPrompt, draft.title, draft.bodyText, updateDraft]);

  // Handle saving recorded audio to object storage
  const handleSaveAudioRecording = async () => {
    if (!audioRecorder.audioBlob) return;

    setComposerError(null);
    const audioBlob = audioRecorder.audioBlob;
    const duration = audioRecorder.duration;

    // Convert Blob to data URL or persistent URL for mock storage
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result as string;

      try {
        // Step 1: Ask API for presigned permission
        const presignRes = await presignMediaAction({
          memoirId,
          kind: "audio",
          filename: `voice_note_${Date.now()}.webm`,
          mimeType: audioBlob.type || "audio/webm",
          byteSize: audioBlob.size,
          caption: `Voice recording (${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, "0")})`,
          playbackUrl: base64Data, // In mock mode, stores persistent base64 playback ref
        });

        if (!presignRes.ok || !presignRes.presign) {
          throw new Error(presignRes.error || "Could not prepare storage for recording");
        }

        const mediaAssetId = presignRes.presign.mediaAssetId;

        // Step 2: Ensure memory draft exists and attach media
        const currentMemoryId = draft.memoryId;
        if (currentMemoryId) {
          await attachMediaAction({
            memoirId,
            memoryId: currentMemoryId,
            mediaAssetId,
          });
        }

        setAttachedMedia((prev) => [
          ...prev,
          {
            id: mediaAssetId,
            kind: "audio",
            playbackUrl: presignRes.presign!.playbackUrl,
            caption: `Voice recording (${duration}s)`,
            durationSeconds: duration,
          },
        ]);

        audioRecorder.reset();
      } catch (err: unknown) {
        setComposerError(
          "We couldn't save the recording to storage just now, but your words are preserved on this device."
        );
      }
    };
    reader.readAsDataURL(audioBlob);
  };

  // Handle photo file selection and upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setComposerError("Please select an image file (JPEG, PNG, or WebP).");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setComposerError("This image is larger than 25MB. Please choose a smaller image.");
      return;
    }

    setComposerError(null);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result as string;

      try {
        const presignRes = await presignMediaAction({
          memoirId,
          kind: "photo",
          filename: file.name,
          mimeType: file.type,
          byteSize: file.size,
          caption: photoCaption.trim() || null,
          playbackUrl: base64Data,
        });

        if (!presignRes.ok || !presignRes.presign) {
          throw new Error(presignRes.error || "Failed to initialize upload");
        }

        const mediaAssetId = presignRes.presign.mediaAssetId;
        const currentMemoryId = draft.memoryId;
        if (currentMemoryId) {
          await attachMediaAction({
            memoirId,
            memoryId: currentMemoryId,
            mediaAssetId,
          });
        }

        setAttachedMedia((prev) => [
          ...prev,
          {
            id: mediaAssetId,
            kind: "photo",
            playbackUrl: base64Data,
            caption: photoCaption.trim() || null,
          },
        ]);

        setPhotoCaption("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch {
        setComposerError(
          "We couldn't upload the photograph right now. Your text remains safely saved."
        );
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDetachMedia = async (mediaAssetId: string) => {
    if (draft.memoryId) {
      await detachMediaAction({
        memoirId,
        memoryId: draft.memoryId,
        mediaAssetId,
      });
    }
    setAttachedMedia((prev) => prev.filter((m) => m.id !== mediaAssetId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setComposerError(null);

    const hasText = Boolean(draft.title.trim() || draft.bodyText.trim());
    const hasMedia = attachedMedia.length > 0;

    if (!hasText && !hasMedia) {
      setComposerError(
        "Please write a few words, record a voice note, or attach a photo before saving."
      );
      return;
    }

    setSubmitting(true);
    try {
      if (!draft.memoryId) {
        throw new Error("Memory draft was not created yet. Please wait a moment and try again.");
      }

      // Finalize submission
      const res = await submitMemoryAction({
        memoirId,
        memoryId: draft.memoryId,
      });

      if (!res.ok) {
        throw new Error(res.error || "Failed to save memory.");
      }

      clearDraft();
      onSaved();
    } catch (err: unknown) {
      setComposerError((err as Error).message || "An unexpected error occurred while saving.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-xs">
      <div className="animate-rise relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[16px] border border-outline-variant bg-surface p-6 shadow-xl md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/50 pb-4">
          <div>
            <h2 className="headline-sm text-on-surface">
              {initialMemory ? "Edit Memory" : `Add to ${firstName}'s Story`}
            </h2>
            <p className="body-sm mt-0.5 text-xs text-on-surface-variant">
              Text, voice, and photographs can all be part of this one memory.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close composer"
            className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high"
          >
            ✕
          </button>
        </div>

        {/* Autosave & Network Status Indicator */}
        <div className="mt-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-mono text-on-surface-variant">
            <span
              className={`h-2 w-2 rounded-full ${
                autosaveStatus === "saving"
                  ? "animate-pulse bg-primary"
                  : autosaveStatus === "saved"
                  ? "bg-tertiary"
                  : "bg-outline"
              }`}
            />
            <span>
              {autosaveStatus === "saving"
                ? "Saving draft…"
                : autosaveStatus === "saved"
                ? "Draft saved to device & server"
                : autosaveStatus === "offline_saved"
                ? "Saved safely on this device"
                : "Draft ready"}
            </span>
          </div>

          <span className="text-[11px] text-on-surface-variant">
            Survives closed tabs
          </span>
        </div>

        {/* Non-Technical Error Banner */}
        {(composerError || draftError) && (
          <div className="animate-fade mt-3 rounded-[8px] border border-error/30 bg-error/10 p-3 text-xs leading-relaxed text-error">
            {composerError || draftError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-6">
          {/* 1. Written Entry Inputs */}
          <div>
            <label
              htmlFor="memory-title"
              className="label-caps block text-on-surface-variant"
            >
              Title or prompt (optional)
            </label>
            <input
              id="memory-title"
              type="text"
              value={draft.title}
              onChange={(e) => updateDraft({ title: e.target.value })}
              placeholder="e.g. Sunday mornings on the porch"
              className="field mt-1.5 font-display text-base font-semibold"
            />
          </div>

          <div>
            <label
              htmlFor="memory-body"
              className="label-caps block text-on-surface-variant"
            >
              The Story
            </label>
            <textarea
              id="memory-body"
              rows={4}
              value={draft.bodyText}
              onChange={(e) => updateDraft({ bodyText: e.target.value })}
              placeholder="Write whatever comes to mind — a memory, a characteristic, or a story you don't want forgotten."
              className="field mt-1.5 min-h-[120px] font-sans text-base leading-relaxed"
            />
          </div>

          {/* 2. Attached Media Items */}
          {attachedMedia.length > 0 && (
            <div className="space-y-3 rounded-[12px] border border-outline-variant/60 bg-surface-container-low/60 p-4">
              <span className="label-caps block text-xs text-secondary">
                Attached to this memory
              </span>
              <div className="space-y-2">
                {attachedMedia.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-[8px] bg-surface-container p-2.5"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      {m.kind === "photo" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.playbackUrl}
                          alt="Thumbnail"
                          className="h-10 w-10 shrink-0 rounded-[6px] object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          🎤
                        </div>
                      )}
                      <span className="truncate text-xs font-medium text-on-surface">
                        {m.caption || (m.kind === "audio" ? "Voice recording" : "Photograph")}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDetachMedia(m.id)}
                      className="rounded px-2 py-1 text-xs text-error hover:bg-error/10"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Voice Recording Panel */}
          <div className="rounded-[12px] border border-outline-variant/60 bg-surface-container-low/50 p-4">
            <div className="flex items-center justify-between">
              <span className="label-caps block text-xs text-on-surface-variant">
                Voice Recording (Browser Microphone)
              </span>
              {audioRecorder.status !== "idle" && (
                <span className="font-mono text-xs font-semibold text-primary">
                  {Math.floor(audioRecorder.duration / 60)}:
                  {(audioRecorder.duration % 60).toString().padStart(2, "0")}
                </span>
              )}
            </div>

            {audioRecorder.error && (
              <p className="mt-2 text-xs text-error">{audioRecorder.error}</p>
            )}

            {/* Recorder Controls */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {audioRecorder.status === "idle" && (
                <button
                  type="button"
                  onClick={audioRecorder.startRecording}
                  className="btn-ghost label-caps flex items-center gap-2 border border-outline-variant text-xs text-on-surface"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-error" />
                  <span>Start recording</span>
                </button>
              )}

              {audioRecorder.status === "recording" && (
                <>
                  <button
                    type="button"
                    onClick={audioRecorder.pauseRecording}
                    className="btn-ghost label-caps border border-outline-variant text-xs"
                  >
                    Pause
                  </button>
                  <button
                    type="button"
                    onClick={audioRecorder.stopRecording}
                    className="btn-primary label-caps text-xs"
                  >
                    Finish recording
                  </button>
                  {/* Live volume visualizer dot */}
                  <div
                    className="h-3 rounded-full bg-primary transition-all duration-75"
                    style={{ width: `${Math.max(12, audioRecorder.audioLevel * 100)}px` }}
                  />
                </>
              )}

              {audioRecorder.status === "paused" && (
                <>
                  <button
                    type="button"
                    onClick={audioRecorder.resumeRecording}
                    className="btn-ghost label-caps border border-outline-variant text-xs text-primary"
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={audioRecorder.stopRecording}
                    className="btn-primary label-caps text-xs"
                  >
                    Finish recording
                  </button>
                </>
              )}

              {audioRecorder.status === "stopped" && audioRecorder.audioUrl && (
                <div className="flex w-full flex-wrap items-center gap-2 pt-2">
                  <audio
                    src={audioRecorder.audioUrl}
                    controls
                    className="h-9 max-w-xs"
                  />
                  <button
                    type="button"
                    onClick={handleSaveAudioRecording}
                    className="btn-primary label-caps text-xs"
                  >
                    Attach recording to memory
                  </button>
                  <button
                    type="button"
                    onClick={audioRecorder.reRecord}
                    className="btn-ghost label-caps border border-outline-variant text-xs"
                  >
                    Re-record
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 4. Photograph Attachment Panel */}
          <div className="rounded-[12px] border border-outline-variant/60 bg-surface-container-low/50 p-4">
            <span className="label-caps block text-xs text-on-surface-variant">
              Attach a Photograph
            </span>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                onChange={handlePhotoUpload}
                id="photo-file-input"
                className="hidden"
              />

              <label
                htmlFor="photo-file-input"
                className="btn-ghost label-caps flex cursor-pointer items-center gap-2 border border-outline-variant text-xs text-on-surface hover:bg-surface-container"
              >
                <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Select image file</span>
              </label>

              <input
                type="text"
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
                placeholder="Optional caption (e.g. Summer 1974)"
                className="field max-w-xs text-xs"
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-outline-variant/50 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost label-caps text-xs text-on-surface-variant"
            >
              Keep editing later
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary headline-sm px-6 py-2.5 text-sm"
            >
              {submitting ? "Saving to the book…" : "Save memory"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
