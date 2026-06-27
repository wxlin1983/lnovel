from app.llm.prompts.chapter_plan import build_messages as plan_messages
from app.llm.prompts.chapter_prose import build_messages as prose_messages


# ── chapter_plan ──────────────────────────────────────────────────────────────

def test_plan_messages_structure():
    msgs = plan_messages(
        novel_premise="A story about a wizard.",
        rolling_summary="The wizard arrived at the tower.",
        chapter_number=2,
        previous_plan_summary=None,
        previous_prose_excerpt=None,
        storylines=[],
        characters=[],
        user_direction="",
    )
    assert len(msgs) == 2
    assert msgs[0]["role"] == "system"
    assert msgs[1]["role"] == "user"


def test_plan_messages_includes_chapter_number():
    msgs = plan_messages(
        novel_premise="premise",
        rolling_summary="",
        chapter_number=5,
        previous_plan_summary=None,
        previous_prose_excerpt=None,
        storylines=[],
        characters=[],
        user_direction="",
    )
    assert "第 5 章" in msgs[1]["content"]


def test_plan_messages_includes_user_direction():
    msgs = plan_messages(
        novel_premise="premise",
        rolling_summary="",
        chapter_number=1,
        previous_plan_summary=None,
        previous_prose_excerpt=None,
        storylines=[],
        characters=[],
        user_direction="Focus on action.",
    )
    assert "Focus on action." in msgs[1]["content"]


def test_plan_messages_includes_previous_plan():
    msgs = plan_messages(
        novel_premise="premise",
        rolling_summary="",
        chapter_number=2,
        previous_plan_summary="Hero set out on journey.",
        previous_prose_excerpt=None,
        storylines=[],
        characters=[],
        user_direction="",
    )
    assert "Hero set out on journey." in msgs[1]["content"]


def test_plan_messages_includes_characters():
    msgs = plan_messages(
        novel_premise="premise",
        rolling_summary="",
        chapter_number=1,
        previous_plan_summary=None,
        previous_prose_excerpt=None,
        storylines=[],
        characters=[{"name": "Alice", "description": "A brave knight", "role": "protagonist"}],
        user_direction="",
    )
    assert "Alice" in msgs[1]["content"]


def test_plan_messages_first_chapter_no_summary_note():
    msgs = plan_messages(
        novel_premise="premise",
        rolling_summary="",
        chapter_number=1,
        previous_plan_summary=None,
        previous_prose_excerpt=None,
        storylines=[],
        characters=[],
        user_direction="",
    )
    assert "第一章" in msgs[1]["content"]


# ── chapter_prose ──────────────────────────────────────────────────────────────

def test_prose_messages_structure():
    msgs = prose_messages(
        novel_premise="A fantasy story.",
        rolling_summary="",
        beats=[{"title": "Opening", "summary": "Hero wakes up."}],
        entities_detail=[],
        previous_prose_excerpt=None,
        user_direction="",
    )
    assert len(msgs) == 2
    assert msgs[0]["role"] == "system"
    assert msgs[1]["role"] == "user"


def test_prose_messages_includes_beats():
    msgs = prose_messages(
        novel_premise="premise",
        rolling_summary="",
        beats=[{"title": "Fight", "summary": "Hero battles dragon."}],
        entities_detail=[],
        previous_prose_excerpt=None,
        user_direction="",
    )
    assert "Fight" in msgs[1]["content"]
    assert "Hero battles dragon." in msgs[1]["content"]


def test_prose_messages_no_target_word_count_by_default():
    msgs = prose_messages(
        novel_premise="premise",
        rolling_summary="",
        beats=[],
        entities_detail=[],
        previous_prose_excerpt=None,
        user_direction="",
    )
    assert "目標字數" not in msgs[1]["content"]


def test_prose_messages_with_target_word_count():
    msgs = prose_messages(
        novel_premise="premise",
        rolling_summary="",
        beats=[],
        entities_detail=[],
        previous_prose_excerpt=None,
        user_direction="",
        target_word_count=3000,
    )
    assert "3000" in msgs[1]["content"]
    assert "目標字數" in msgs[1]["content"]


def test_prose_messages_includes_entities():
    msgs = prose_messages(
        novel_premise="premise",
        rolling_summary="",
        beats=[],
        entities_detail=[{"name": "Sword of Truth", "description": "A legendary blade."}],
        previous_prose_excerpt=None,
        user_direction="",
    )
    assert "Sword of Truth" in msgs[1]["content"]


def test_prose_messages_includes_previous_excerpt():
    msgs = prose_messages(
        novel_premise="premise",
        rolling_summary="",
        beats=[],
        entities_detail=[],
        previous_prose_excerpt="The sun set over the mountains.",
        user_direction="",
    )
    assert "The sun set over the mountains." in msgs[1]["content"]
