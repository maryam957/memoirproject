from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class MemoryStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"


class MediaLinkType(str, enum.Enum):
    primary = "primary"
    reference = "reference"


class CreatedBy(str, enum.Enum):
    contributor = "contributor"
    owner = "owner"
    ai = "ai"


class Memoir(Base):
    __tablename__ = "memoirs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)


class Memory(Base):
    __tablename__ = "memory"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    memoir_id: Mapped[str] = mapped_column(String(36), ForeignKey("memoirs.id", ondelete="CASCADE"), nullable=False, index=True)
    author_participant_id: Mapped[str] = mapped_column(String(36), nullable=False)
    prompt_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[MemoryStatus] = mapped_column(Enum(MemoryStatus), nullable=False, default=MemoryStatus.draft)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_by_participant_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    media_links: Mapped[list[MemoryMedia]] = relationship("MemoryMedia", back_populates="memory", cascade="all, delete-orphan")


class MediaAsset(Base):
    __tablename__ = "media_asset"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    memoir_id: Mapped[str] = mapped_column(String(36), ForeignKey("memoirs.id", ondelete="CASCADE"), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)


class MemoryMedia(Base):
    __tablename__ = "memory_media"
    __table_args__ = (UniqueConstraint("memory_id", "media_asset_id", name="uq_memory_media_pair"),)

    memory_id: Mapped[str] = mapped_column(String(36), ForeignKey("memory.id", ondelete="CASCADE"), primary_key=True)
    media_asset_id: Mapped[str] = mapped_column(String(36), ForeignKey("media_asset.id", ondelete="CASCADE"), primary_key=True)
    memoir_id: Mapped[str] = mapped_column(String(36), ForeignKey("memoirs.id", ondelete="CASCADE"), nullable=False, index=True)
    link_type: Mapped[MediaLinkType] = mapped_column(Enum(MediaLinkType), nullable=False, default=MediaLinkType.primary)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by: Mapped[CreatedBy] = mapped_column(Enum(CreatedBy), nullable=False, default=CreatedBy.owner)
    confirmed_by_owner: Mapped[bool] = mapped_column(nullable=False, default=True)

    memory: Mapped[Memory] = relationship("Memory", back_populates="media_links")
    media_asset: Mapped[MediaAsset] = relationship("MediaAsset")
