import re

CODE_FENCE_RE = re.compile(r"^```(?:json)?\s*\n(.*?)\n```$", re.DOTALL)


def strip_code_fence(text: str) -> str:
    match = CODE_FENCE_RE.match(text.strip())
    return match.group(1) if match else text.strip()
