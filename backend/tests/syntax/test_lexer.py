import pytest

from app.syntax.errors import SyntaxFailure
from app.syntax.lexer import tokenize


def kinds(text):
    return [t.kind for t in tokenize(text)][:-1]


@pytest.mark.parametrize("unicode, ascii_", [
    ("¬", "~"), ("∧", "&"), ("∨", "|"), ("→", "->"), ("↔", "<->"), ("∀", r"\A"), ("∃", r"\E"),
])
def test_unicode_and_ascii_produce_the_same_token(unicode, ascii_):
    assert kinds(unicode) == kinds(ascii_)


def test_positions_are_character_offsets_in_the_original_text():
    tokens = tokenize("P(x) <-> Q(y)")
    assert [(t.text, t.start, t.end) for t in tokens] == [
        ("P", 0, 1), ("(", 1, 2), ("x", 2, 3), (")", 3, 4), ("<->", 5, 8),
        ("Q", 9, 10), ("(", 10, 11), ("y", 11, 12), (")", 12, 13), ("", 13, 13),
    ]


def test_whitespace_is_ignored():
    assert kinds("  P ( x )\t") == kinds("P(x)")


def test_identifiers_take_letters_digits_and_underscore():
    assert [t.text for t in tokenize("Mayor_1(x23)")][:4] == ["Mayor_1", "(", "x23", ")"]


@pytest.mark.parametrize("text, position", [("P(x) # Q", 5), ("P(x) - Q(x)", 5), ("ñ", 0)])
def test_unknown_character_reports_its_position(text, position):
    with pytest.raises(SyntaxFailure) as info:
        tokenize(text)
    assert info.value.error["span"] == [position, position + 1]
    assert info.value.error["code"] == "SYNTAX_ERROR"
