from __future__ import annotations

import uuid

from conftest import get_memory_row, has_memory_media_row, owner_headers, seed_media_asset


def _create_memory(client, memoir_id: str, owner_id: str, payload: dict | None = None) -> dict:
    res = client.post(f"/memoirs/{memoir_id}/memories", json=payload or {}, headers=owner_headers(owner_id))
    assert res.status_code == 201
    return res.json()


def test_create_patch_submit_get_roundtrip(client, memoir_ids, owners):
    created = _create_memory(client, memoir_ids["a"], owners["a"], {"prompt_id": str(uuid.uuid4())})

    patch_res = client.patch(
        f"/memoirs/{memoir_ids['a']}/memories/{created['id']}",
        json={"title": "Summer Porch Story"},
        headers=owner_headers(owners["a"]),
    )
    assert patch_res.status_code == 200
    patched = patch_res.json()
    assert patched["title"] == "Summer Porch Story"
    assert patched["body_text"] is None
    assert patched["prompt_id"] == created["prompt_id"]

    patch_res_2 = client.patch(
        f"/memoirs/{memoir_ids['a']}/memories/{created['id']}",
        json={"body_text": "We sat under the elm tree."},
        headers=owner_headers(owners["a"]),
    )
    assert patch_res_2.status_code == 200

    submit_res = client.post(
        f"/memoirs/{memoir_ids['a']}/memories/{created['id']}/submit",
        headers=owner_headers(owners["a"]),
    )
    assert submit_res.status_code == 200
    submitted = submit_res.json()
    assert submitted["status"] == "submitted"
    assert submitted["submitted_at"] is not None

    get_res = client.get(
        f"/memoirs/{memoir_ids['a']}/memories/{created['id']}",
        headers=owner_headers(owners["a"]),
    )
    assert get_res.status_code == 200
    fetched = get_res.json()
    assert fetched["title"] == "Summer Porch Story"
    assert fetched["body_text"] == "We sat under the elm tree."
    assert fetched["status"] == "submitted"


def test_draft_durability_across_fresh_authenticated_request_context(db_session_factory, db_url, memoir_ids, owners):
    from fastapi.testclient import TestClient

    from app.database import get_db
    from app.main import create_app

    app_1 = create_app()

    def override_get_db_1():
        db = db_session_factory()
        try:
            yield db
        finally:
            db.close()

    app_1.dependency_overrides[get_db] = override_get_db_1
    with TestClient(app_1) as client_1:
        created = _create_memory(client_1, memoir_ids["a"], owners["a"])
        memory_id = created["id"]
        res = client_1.patch(
            f"/memoirs/{memoir_ids['a']}/memories/{memory_id}",
            json={"title": "Saved title", "body_text": "Saved text"},
            headers=owner_headers(owners["a"]),
        )
        assert res.status_code == 200

    app_2 = create_app()

    def override_get_db_2():
        db = db_session_factory()
        try:
            yield db
        finally:
            db.close()

    app_2.dependency_overrides[get_db] = override_get_db_2
    with TestClient(app_2) as client_2:
        get_res = client_2.get(
            f"/memoirs/{memoir_ids['a']}/memories/{memory_id}",
            headers=owner_headers(owners["a"]),
        )
        assert get_res.status_code == 200
        data = get_res.json()
        assert data["title"] == "Saved title"
        assert data["body_text"] == "Saved text"


def test_attach_detach_media_and_cross_memoir_rejection(client, db_session_factory, memoir_ids, owners):
    created = _create_memory(client, memoir_ids["a"], owners["a"])
    media_a = seed_media_asset(db_session_factory, memoir_ids["a"], kind="photo", caption="old porch")
    media_b = seed_media_asset(db_session_factory, memoir_ids["b"], kind="audio", caption="different memoir")

    attach_ok = client.post(
        f"/memoirs/{memoir_ids['a']}/memories/{created['id']}/media",
        json={"media_asset_id": media_a},
        headers=owner_headers(owners["a"]),
    )
    assert attach_ok.status_code == 200
    assert has_memory_media_row(db_session_factory, created["id"], media_a)

    detach = client.delete(
        f"/memoirs/{memoir_ids['a']}/memories/{created['id']}/media/{media_a}",
        headers=owner_headers(owners["a"]),
    )
    assert detach.status_code == 204
    assert not has_memory_media_row(db_session_factory, created["id"], media_a)

    # Detaching the link must not delete the asset itself.
    with db_session_factory() as db:
        from app.models import MediaAsset

        assert db.get(MediaAsset, media_a) is not None

    attach_wrong = client.post(
        f"/memoirs/{memoir_ids['a']}/memories/{created['id']}/media",
        json={"media_asset_id": media_b},
        headers=owner_headers(owners["a"]),
    )
    assert attach_wrong.status_code == 400


