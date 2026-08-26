from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from .models import MemoryStatus


class MemoryCreateRequest(BaseModel):
    prompt_id: UUID | None = None


class MemoryPatchRequest(BaseModel):
    title: str | None = None
    body_text: str | None = None
    prompt_id: UUID | None = None


class AttachMediaRequest(BaseModel):
    media_asset_id: UUID


class MediaItemResponse(BaseModel):
    id: UUID
    kind: str
    caption: str | None
    playback_ref: str

    model_config = ConfigDict(from_attributes=True)


class MemoryResponse(BaseModel):
    id: UUID
    memoir_id: UUID
    prompt_id: UUID | None
    title: str | None
    body_text: str | None
    status: MemoryStatus
    submitted_at: datetime | None
    created_at: datetime
    updated_at: datetime
    media: list[MediaItemResponse]


class MemoryListResponse(BaseModel):
    items: list[MemoryResponse]
