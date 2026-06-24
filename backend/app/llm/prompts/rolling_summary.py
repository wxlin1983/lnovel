SYSTEM_INSTRUCTIONS = """你是一個小說創作助手，負責將已完成的章節內容壓縮進「故事至今摘要」，
以節省後續章節生成時所需的上下文長度。
請以繁體中文輸出，長度約 400-600 字，保留尚未解決的懸念、角色目前的狀態與重要事件，
避免逐句重述細節。只輸出摘要本文，不要加上任何其他說明文字或標題。"""


def build_messages(*, existing_summary: str, finalized_chapter_text: str) -> list[dict[str, str]]:
    parts = [
        f"目前的故事摘要：{existing_summary or '（尚無，這是第一章）'}",
        f"剛完成的章節全文：\n{finalized_chapter_text}",
        "請輸出更新後的故事摘要。",
    ]
    return [
        {"role": "system", "content": SYSTEM_INSTRUCTIONS},
        {"role": "user", "content": "\n\n".join(parts)},
    ]
