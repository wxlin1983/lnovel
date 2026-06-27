from app.llm.code_fence import strip_code_fence


def test_no_fence():
    assert strip_code_fence('{"key": "value"}') == '{"key": "value"}'


def test_json_fence():
    text = '```json\n{"key": "value"}\n```'
    assert strip_code_fence(text) == '{"key": "value"}'


def test_plain_fence():
    text = '```\n{"key": "value"}\n```'
    assert strip_code_fence(text) == '{"key": "value"}'


def test_strips_surrounding_whitespace():
    text = '  ```json\n{"key": "value"}\n```  '
    assert strip_code_fence(text) == '{"key": "value"}'


def test_multiline_content():
    text = '```json\n{"a": 1,\n"b": 2}\n```'
    assert strip_code_fence(text) == '{"a": 1,\n"b": 2}'
