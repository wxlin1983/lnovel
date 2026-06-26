import json
from collections.abc import AsyncIterator

import httpx

from app.config import settings
from app.llm.provider_config import ProviderConfig


class LLMError(Exception):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


async def stream_chat_completion(
    *, endpoint_url: str, api_key: str | None, model: str, messages: list[dict[str, str]]
) -> AsyncIterator[str]:
    """Yields content deltas as they arrive. Raises LLMError on upstream failure."""
    if settings.llm_mock:
        async for chunk in _mock_stream(messages):
            yield chunk
        return

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    payload = {"model": model, "messages": messages, "stream": True}

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", endpoint_url, headers=headers, json=payload) as response:
                if response.status_code == 401:
                    raise LLMError(401, "AI 服務認證失敗")
                if response.status_code == 429:
                    raise LLMError(429, "AI 服務已達速率限制，請稍後再試")
                if response.status_code >= 400:
                    body = await response.aread()
                    raise LLMError(response.status_code, body.decode(errors="ignore"))

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
        raise LLMError(502, f"連線 AI 服務失敗: {exc}") from exc


async def _mock_stream(messages: list[dict[str, str]]) -> AsyncIterator[str]:
    last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    reply = f"（模擬回覆）已收到：{last_user[:80]}"
    for ch in reply:
        yield ch


async def complete_chat(
    *,
    endpoint_url: str,
    api_key: str | None,
    model: str,
    messages: list[dict[str, str]],
    response_format: dict | None = None,
) -> str:
    """Non-streaming completion. Used for structured-JSON generation (chapter plans) and
    short free-text generation (rolling summary). `response_format` (OpenAI-style
    json_schema) grammar-constrains the output when the provider supports it — see
    ProviderConfig.supports_json_schema."""
    if settings.llm_mock:
        return _mock_complete(messages)

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    payload: dict = {"model": model, "messages": messages, "stream": False}
    if response_format is not None:
        payload["response_format"] = response_format

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(endpoint_url, headers=headers, json=payload)
    except httpx.HTTPError as exc:
        raise LLMError(502, f"連線 AI 服務失敗: {exc}") from exc

    if response.status_code == 401:
        raise LLMError(401, "AI 服務認證失敗")
    if response.status_code == 429:
        raise LLMError(429, "AI 服務已達速率限制，請稍後再試")
    if response.status_code >= 400:
        raise LLMError(response.status_code, response.text)

    data = response.json()
    return data["choices"][0]["message"]["content"]


async def complete_chat_with_fallback(
    cfg: ProviderConfig, messages: list[dict[str, str]], response_format: dict | None = None
) -> str:
    """Like complete_chat, but on `cfg.fallback_status` (e.g. OpenRouter's 402 "payment
    required", or Ollama's 404 "model not pulled") retries through `cfg.list_fallback_candidates()`
    before giving up. `response_format` is only forwarded if `cfg.supports_json_schema`."""
    format_arg = response_format if cfg.supports_json_schema else None
    try:
        return await complete_chat(
            endpoint_url=cfg.endpoint_url,
            api_key=cfg.api_key,
            model=cfg.model,
            messages=messages,
            response_format=format_arg,
        )
    except LLMError as exc:
        if exc.status_code != cfg.fallback_status:
            raise
        last_exc: LLMError = exc
        for candidate in await cfg.list_fallback_candidates():
            if candidate == cfg.model:
                continue
            try:
                return await complete_chat(
                    endpoint_url=cfg.endpoint_url,
                    api_key=cfg.api_key,
                    model=candidate,
                    messages=messages,
                    response_format=format_arg,
                )
            except LLMError as exc2:
                last_exc = exc2
                if exc2.status_code != cfg.fallback_status:
                    raise
        raise last_exc


async def stream_chat_completion_with_fallback(
    cfg: ProviderConfig, messages: list[dict[str, str]]
) -> AsyncIterator[str]:
    """Like stream_chat_completion, but on `cfg.fallback_status` from `cfg.model` (before any
    content was yielded), retries through `cfg.list_fallback_candidates()`."""
    candidates = [cfg.model]
    last_exc: LLMError | None = None
    tried_fallbacks = False
    while candidates:
        candidate = candidates.pop(0)
        yielded_any = False
        try:
            async for chunk in stream_chat_completion(
                endpoint_url=cfg.endpoint_url, api_key=cfg.api_key, model=candidate, messages=messages
            ):
                yielded_any = True
                yield chunk
            return
        except LLMError as exc:
            last_exc = exc
            if yielded_any or exc.status_code != cfg.fallback_status:
                raise
            if not tried_fallbacks:
                tried_fallbacks = True
                candidates = [m for m in await cfg.list_fallback_candidates() if m != cfg.model]
    if last_exc is not None:
        raise last_exc


def _mock_complete(messages: list[dict[str, str]]) -> str:
    system_content = next((m["content"] for m in messages if m["role"] == "system"), "")
    if '"chapters"' in system_content:
        return json.dumps(
            {
                "chapters": [
                    {"chapter_number": 1, "title": "模擬第一章", "summary": "（模擬）這是自動生成的測試章節規劃。"},
                    {"chapter_number": 2, "title": "模擬第二章", "summary": "（模擬）測試章節規劃：衝突升溫。"},
                ]
            },
            ensure_ascii=False,
        )
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
    if "故事大綱" in system_content:
        return "（模擬大綱）這是自動生成的測試故事大綱，用於確認靈感生成流程正常運作。"
    return "（模擬摘要）這是自動生成的測試故事摘要，用於確認 rolling_summary 更新流程正常運作。"
