import json
from typing import Any

TYPE_LABELS = {"character": "角色", "location": "地點", "storyline": "故事線"}

MAX_HISTORY_MESSAGES = 12

SYSTEM_TEMPLATE = """你是一個小說創作助手，正在協助使用者完善小說中的一個「{type_label}」設定條目。
請以繁體中文回覆。

小說大綱：{premise}

目前條目資料：
名稱：{name}
描述：{description}
欄位：{fields_json}
{linked_section}
使用者可能會要求你補充、修改設定。當你認為應該更新這個條目的欄位或描述時，請在回覆的最後加上一個 patch 區塊，格式如下（只包含需要變更的部分，且必須是合法 JSON）：

```patch
{{"description": "...", "fields": {{"key": "value"}}}}
```

如果使用者只是在聊天討論、沒有具體要修改的內容，則不要加上 patch 區塊。"""


def build_messages(
    *,
    novel_premise: str,
    entity_type: str,
    entity_name: str,
    entity_description: str,
    entity_fields: dict[str, Any],
    linked_summaries: list[str],
    history: list[dict[str, str]],
) -> list[dict[str, str]]:
    linked_section = ""
    if linked_summaries:
        bullet_list = "\n".join(f"- {s}" for s in linked_summaries)
        linked_section = f"\n相關條目摘要：\n{bullet_list}\n"

    system_message = SYSTEM_TEMPLATE.format(
        type_label=TYPE_LABELS.get(entity_type, entity_type),
        premise=novel_premise,
        name=entity_name,
        description=entity_description or "（尚無描述）",
        fields_json=json.dumps(entity_fields, ensure_ascii=False),
        linked_section=linked_section,
    )

    capped_history = history[-MAX_HISTORY_MESSAGES:]
    return [{"role": "system", "content": system_message}, *capped_history]
