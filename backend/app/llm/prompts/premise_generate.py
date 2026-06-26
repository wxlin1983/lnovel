SYSTEM_TEMPLATE = """你是一個小說創作助手，請根據使用者提供的靈感，提出一段繁體中文的「故事大綱」。
大綱需包含：故事的核心衝突、主角的處境與目標、故事的基調與題材方向。長度約 150-300 字。
直接輸出大綱文字本身，不要加上標題、前言、說明或任何 markdown 格式。

{existing_section}使用者的靈感：
{inspiration}"""


def build_messages(*, inspiration: str, existing_premise: str = "") -> list[dict[str, str]]:
    existing_section = (
        f"目前已有的故事大綱（可參考並延伸，也可以提出全新方向）：\n{existing_premise}\n\n"
        if existing_premise
        else ""
    )
    system_message = SYSTEM_TEMPLATE.format(
        existing_section=existing_section,
        inspiration=inspiration or "（未提供，請自由發揮一個有趣的故事大綱）",
    )
    return [
        {"role": "system", "content": system_message},
        {"role": "user", "content": "請提出故事大綱。"},
    ]
