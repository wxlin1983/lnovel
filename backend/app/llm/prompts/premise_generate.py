SYSTEM_PROMPT = """你是一個小說創作助手，負責協助撰寫繁體中文「故事大綱」。
大綱需包含：故事的核心衝突、主角的處境與目標、故事的基調與題材方向。長度約 150-300 字。
直接輸出大綱文字本身，不要加上標題、前言、說明或任何 markdown 格式。"""


def build_messages(*, inspiration: str, existing_premise: str = "") -> list[dict[str, str]]:
    parts = []
    if inspiration:
        parts.append(f"靈感：{inspiration}")
    if existing_premise:
        parts.append(f"目前大綱（可延伸或提出全新方向）：{existing_premise}")
    parts.append("請提出故事大綱。")
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": "\n\n".join(parts) if parts else "請自由發揮一個有趣的故事大綱。"},
    ]


def build_revise_messages(*, chat_history: list[dict[str, str]], new_message: str) -> list[dict[str, str]]:
    """Build a multi-turn revision conversation. chat_history is [{role, content}] without system."""
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        *chat_history,
        {"role": "user", "content": new_message},
    ]
