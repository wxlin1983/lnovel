from app.llm.token_budget import budget_chars_for_tokens, truncate_chars


def test_truncate_chars_short_text():
    assert truncate_chars("hello", 100) == "hello"


def test_truncate_chars_exact():
    assert truncate_chars("abcde", 5) == "abcde"


def test_truncate_chars_keeps_tail():
    assert truncate_chars("abcdefgh", 4) == "efgh"


def test_truncate_chars_empty():
    assert truncate_chars("", 10) == ""


def test_budget_chars_for_tokens():
    result = budget_chars_for_tokens(1000)
    assert result == 1700
