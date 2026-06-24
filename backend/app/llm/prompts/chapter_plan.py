from typing import Any

SYSTEM_INSTRUCTIONS = """你是一個小說創作助手，負責為小說規劃下一章的「節拍大綱」（beat plan）。
請以繁體中文撰寫所有文字內容（標題與摘要）。
只能輸出合法 JSON，不要使用 markdown code fence、不要加上任何其他說明文字，格式如下：
{"beats": [{"title": "...", "summary": "..."}, ...]}"""


def build_messages(
    *,
    novel_premise: str,
    rolling_summary: str,
    chapter_number: int,
    previous_plan_summary: str | None,
    previous_prose_excerpt: str | None,
    storylines: list[dict[str, Any]],
    characters: list[dict[str, Any]],
    user_direction: str,
) -> list[dict[str, str]]:
    parts = [f"小說大綱：{novel_premise}", f"故事至今摘要：{rolling_summary or '（尚無，這是第一章）'}"]

    if previous_plan_summary:
        parts.append(f"上一章節拍大綱摘要：{previous_plan_summary}")
    if previous_prose_excerpt:
        parts.append(f"上一章結尾片段：\n{previous_prose_excerpt}")

    if storylines:
        lines = "\n".join(f"- {s['name']}：{s['description']}" for s in storylines)
        parts.append(f"目前進行中的故事線：\n{lines}")

    if characters:
        lines = "\n".join(
            f"- {c['name']}（{c.get('role', '')}）" + (f"：{c['description']}" if c.get("description") else "")
            for c in characters
        )
        parts.append(f"角色列表：\n{lines}")

    parts.append(f"這是第 {chapter_number} 章。")
    if user_direction:
        parts.append(f"使用者對本章的指示：{user_direction}")
    parts.append("請輸出本章的節拍大綱 JSON。")

    return [
        {"role": "system", "content": SYSTEM_INSTRUCTIONS},
        {"role": "user", "content": "\n\n".join(parts)},
    ]