def test_delete_memory_soft_deletes_and_keeps_shared_asset(client, db_session_factory, memoir_ids, owners):
    m1 = _create_memory(client, memoir_ids["a"], owners["a"])
    m2 = _create_memory(client, memoir_ids["a"], owners["a"])
    shared_media = seed_media_asset(db_session_factory, memoir_ids["a"], kind="photo")

    for memory_id in (m1["id"], m2["id"]):
        res = client.post(
            f"/memoirs/{memoir_ids['a']}/memories/{memory_id}/media",
            json={"media_asset_id": shared_media},
            headers=owner_headers(owners["a"]),
        )
        assert res.status_code == 200

    del_res = client.delete(
        f"/memoirs/{memoir_ids['a']}/memories/{m1['id']}",
        headers=owner_headers(owners["a"]),
    )
    assert del_res.status_code == 204

    row = get_memory_row(db_session_factory, m1["id"])
    assert row is not None
    assert row.deleted_at is not None
    assert not has_memory_media_row(db_session_factory, m1["id"], shared_media)

    list_res = client.get(f"/memoirs/{memoir_ids['a']}/memories", headers=owner_headers(owners["a"]))
    assert list_res.status_code == 200
    ids = [item["id"] for item in list_res.json()["items"]]
    assert m1["id"] not in ids
    assert m2["id"] in ids

    with db_session_factory() as db:
        from app.models import MediaAsset

        assert db.get(MediaAsset, shared_media) is not None


def test_cross_memoir_access_returns_404(client, db_session_factory, memoir_ids, owners):
    memory_b = _create_memory(client, memoir_ids["b"], owners["b"])
    media_b = seed_media_asset(db_session_factory, memoir_ids["b"])

    checks = [
        ("get", f"/memoirs/{memoir_ids['b']}/memories"),
        ("post", f"/memoirs/{memoir_ids['b']}/memories"),
        ("get", f"/memoirs/{memoir_ids['b']}/memories/{memory_b['id']}"),
        ("patch", f"/memoirs/{memoir_ids['b']}/memories/{memory_b['id']}"),
        ("post", f"/memoirs/{memoir_ids['b']}/memories/{memory_b['id']}/submit"),
        ("post", f"/memoirs/{memoir_ids['b']}/memories/{memory_b['id']}/media"),
        ("delete", f"/memoirs/{memoir_ids['b']}/memories/{memory_b['id']}/media/{media_b}"),
        ("delete", f"/memoirs/{memoir_ids['b']}/memories/{memory_b['id']}"),
    ]

    for method, url in checks:
        kwargs = {"headers": owner_headers(owners["a"])}
        if method == "post" and url.endswith("/memories"):
            kwargs["json"] = {}
        if method == "patch":
            kwargs["json"] = {"title": "unauthorized"}
        if method == "post" and url.endswith("/media"):
            kwargs["json"] = {"media_asset_id": media_b}

        response = getattr(client, method)(url, **kwargs)
        assert response.status_code == 404


def test_submit_empty_memory_returns_400(client, memoir_ids, owners):
    created = _create_memory(client, memoir_ids["a"], owners["a"])

    submit = client.post(
        f"/memoirs/{memoir_ids['a']}/memories/{created['id']}/submit",
        headers=owner_headers(owners["a"]),
    )
    assert submit.status_code == 400
    assert "Cannot submit an empty memory" in submit.json()["detail"]


def test_submit_is_idempotent(client, memoir_ids, owners):
    created = _create_memory(client, memoir_ids["a"], owners["a"])
    patch = client.patch(
        f"/memoirs/{memoir_ids['a']}/memories/{created['id']}",
        json={"title": "A real memory"},
        headers=owner_headers(owners["a"]),
    )
    assert patch.status_code == 200

    first = client.post(
        f"/memoirs/{memoir_ids['a']}/memories/{created['id']}/submit",
        headers=owner_headers(owners["a"]),
    )
    assert first.status_code == 200

    second = client.post(
        f"/memoirs/{memoir_ids['a']}/memories/{created['id']}/submit",
        headers=owner_headers(owners["a"]),
    )
    assert second.status_code == 200
    assert second.json()["status"] == "submitted"
    assert second.json()["submitted_at"] == first.json()["submitted_at"]
