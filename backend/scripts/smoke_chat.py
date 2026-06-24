"""Phase 2 smoke test: entity chat + apply-patch, against a running dev server with LNOVEL_LLM_MOCK=1.

Usage: LNOVEL_LLM_MOCK=1 uv run uvicorn app.main:app & uv run python scripts/smoke_chat.py
"""

import json
import sys

import httpx

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"


def main() -> None:
    client = httpx.Client(base_url=BASE_URL, timeout=30.0)

    settings_resp = client.put("/api/settings", json={"openrouter_api_key": "sk-test-key"})
    assert settings_resp.status_code == 200, settings_resp.text

    novel = client.post("/api/novels", json={"title": "聊天測試小說", "premise": "測試實體聊天"}).json()
    novel_id = novel["id"]

    entity = client.post(
        f"/api/novels/{novel_id}/entities",
        json={"type": "character", "name": "艾莉", "fields": {"role": "配角"}, "description": "一個謎樣角色"},
    ).json()
    entity_id = entity["id"]

    with client.stream(
        "POST",
        f"/api/novels/{novel_id}/entities/{entity_id}/chat",
        json={"content": "請把她的角色設定改成主角，性格改成堅毅"},
    ) as resp:
        assert resp.status_code == 200, resp.read()
        event_type = None
        done_data = None
        for line in resp.iter_lines():
            if line.startswith("event:"):
                event_type = line.split(":", 1)[1].strip()
            elif line.startswith("data:") and event_type == "done":
                done_data = json.loads(line.split(":", 1)[1].strip())
        assert done_data is not None, "never received a 'done' event"
        print("chat done event:", done_data)

    history = client.get(f"/api/novels/{novel_id}/entities/{entity_id}/chat").json()
    assert len(history) == 2, history
    assert history[0]["role"] == "user"
    assert history[1]["role"] == "assistant"
    print("chat history ok:", history)

    message_id = history[1]["id"]
    apply_resp = client.post(f"/api/novels/{novel_id}/entities/{entity_id}/chat/{message_id}/apply-patch")
    print("apply-patch status:", apply_resp.status_code, apply_resp.text)

    client.delete(f"/api/novels/{novel_id}")
    print("\nALL CHAT SMOKE CHECKS PASSED")


if __name__ == "__main__":
    main()
