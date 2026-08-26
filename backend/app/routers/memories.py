from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import and_, delete, func, select
from sqlalchemy.orm import Session

from ..auth import OwnerContext, get_current_owner
from ..database import get_db
from ..models import MediaAsset, Memoir, Memory, MemoryMedia, MemoryStatus
from ..schemas import AttachMediaRequest, MemoryCreateRequest, MemoryListResponse, MemoryPatchRequest, MemoryResponse, MediaItemResponse

router = APIRouter(prefix="/memoirs/{memoir_id}/memories", tags=["memories"])


def _get_owned_memoir_or_404(db: Session, memoir_id: str, owner: OwnerContext) -> None:
    owned = db.execute(
        select(func.count())
        .select_from(Memoir)
        .where(
            and_(
                Memoir.id == memoir_id,
                Memoir.owner_id == str(owner.owner_id),
            )
        )
    ).scalar_one()

    if owned == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memoir not found")


def _get_memory_or_404(db: Session, memoir_id: str, memory_id: str) -> Memory:
    memory = db.execute(
        select(Memory).where(
            and_(
                Memory.id == memory_id,
                Memory.memoir_id == memoir_id,
                Memory.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()

    if memory is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")
    return memory


def _media_for_memory(db: Session, memoir_id: str, memory_id: str) -> list[MediaItemResponse]:
    rows = db.execute(
        select(MediaAsset.id, MediaAsset.kind, MediaAsset.caption, MediaAsset.storage_key)
        .join(MemoryMedia, MemoryMedia.media_asset_id == MediaAsset.id)
        .where(
            and_(
                MemoryMedia.memoir_id == memoir_id,
                MemoryMedia.memory_id == memory_id,
                MediaAsset.memoir_id == memoir_id,
            )
        )
        .order_by(MemoryMedia.position.asc())
    ).all()

    return [
        MediaItemResponse(id=row.id, kind=row.kind, caption=row.caption, playback_ref=row.storage_key)
        for row in rows
    ]


def _to_response(db: Session, memory: Memory) -> MemoryResponse:
    return MemoryResponse(
        id=UUID(memory.id),
        memoir_id=UUID(memory.memoir_id),
        prompt_id=UUID(memory.prompt_id) if memory.prompt_id else None,
        title=memory.title,
        body_text=memory.body_text,
        status=memory.status,
        submitted_at=memory.submitted_at,
        created_at=memory.created_at,
        updated_at=memory.updated_at,
        media=_media_for_memory(db, memory.memoir_id, memory.id),
    )


@router.post("", response_model=MemoryResponse, status_code=status.HTTP_201_CREATED)
def create_memory(
    memoir_id: UUID,
    payload: MemoryCreateRequest,
    db: Session = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
) -> MemoryResponse:
    _get_owned_memoir_or_404(db, str(memoir_id), owner)

    memory = Memory(
        memoir_id=str(memoir_id),
        author_participant_id=str(owner.participant_id),
        prompt_id=str(payload.prompt_id) if payload.prompt_id else None,
        status=MemoryStatus.draft,
    )
    db.add(memory)
    db.commit()
    db.refresh(memory)
    return _to_response(db, memory)


@router.patch("/{memory_id}", response_model=MemoryResponse)
def patch_memory(
    memoir_id: UUID,
    memory_id: UUID,
    payload: MemoryPatchRequest,
    db: Session = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
) -> MemoryResponse:
    _get_owned_memoir_or_404(db, str(memoir_id), owner)
    memory = _get_memory_or_404(db, str(memoir_id), str(memory_id))

    updates = payload.model_dump(exclude_unset=True)

    # Last-write-wins is intentional for autosave in this cycle.
    if "title" in updates:
        memory.title = updates["title"]
    if "body_text" in updates:
        memory.body_text = updates["body_text"]
    if "prompt_id" in updates:
        prompt_id = updates["prompt_id"]
        memory.prompt_id = str(prompt_id) if prompt_id is not None else None
    memory.updated_at = datetime.now(timezone.utc)
    db.commit()

    db.refresh(memory)
    return _to_response(db, memory)


@router.post("/{memory_id}/submit", response_model=MemoryResponse)
def submit_memory(
    memoir_id: UUID,
    memory_id: UUID,
    db: Session = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
) -> MemoryResponse:
    _get_owned_memoir_or_404(db, str(memoir_id), owner)
    memory = _get_memory_or_404(db, str(memoir_id), str(memory_id))

    if memory.status == MemoryStatus.submitted:
        return _to_response(db, memory)

    media_count = db.execute(
        select(func.count())
        .select_from(MemoryMedia)
        .where(and_(MemoryMedia.memoir_id == str(memoir_id), MemoryMedia.memory_id == str(memory_id)))
    ).scalar_one()

    has_text = bool((memory.title or "").strip()) or bool((memory.body_text or "").strip())
    if not has_text and media_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot submit an empty memory. Add text or attach media first.",
        )

    memory.status = MemoryStatus.submitted
    memory.submitted_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(memory)
    return _to_response(db, memory)


@router.get("", response_model=MemoryListResponse)
def list_memories(
    memoir_id: UUID,
    db: Session = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
) -> MemoryListResponse:
    _get_owned_memoir_or_404(db, str(memoir_id), owner)

    memories = db.execute(
        select(Memory)
        .where(and_(Memory.memoir_id == str(memoir_id), Memory.deleted_at.is_(None)))
        .order_by(Memory.updated_at.desc())
    ).scalars().all()

    return MemoryListResponse(items=[_to_response(db, memory) for memory in memories])


@router.get("/{memory_id}", response_model=MemoryResponse)
def get_memory(
    memoir_id: UUID,
    memory_id: UUID,
    db: Session = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
) -> MemoryResponse:
    _get_owned_memoir_or_404(db, str(memoir_id), owner)
    memory = _get_memory_or_404(db, str(memoir_id), str(memory_id))
    return _to_response(db, memory)


@router.post("/{memory_id}/media", response_model=MemoryResponse)
def attach_media(
    memoir_id: UUID,
    memory_id: UUID,
    payload: AttachMediaRequest,
    db: Session = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
) -> MemoryResponse:
    _get_owned_memoir_or_404(db, str(memoir_id), owner)
    memory = _get_memory_or_404(db, str(memoir_id), str(memory_id))

    media_asset = db.execute(
        select(MediaAsset).where(MediaAsset.id == str(payload.media_asset_id))
    ).scalar_one_or_none()
    if media_asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media asset not found")
    if media_asset.memoir_id != str(memoir_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Media asset does not belong to this memoir")

    existing = db.execute(
        select(MemoryMedia).where(
            and_(
                MemoryMedia.memory_id == str(memory_id),
                MemoryMedia.media_asset_id == str(payload.media_asset_id),
                MemoryMedia.memoir_id == str(memoir_id),
            )
        )
    ).scalar_one_or_none()

    if existing is None:
        next_position = db.execute(
            select(func.coalesce(func.max(MemoryMedia.position), 0)).where(
                and_(MemoryMedia.memoir_id == str(memoir_id), MemoryMedia.memory_id == str(memory_id))
            )
        ).scalar_one()
        db.add(
            MemoryMedia(
                memory_id=str(memory_id),
                media_asset_id=str(payload.media_asset_id),
                memoir_id=str(memoir_id),
                position=int(next_position) + 1,
            )
        )
        memory.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(memory)

    return _to_response(db, memory)


@router.delete("/{memory_id}/media/{media_asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def detach_media(
    memoir_id: UUID,
    memory_id: UUID,
    media_asset_id: UUID,
    db: Session = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
) -> Response:
    _get_owned_memoir_or_404(db, str(memoir_id), owner)
    _get_memory_or_404(db, str(memoir_id), str(memory_id))

    db.execute(
        delete(MemoryMedia).where(
            and_(
                MemoryMedia.memoir_id == str(memoir_id),
                MemoryMedia.memory_id == str(memory_id),
                MemoryMedia.media_asset_id == str(media_asset_id),
            )
        )
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_memory(
    memoir_id: UUID,
    memory_id: UUID,
    db: Session = Depends(get_db),
    owner: OwnerContext = Depends(get_current_owner),
) -> Response:
    _get_owned_memoir_or_404(db, str(memoir_id), owner)
    memory = _get_memory_or_404(db, str(memoir_id), str(memory_id))

    memory.deleted_at = datetime.now(timezone.utc)
    memory.deleted_by_participant_id = str(owner.participant_id)
    memory.updated_at = datetime.now(timezone.utc)
    db.execute(
        delete(MemoryMedia).where(
            and_(MemoryMedia.memoir_id == str(memoir_id), MemoryMedia.memory_id == str(memory_id))
        )
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
