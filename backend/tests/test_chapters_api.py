import pytest


def _create_chapter(client, novel_id, number=1, title="Chapter One"):
    r = client.post(f"/api/novels/{novel_id}/chapters", json={"chapter_number": number, "title": title})
    assert r.status_code == 201
    return r.json()


# ── CRUD ──────────────────────────────────────────────────────────────────────

def test_create_chapter(client, novel_id):
    ch = _create_chapter(client, novel_id)
    assert ch["chapter_number"] == 1
    assert ch["title"] == "Chapter One"
    assert ch["target_word_count"] is None


def test_list_chapters(client, novel_id):
    _create_chapter(client, novel_id, number=1)
    _create_chapter(client, novel_id, number=2, title="Chapter Two")
    r = client.get(f"/api/novels/{novel_id}/chapters")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    assert data[0]["chapter_number"] == 1
    assert data[1]["chapter_number"] == 2


def test_get_chapter(client, novel_id):
    ch = _create_chapter(client, novel_id)
    r = client.get(f"/api/novels/{novel_id}/chapters/{ch['id']}")
    assert r.status_code == 200
    assert r.json()["id"] == ch["id"]


def test_get_chapter_not_found(client, novel_id):
    r = client.get(f"/api/novels/{novel_id}/chapters/nonexistent")
    assert r.status_code == 404


def test_duplicate_chapter_number_rejected(client, novel_id):
    _create_chapter(client, novel_id, number=1)
    r = client.post(f"/api/novels/{novel_id}/chapters", json={"chapter_number": 1})
    assert r.status_code == 409


def test_update_chapter_title(client, novel_id):
    ch = _create_chapter(client, novel_id)
    r = client.put(f"/api/novels/{novel_id}/chapters/{ch['id']}", json={"title": "Renamed"})
    assert r.status_code == 200
    assert r.json()["title"] == "Renamed"


def test_update_chapter_user_direction(client, novel_id):
    ch = _create_chapter(client, novel_id)
    r = client.put(f"/api/novels/{novel_id}/chapters/{ch['id']}", json={"user_direction": "More drama"})
    assert r.status_code == 200
    assert r.json()["user_direction"] == "More drama"


# ── target_word_count ─────────────────────────────────────────────────────────

def test_set_target_word_count(client, novel_id):
    ch = _create_chapter(client, novel_id)
    r = client.put(f"/api/novels/{novel_id}/chapters/{ch['id']}", json={"target_word_count": 3000})
    assert r.status_code == 200
    assert r.json()["target_word_count"] == 3000


def test_clear_target_word_count(client, novel_id):
    ch = _create_chapter(client, novel_id)
    client.put(f"/api/novels/{novel_id}/chapters/{ch['id']}", json={"target_word_count": 3000})
    r = client.put(f"/api/novels/{novel_id}/chapters/{ch['id']}", json={"target_word_count": None})
    assert r.status_code == 200
    assert r.json()["target_word_count"] is None


def test_target_word_count_not_overwritten_by_unrelated_update(client, novel_id):
    ch = _create_chapter(client, novel_id)
    client.put(f"/api/novels/{novel_id}/chapters/{ch['id']}", json={"target_word_count": 2000})
    r = client.put(f"/api/novels/{novel_id}/chapters/{ch['id']}", json={"title": "New Title"})
    assert r.status_code == 200
    assert r.json()["target_word_count"] == 2000


# ── delete & renumber ─────────────────────────────────────────────────────────

def test_delete_chapter(client, novel_id):
    ch = _create_chapter(client, novel_id)
    r = client.delete(f"/api/novels/{novel_id}/chapters/{ch['id']}")
    assert r.status_code == 204
    assert client.get(f"/api/novels/{novel_id}/chapters/{ch['id']}").status_code == 404


def test_delete_renumbers_remaining(client, novel_id):
    ch1 = _create_chapter(client, novel_id, number=1, title="Ch1")
    ch2 = _create_chapter(client, novel_id, number=2, title="Ch2")
    ch3 = _create_chapter(client, novel_id, number=3, title="Ch3")
    client.delete(f"/api/novels/{novel_id}/chapters/{ch2['id']}")
    r = client.get(f"/api/novels/{novel_id}/chapters")
    numbers = [c["chapter_number"] for c in r.json()]
    assert numbers == [1, 2]
    titles = [c["title"] for c in r.json()]
    assert titles == ["Ch1", "Ch3"]


# ── reorder ───────────────────────────────────────────────────────────────────

def test_reorder_chapters(client, novel_id):
    ch1 = _create_chapter(client, novel_id, number=1, title="First")
    ch2 = _create_chapter(client, novel_id, number=2, title="Second")
    r = client.post(
        f"/api/novels/{novel_id}/chapters/reorder",
        json={"chapter_ids": [ch2["id"], ch1["id"]]},
    )
    assert r.status_code == 204
    chapters = client.get(f"/api/novels/{novel_id}/chapters").json()
    assert chapters[0]["title"] == "Second"
    assert chapters[1]["title"] == "First"


def test_reorder_wrong_ids_rejected(client, novel_id):
    _create_chapter(client, novel_id, number=1)
    r = client.post(
        f"/api/novels/{novel_id}/chapters/reorder",
        json={"chapter_ids": ["bad-id"]},
    )
    assert r.status_code == 400
