CHARS_PER_TOKEN_CJK = 1.7


def budget_chars_for_tokens(token_budget: int) -> int:
    return int(token_budget * CHARS_PER_TOKEN_CJK)


def truncate_chars(text: str, max_chars: int) -> str:
    """Keeps the tail of the text (most recent content), since that's what continuity prompts need."""
    if len(text) <= max_chars:
        return text
    return text[-max_chars:]
