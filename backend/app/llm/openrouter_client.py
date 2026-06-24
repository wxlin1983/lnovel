import json
from collections.abc import AsyncIterator

import httpx

from app.config import settings
from app.llm.model_catalog import free_model_ids

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


async def complete_chat(*, api_key: str, model: str, messages: list[dict[str, str]]) -> str:
    """Non-streaming completion. Used for structured-JSON generation (chapter plans) and
    short free-text generation (rolling summary)."""
    if settings.llm_mock:
        return _mock_complete(messages)

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {"model": model, "messages": messages, "stream": False}

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(OPENROUTER_URL, headers=headers, json=payload)
    except httpx.HTTPError as exc:
        raise OpenRouterError(502, f"連線 OpenRouter 失敗: {exc}") from exc

    if response.status_code == 401:
        raise OpenRouterError(401, "OpenRouter 金鑰無效")
    if response.status_code == 429:
        raise OpenRouterError(429, "OpenRouter 已達速率限制，請稍後再試")
    if response.status_code >= 400:
        raise OpenRouterError(response.status_code, response.text)

    data = response.json()
    return data["choices"][0]["message"]["content"]


async def complete_chat_with_fallback(*, api_key: str, model: str, messages: list[dict[str, str]]) -> str:
    """Like complete_chat, but on a 402 (insufficient credits / model requires payment) retries
    through OpenRouter's other free-tier models before giving up."""
    try:
        return await complete_chat(api_key=api_key, model=model, messages=messages)
    except OpenRouterError as exc:
        if exc.status_code != 402:
            raise
        last_exc: OpenRouterError = exc
        for candidate in await free_model_ids():
            if candidate == model:
                continue
            try:
                return await complete_chat(api_key=api_key, model=candidate, messages=messages)
            except OpenRouterError as exc2:
                last_exc = exc2
                if exc2.status_code != 402:
                    raise
        raise last_exc


async def stream_chat_completion_with_fallback(
    *, api_key: str, model: str, messages: list[dict[str, str]]
) -> AsyncIterator[str]:
    """Like stream_chat_completion, but on a 402 from `model` (before any content was yielded),
    retries through OpenRouter's other free-tier models."""
    candidates = [model]
    last_exc: OpenRouterError | None = None
    tried_fallbacks = False
    while candidates:
        candidate = candidates.pop(0)
        yielded_any = False
        try:
            async for chunk in stream_chat_completion(api_key=api_key, model=candidate, messages=messages):
                yielded_any = True
                yield chunk
            return
        except OpenRouterError as exc:
            last_exc = exc
            if yielded_any or exc.status_code != 402:
                raise
            if not tried_fallbacks:
                tried_fallbacks = True
                candidates = [m for m in await free_model_ids() if m != model]
    if last_exc is not None:
        raise last_exc


def _mock_complete(messages: list[dict[str, str]]) -> str:
    system_content = next((m["content"] for m in messages if m["role"] == "system"), "")
    if "JSON" in system_content:
        return json.dumps(
            {
                "beats": [
                    {"title": "模擬章節開場", "summary": "（模擬）這是自動生成的測試節拍：建立場景與衝突的種子。"},
                    {"title": "模擬中段衝突", "summary": "（模擬）測試節拍：角色之間的衝突升溫。"},
                    {"title": "模擬章節收尾", "summary": "（模擬）測試節拍：留下懸念，銜接下一章。"},
                ]
            },
            ensure_ascii=False,
        )
    return "（模擬摘要）這是自動生成的測試故事摘要，用於確認 rolling_summary 更新流程正常運作。"
