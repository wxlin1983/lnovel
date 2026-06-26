"""Builds an OpenAI-style `response_format: json_schema` payload from a Pydantic model,
for providers that support grammar-constrained structured output (see
ProviderConfig.supports_json_schema). Without this, small local models reliably produce
malformed JSON once asked for more than a couple of array entries (missing commas,
unescaped full-width quotes inside Chinese text)."""

from pydantic import BaseModel


def json_schema_response_format(
    model: type[BaseModel], *, name: str, array_field: str | None = None, exact_count: int | None = None
) -> dict:
    schema = model.model_json_schema()
    if array_field is not None and exact_count is not None:
        schema["properties"][array_field]["minItems"] = exact_count
        schema["properties"][array_field]["maxItems"] = exact_count
    return {"type": "json_schema", "json_schema": {"name": name, "schema": schema}}
