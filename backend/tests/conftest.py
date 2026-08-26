from __future__ import annotations

import uuid
from pathlib import Path
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base, get_db
from app.main import create_app
from app.models import MediaAsset, Memoir, Memory, MemoryMedia


@pytest.fixture
def db_url(tmp_path: Path) -> str:
    db_file = tmp_path / "memoir_test.sqlite"
    return f"sqlite:///{db_file.as_posix()}"


@pytest.fixture
def db_session_factory(db_url: str):
    engine = create_engine(db_url, connect_args={"check_same_thread": False}, future=True)
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


@pytest.fixture
def client(db_session_factory) -> Generator[TestClient, None, None]:
    app = create_app()

    def override_get_db() -> Generator[Session, None, None]:
        db = db_session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def owners() -> dict[str, str]:
    return {"a": str(uuid.uuid4()), "b": str(uuid.uuid4())}


@pytest.fixture
def memoir_ids(db_session_factory, owners: dict[str, str]) -> dict[str, str]:
    memoir_a = str(uuid.uuid4())
    memoir_b = str(uuid.uuid4())

    with db_session_factory() as db:
        db.add_all(
            [
                Memoir(id=memoir_a, owner_id=owners["a"]),
                Memoir(id=memoir_b, owner_id=owners["b"]),
            ]
        )
        db.commit()

    return {"a": memoir_a, "b": memoir_b}


def owner_headers(owner_id: str) -> dict[str, str]:
    return {"X-Owner-Id": owner_id}


def seed_media_asset(db_session_factory, memoir_id: str, kind: str = "photo", caption: str | None = None) -> str:
    media_id = str(uuid.uuid4())
    with db_session_factory() as db:
        db.add(
            MediaAsset(
                id=media_id,
                memoir_id=memoir_id,
                kind=kind,
                storage_key=f"media/{media_id}",
                caption=caption,
            )
        )
        db.commit()
    return media_id


def get_memory_row(db_session_factory, memory_id: str) -> Memory | None:
    with db_session_factory() as db:
        return db.get(Memory, memory_id)


def has_memory_media_row(db_session_factory, memory_id: str, media_asset_id: str) -> bool:
    with db_session_factory() as db:
        row = db.get(MemoryMedia, {"memory_id": memory_id, "media_asset_id": media_asset_id})
        return row is not None
