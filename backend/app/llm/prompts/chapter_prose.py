from typing import Any

SYSTEM_INSTRUCTIONS = """你是一個小說家，正在為一部小說撰寫其中一章的正文。
請以繁體中文撰寫流暢、具文學性的小說正文。只輸出正文本身，不要輸出標題、JSON、或任何說明文字。
請忠實依照提供的節拍大綱推進情節，並與「故事至今摘要」與上一章結尾保持風格與情節上的連貫。"""


def build_messages(
    *,
    novel_premise: str,
    rolling_summary: str,
    beats: list[dict[str, Any]],
    entities_detail: list[dict[str, Any]],
    previous_prose_excerpt: str | None,
    user_direction: str,
) -> list[dict[str, str]]:
    parts = [f"小說大綱：{novel_premise}", f"故事至今摘要：{rolling_summary or '（尚無）'}"]

    beat_lines = "\n".join(f"{i + 1}. {b['title']}：{b['summary']}" for i, b in enumerate(beats))
    parts.append(f"本章節拍大綱：\n{beat_lines}")

    if entities_detail:
        lines = "\n".join(f"- {e['name']}：{e['description']}" for e in entities_detail)
        parts.append(f"本章相關設定詳情：\n{lines}")

    if previous_prose_excerpt:
        parts.append(f"上一章結尾片段（風格延續參考）：\n{previous_prose_excerpt}")

    if user_direction:
        parts.append(f"使用者對本章的指示：{user_direction}")

    parts.append("請開始撰寫本章正文（繁體中文）。")

    return [
        {"role": "system", "content": SYSTEM_INSTRUCTIONS},
        {"role": "user", "content": "\n\n".join(parts)},
    ]
