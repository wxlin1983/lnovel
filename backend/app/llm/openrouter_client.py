import json
from collections.abc import AsyncIterator

import httpx

from app.config import settings

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class OpenRouterError(Exception):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


async def stream_chat_completion(
    *, api_key: str, model: str, messages: list[dict[str, str]]
) -> AsyncIterator[str]:
    """Yields content deltas as they arrive. Raises OpenRouterError on upstream failure."""
    if settings.llm_mock:
        async for chunk in _mock_stream(messages):
            yield chunk
        return

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {"model": model, "messages": messages, "stream": True}

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", OPENROUTER_URL, headers=headers, json=payload) as response:
                if response.status_code == 401:
                    raise OpenRouterError(401, "OpenRouter 金鑰無效")
                if response.status_code == 429:
                    raise OpenRouterError(429, "OpenRouter 已達速率限制，請稍後再試")
                if response.status_code >= 400:
                    body = await response.aread()
                    raise OpenRouterError(response.status_code, body.decode(errors="ignore"))

                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    data = line[len("data: "):]
                    if data.strip() == "[DONE]":
                        break
                    try:
                        obj = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    delta = obj.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content")
                    if content:
                        yield content
    except httpx.HTTPError as exc:
        raise OpenRouterError(502, f"連線 OpenRouter 失敗: {exc}") from exc


async def _mock_stream(messages: list[dict[str, str]]) -> AsyncIterator[str]:
    last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    reply = f"（模擬回覆）已收到：{last_user[:80]}"
    for ch in reply:
        yield ch
