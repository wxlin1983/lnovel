"""Phase 3 smoke test: chapters CRUD + plan generate/edit/approve, against a running
dev server with LNOVEL_LLM_MOCK=1.

Usage: LNOVEL_LLM_MOCK=1 uv run uvicorn app.main:app & uv run python scripts/smoke_chapter_plan.py
"""

import sys

import httpx

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"


def main() -> None:
    client = httpx.Client(base_url=BASE_URL, timeout=30.0)

    assert client.put("/api/settings", json={"openrouter_api_key": "sk-test-key"}).status_code == 200

    novel = client.post("/api/novels", json={"title": "章節大綱測試小說", "premise": "一個用於章節規劃的測試故事"}).json()
    novel_id = novel["id"]

    storyline = client.post(
        f"/api/novels/{novel_id}/entities",
        json={"type": "storyline", "name": "主線：尋找失落之劍", "description": "主角踏上尋劍之旅"},
    ).json()
    character = client.post(
        f"/api/novels/{novel_id}/entities",
        json={"type": "character", "name": "凱", "fields": {"role": "主角"}, "description": "年輕的劍士"},
    ).json()

    chapter = client.post(f"/api/novels/{novel_id}/chapters", json={"chapter_number": 1, "title": "啟程"}).json()
    chapter_id = chapter["id"]
    assert chapter["status"] == "planned"
    assert chapter["plan"] is None
    print("chapter created:", chapter)

    dup = client.post(f"/api/novels/{novel_id}/chapters", json={"chapter_number": 1, "title": "重複"})
    assert dup.status_code == 409, dup.text
    print("duplicate chapter_number rejected ok")

    generated = client.post(
        f"/api/novels/{novel_id}/chapters/{chapter_id}/plan",
        json={"user_direction": "請讓本章充滿懸疑感", "relevant_entity_ids": [character["id"]]},
    ).json()
    assert generated["plan"] is not None and len(generated["plan"]["beats"]) > 0, generated
    assert generated["plan_approved_at"] is None
    print("plan generated:", generated["plan"])

    edited_plan = {
        "beats": [
            {"title": "手動編輯的開場", "summary": "使用者手動調整過的節拍"},
            *generated["plan"]["beats"][1:],
        ]
    }
    edited = client.put(f"/api/novels/{novel_id}/chapters/{chapter_id}/plan", json={"plan": edited_plan}).json()
    assert edited["plan"]["beats"][0]["title"] == "手動編輯的開場"
    assert edited["plan_approved_at"] is None
    print("plan manual edit ok")

    approved = client.post(f"/api/novels/{novel_id}/chapters/{chapter_id}/plan/approve").json()
    assert approved["plan_approved_at"] is not None
    print("plan approved:", approved["plan_approved_at"])

    regenerated = client.post(f"/api/novels/{novel_id}/chapters/{chapter_id}/plan/regenerate", json={}).json()
    assert regenerated["plan_approved_at"] is None, "regenerate must reset approval"
    print("regenerate resets approval ok")

    no_plan_chapter = client.post(f"/api/novels/{novel_id}/chapters", json={"chapter_number": 2}).json()
    not_approved = client.post(f"/api/novels/{novel_id}/chapters/{no_plan_chapter['id']}/plan/approve")
    assert not_approved.status_code == 400, not_approved.text
    print("approve-without-plan rejected ok")

    client.delete(f"/api/novels/{novel_id}")
    print("\nALL CHAPTER PLAN SMOKE CHECKS PASSED")


if __name__ == "__main__":
    main()
