"""Phase 4 smoke test: prose generation gating, manual save, finalize, and rolling-summary
update, against a running dev server with LNOVEL_LLM_MOCK=1.

Usage: LNOVEL_LLM_MOCK=1 uv run uvicorn app.main:app & uv run python scripts/smoke_chapter_prose.py
"""

import json
import sys

import httpx

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"


def stream_done_event(client: httpx.Client, path: str, json_body: dict) -> dict:
    with client.stream("POST", path, json=json_body) as resp:
        assert resp.status_code == 200, resp.read()
        event_type = None
        done_data = None
        for line in resp.iter_lines():
            if line.startswith("event:"):
                event_type = line.split(":", 1)[1].strip()
            elif line.startswith("data:") and event_type == "done":
                done_data = json.loads(line.split(":", 1)[1].strip())
        assert done_data is not None, "never received a 'done' event"
        return done_data


def main() -> None:
    client = httpx.Client(base_url=BASE_URL, timeout=30.0)

    assert client.put("/api/settings", json={"openrouter_api_key": "sk-test-key"}).status_code == 200

    novel = client.post("/api/novels", json={"title": "正文測試小說", "premise": "一個用於正文生成的測試故事"}).json()
    novel_id = novel["id"]

    chapter = client.post(f"/api/novels/{novel_id}/chapters", json={"chapter_number": 1, "title": "第一章"}).json()
    chapter_id = chapter["id"]

    # Prose generation must be rejected before the plan is approved.
    rejected = client.post(f"/api/novels/{novel_id}/chapters/{chapter_id}/prose", json={})
    assert rejected.status_code == 400, rejected.text
    print("prose rejected pre-approval ok")

    client.post(f"/api/novels/{novel_id}/chapters/{chapter_id}/plan", json={})
    client.post(f"/api/novels/{novel_id}/chapters/{chapter_id}/plan/approve")

    # Now allowed after approval.
    done = stream_done_event(client, f"/api/novels/{novel_id}/chapters/{chapter_id}/prose", {})
    assert done["prose"], done
    print("prose generated ok:", done["prose"][:60])

    chapter_after = client.get(f"/api/novels/{novel_id}/chapters/{chapter_id}").json()
    assert chapter_after["status"] == "drafted"
    assert chapter_after["prose"] == done["prose"]
    print("status transitioned to drafted ok")

    manual = client.put(
        f"/api/novels/{novel_id}/chapters/{chapter_id}/prose", json={"prose": "手動編輯後的正文內容。"}
    ).json()
    assert manual["prose"] == "手動編輯後的正文內容。"
    assert manual["status"] == "drafted"
    print("manual prose save ok")

    revisions = client.get(f"/api/novels/{novel_id}/chapters/{chapter_id}/prose/revisions").json()
    assert len(revisions) == 2, revisions
    print("revisions ok:", len(revisions), "entries")

    finalized = client.post(f"/api/novels/{novel_id}/chapters/{chapter_id}/prose/finalize").json()
    assert finalized["status"] == "final"
    print("finalize ok:", finalized["status"])

    novel_after = client.get(f"/api/novels/{novel_id}").json()
    assert novel_after["rolling_summary"], novel_after
    print("rolling summary updated ok:", novel_after["rolling_summary"][:60])

    not_finalizable = client.post(
        f"/api/novels/{novel_id}/chapters",
        json={"chapter_number": 2},
    ).json()
    no_prose_finalize = client.post(f"/api/novels/{novel_id}/chapters/{not_finalizable['id']}/prose/finalize")
    assert no_prose_finalize.status_code == 400, no_prose_finalize.text
    print("finalize-without-prose rejected ok")

    client.delete(f"/api/novels/{novel_id}")
    print("\nALL CHAPTER PROSE SMOKE CHECKS PASSED")


if __name__ == "__main__":
    main()
