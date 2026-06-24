"""Phase 1 smoke test: exercises settings/novels/entities CRUD against a running dev server.

Usage: uv run python scripts/smoke.py [base_url]
"""

import sys

import httpx

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"


def main() -> None:
    client = httpx.Client(base_url=BASE_URL)

    health = client.get("/api/health")
    assert health.status_code == 200 and health.json()["ok"] is True, health.text
    print("health check ok")

    settings_resp = client.put("/api/settings", json={"openrouter_api_key": "sk-test-key", "preferred_model": "qwen/qwen-2.5-72b-instruct:free"})
    assert settings_resp.status_code == 200, settings_resp.text
    body = settings_resp.json()
    assert body["has_key"] is True
    assert body["preferred_model"] == "qwen/qwen-2.5-72b-instruct:free"
    print("settings update ok:", body)

    novel_resp = client.post("/api/novels", json={"title": "測試小說", "premise": "一個用於煙霧測試的故事"})
    assert novel_resp.status_code == 201, novel_resp.text
    novel = novel_resp.json()
    novel_id = novel["id"]
    print("novel created:", novel)

    list_resp = client.get("/api/novels")
    assert list_resp.status_code == 200
    assert any(n["id"] == novel_id for n in list_resp.json())
    print("novel list ok")

    update_resp = client.put(f"/api/novels/{novel_id}", json={"premise": "更新後的故事大綱"})
    assert update_resp.status_code == 200
    assert update_resp.json()["premise"] == "更新後的故事大綱"
    print("novel update ok")

    char_resp = client.post(
        f"/api/novels/{novel_id}/entities",
        json={
            "type": "character",
            "name": "林小明",
            "fields": {"role": "主角", "personality": "勇敢"},
            "description": "故事的主角",
        },
    )
    assert char_resp.status_code == 201, char_resp.text
    entity = char_resp.json()
    entity_id = entity["id"]
    print("entity created:", entity)

    entity_list = client.get(f"/api/novels/{novel_id}/entities")
    assert entity_list.status_code == 200
    assert any(e["id"] == entity_id for e in entity_list.json())
    print("entity list ok")

    entity_update = client.put(
        f"/api/novels/{novel_id}/entities/{entity_id}",
        json={"fields": {"role": "主角", "personality": "勇敢且聰明"}},
    )
    assert entity_update.status_code == 200
    assert entity_update.json()["fields"]["personality"] == "勇敢且聰明"
    print("entity update ok")

    delete_entity = client.delete(f"/api/novels/{novel_id}/entities/{entity_id}")
    assert delete_entity.status_code == 204
    print("entity delete ok")

    delete_novel = client.delete(f"/api/novels/{novel_id}")
    assert delete_novel.status_code == 204
    print("novel delete ok")

    missing = client.get(f"/api/novels/{novel_id}")
    assert missing.status_code == 404
    print("404-on-missing ok")

    print("\nALL SMOKE CHECKS PASSED")


if __name__ == "__main__":
    main()
