# Feature Specification 02: Memoir Owner Dashboard & Capture Flows

**Status**: Ready for Implementation  
**Audience**: Memoir Owners, Engineering Team  
**Scope**: The Memoir Owner Dashboard, three-way capture flows (written, voice, photo, combined), direct object storage presigned upload seam, dual draft durability, pre-publication editing and deletion.

---

## 1. What is a Memory?

A **Memory** is the foundational narrative unit of The Memoir Project. It is not merely a database record or a file attachment; it represents a meaningful moment, anecdote, reflection, or artifact belonging to the subject's life story.

### Unified Narrative Entity
A single memory may encompass:
- **Written text**: An optional title and a narrative body.
- **Voice recording**: Spoken audio captured directly in browser with pause and re-record capabilities.
- **Photograph**: A picture uploaded with an optional caption.

**Combination Rule (Non-Negotiable)**:  
A person who records ninety seconds of audio about a family bakery and attaches a faded photograph of the storefront has created **one single memory**, not two disconnected items. The data architecture unites them under a single `memory` aggregate linked to `media_asset` records via `memory_media`.

---

## 2. Capture Flows

The owner dashboard provides an intuitive, warm, and uncluttered composer that supports adding memories through three modalities, either independently or combined:

### 2.1 Written Entry
1. Owner opens composer by clicking **"+ Add a memory"** or selecting a curated prompt spark.
2. Owner types an optional title and body text into a clean, serif-styled textarea.
3. Every keystroke is saved immediately to local storage, and debounced to server draft storage after 1.5 seconds.
4. Clicking **"Save Memory"** marks the memory as submitted and places it into the chronological feed.

### 2.2 Voice Recording
1. Owner clicks the microphone capture option.
2. The browser requests microphone permissions (`navigator.mediaDevices.getUserMedia`).
3. During recording:
   - A timer displays elapsed time (`MM:SS`).
   - A live volume meter/waveform gives visual confirmation that speech is being captured.
   - Owner can **Pause** and **Resume** recording at any time.
4. When finished, clicking **Stop** renders an in-browser preview player.
5. If dissatisfied, the owner can click **Re-record**, which discards the recording after a brief confirmation and resets the recorder.
6. When saved, the audio file is uploaded directly to object storage via a presigned URL, and the resulting storage reference is bound to the memory.

### 2.3 Photograph
1. Owner selects or drags & drops an image file (`image/jpeg`, `image/png`, `image/webp`).
2. An instant thumbnail preview is displayed with an input field for an optional caption.
3. Multiple photos can be attached, or replaced/removed prior to final submission.
4. The image file uploads directly to object storage via a presigned URL.

### 2.4 Combined Capture Flow
An owner can combine all three modalities in the same composer instance:
- Type a story, record companion audio commentary, and attach relevant photos.
- All elements appear in the feed as a single rich memory card.

---

## 3. Storage Architecture: Direct-to-Object Seam

**Storage Rule (Non-Negotiable)**:  
Binary files (audio and images) **do not** stream through the application API server and are **never** stored in PostgreSQL.

### Three-Party Exchange:
1. **Permission Request**: Browser sends metadata (`filename`, `mime_type`, `byte_size`, `kind`) to the API: `POST /memoirs/{memoir_id}/media/presign`.
2. **Presigned URL Generation**: API verifies owner permissions, generates a unique storage key (e.g. `memoirs/{memoir_id}/audio/{uuid}.webm`), issues a presigned `PUT` upload URL with an expiry time, and records a `media_asset` entry.
3. **Direct Upload**: The browser issues a direct `PUT` request with binary data to Supabase Object Storage (or local storage adapter in mock mode).
4. **Completion & Linkage**: Browser confirms successful upload and attaches the `media_asset` to the active `memory` via `POST /memoirs/{memoir_id}/memories/{memory_id}/media`.

---

## 4. Save and Resume: Dual-Layer Draft Durability

A half-written memory must never be lost if a user closes a tab, experiences a browser crash, or switches devices.

| Tier | Mechanism | Target Failure Mode | Guarantee |
| :--- | :--- | :--- | :--- |
| **Local Tier** | `localStorage` | Browser crash, tab close, offline interruption | Immediate keystroke protection; survives closed tabs on the same machine. |
| **Server Tier** | API `PATCH /memories/{id}` (`status = 'draft'`) | Switching devices (e.g. laptop to phone) | Cross-device durability; automatically restores draft upon owner sign-in. |

When reopening the dashboard, if an unfinished draft exists, the system displays a gentle notification: *"You have an unfinished memory. Pick up where you left off."*

---

## 5. Editing and Deletion (Pre-Publication Only)

Memoirs remain fully editable while in the `collecting` or `under_review` phases. Immutability only locks the memoir upon formal publication (a future cycle).

- **Editing**: The owner can edit title, narrative text, photo captions, or adjust media attachments.
- **Deletion**: The owner can remove a memory added by mistake. Deletion performs a soft delete (`deleted_at` timestamp), unlinks attachments from the feed, but retains shared media assets referenced elsewhere.

---

## 6. Expected Failure Modes & Human-Centered Recovery

| Failure Scenario | Technical Cause | Human-Centered User Message | System Behavior |
| :--- | :--- | :--- | :--- |
| **Network drop mid-upload** | Lost connection during binary upload or API call | *"We couldn't reach the server just now, but your words and recording are safe on this device. We'll finish saving as soon as you're back online."* | Retains local draft; displays non-technical warning banner; offers manual retry button without clearing inputs. |
| **Microphone denied** | Browser permission blocked or missing hardware | *"Memoir needs permission to use your microphone. Please allow microphone access in your browser settings to record your voice."* | Keeps composer open; allows switching to written text or photo upload without losing progress. |
| **Unsupported file type** | Uploading non-image file or invalid audio | *"Please choose an image file (JPEG, PNG, or WebP) or record audio using the microphone."* | Rejects invalid file cleanly before upload; highlights input area with friendly guidance. |
| **File size limit exceeded** | File > 25MB (photos) or > 50MB (audio) | *"This file is a bit too large to upload directly. Please choose a file smaller than 25MB."* | Prevents network stall; suggests compression. |
| **Device switch mid-draft** | User started on phone, opened on desktop | Seamlessly populated from server draft table. | Loads the server-persisted draft automatically. |

---

## 7. Definition of Done Checklist

- [x] **1. Onboarding Continuity**: Dashboard displays the subject's name ("Nadia"), birth/passing years ("1947 — 2024"), and matches the visual language of onboarding.
- [x] **2. Intentional Empty State**: An empty memoir presents a warm, encouraging welcome with curated prompt suggestions rather than a blank table.
- [x] **3. Written Entry**: Owner can write, save, and see a text memory in the feed.
- [x] **4. Voice Recording**: Browser microphone recording supports pause, resume, re-record, saves to storage, and plays back from storage URL.
- [x] **5. Photograph with Caption**: Owner can upload a photo with caption and view it in the feed.
- [x] **6. Combined Memory**: Owner can attach audio, photo, and text to a single memory item.
- [x] **7. Draft Tab Recovery**: Unsubmitted draft survives closing and reopening the browser tab.
- [x] **8. Edit & Delete**: Owner can fix typos and delete mistakes before publication.
- [x] **9. Cross-Device Persistence**: Data persists after logout and remains intact across sessions.
- [x] **10. Empathetic Error Handling**: Connection loss mid-upload provides non-technical reassurance and prevents data loss.
