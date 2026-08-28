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


class MediaPresignRequest(BaseModel):
    kind: str  # "photo" | "audio"
    filename: str
    mime_type: str
    byte_size: int
    caption: str | None = None


class MediaPresignResponse(BaseModel):
    media_asset_id: UUID
    upload_url: str
    storage_key: str
    upload_method: str = "PUT"
    headers: dict[str, str] = {}


class MediaCompleteRequest(BaseModel):
    media_asset_id: UUID
    caption: str | None = None
    duration_seconds: float | None = None
    width_pixels: int | None = None
    height_pixels: int | None = None


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
