from dataclasses import dataclass
from uuid import UUID

from fastapi import Header, HTTPException, status


@dataclass(frozen=True)
class OwnerContext:
    owner_id: UUID
    participant_id: UUID


async def get_current_owner(x_owner_id: str | None = Header(default=None, alias="X-Owner-Id")) -> OwnerContext:
    if not x_owner_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing owner session")

    try:
        owner_uuid = UUID(x_owner_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid owner session") from exc

    # In this cycle we treat the authenticated owner as the acting participant.
    return OwnerContext(owner_id=owner_uuid, participant_id=owner_uuid)
