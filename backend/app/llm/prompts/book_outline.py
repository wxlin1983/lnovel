from typing import Any

SYSTEM_INSTRUCTIONS = """你是一個小說創作助手，負責根據故事大綱規劃全書的章節結構。
請以繁體中文撰寫所有文字內容（標題與摘要）。
只能輸出合法 JSON，不要使用 markdown code fence、不要加上任何其他說明文字，格式如下：
{"chapters": [{"chapter_number": 1, "title": "...", "summary": "..."}, ...]}
summary 約 30-60 字，描述本章在整體故事中的角色與主要事件。"""


def build_messages(
    *,
    premise: str,
    inspiration: str,
    storylines: list[dict[str, Any]],
    chapter_count: int,
    user_direction: str | None,
) -> list[dict[str, str]]:
    parts = [f"故事大綱：{premise}"]

    if inspiration:
        parts.append(f"原始靈感：{inspiration}")

    if storylines:
        lines = "\n".join(f"- {s['name']}：{s['description']}" for s in storylines)
        parts.append(f"目前已設定的故事線：\n{lines}")

    parts.append(f"請規劃全書共 {chapter_count} 章。")
    if user_direction:
        parts.append(f"使用者對整體規劃的指示：{user_direction}")
    parts.append("請輸出全書章節規劃 JSON。")

    return [
        {"role": "system", "content": SYSTEM_INSTRUCTIONS},
        {"role": "user", "content": "\n\n".join(parts)},
    ]
