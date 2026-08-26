# Memory Lifecycle Backend (FastAPI)

This backend module implements the owner-facing memory lifecycle API for The Memoir Project.

## Run locally

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Auth model used here

A minimal auth stub is used: pass `X-Owner-Id: <uuid>` header. Every endpoint verifies the owner owns the target memoir and returns `404` when it does not.

## Media playback reference assumption

For media responses, `playback_ref` is currently mapped from `media_asset.storage_key`.
This is a placeholder until the sibling upload service contract is finalized for signed URL resolution.
