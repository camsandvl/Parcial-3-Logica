import json
from pathlib import Path

import pytest

from app.syntax import parse
from helpers import LANGUAGE

FIXTURES = Path(__file__).resolve().parents[3] / "contracts" / "fixtures"


def errors(text, language=LANGUAGE):
    result = parse(text, language)
    assert result["ok"] is False
    assert "value" not in result and "ast" not in result
    return result["errors"]


def only(text, language=LANGUAGE):
    found = errors(text, language)
    assert len(found) == 1, found
    error = found[0]
    assert error["path"] == "formula" and error["stage"] == "syntax"
    return error["code"], error["span"]


def test_contract_fixture_error_arity():
    fixture = json.loads((FIXTURES / "error-arity.json").read_text(encoding="utf-8"))
    assert parse("∃x R(x)", LANGUAGE) == fixture


@pytest.mark.parametrize("text", ["", "   "])
def test_empty_formula(text):
    assert only(text)[0] == "SYNTAX_ERROR"


def test_unknown_token_position():
    assert only("P(x) $ Q(x)") == ("SYNTAX_ERROR", [5, 6])


def test_unclosed_parenthesis_points_to_the_opening_one():
    assert only("P(x) ∧ (Q(x) ∨ P(y)") == ("SYNTAX_ERROR", [7, 8])


def test_unclosed_argument_list():
    assert only("R(x, y") == ("SYNTAX_ERROR", [1, 2])


def test_closing_parenthesis_without_opening():
    assert only("P(x))") == ("SYNTAX_ERROR", [4, 5])


@pytest.mark.parametrize("text, span", [
    ("P(x) ∧", [6, 6]),         # falta el operando derecho, al final
    ("∧ Q(x)", [0, 1]),         # falta el operando izquierdo
    ("P(x) ∨ → Q(x)", [7, 8]),  # dos conectivos seguidos
    ("¬", [1, 1]),
    ("∀x", [2, 2]),
    ("()", [1, 2]),
])
def test_missing_operand(text, span):
    assert only(text) == ("SYNTAX_ERROR", span)


def test_two_formulas_without_connective():
    assert only("P(x) Q(x)") == ("SYNTAX_ERROR", [5, 6])


def test_quantifier_needs_a_variable():
    assert only("∀P(x)") == ("SYNTAX_ERROR", [1, 2])
    assert only("∃(P(x))") == ("SYNTAX_ERROR", [1, 2])


def test_variable_used_as_formula():
    assert only("P(x) ∧ x") == ("SYNTAX_ERROR", [7, 8])


def test_variable_with_arguments():
    assert only("P(x(y))") == ("SYNTAX_ERROR", [3, 4])


def test_missing_argument():
    assert only("R(x,)") == ("SYNTAX_ERROR", [4, 5])


def test_unknown_predicate():
    assert only("∀x S(x)") == ("UNKNOWN_SYMBOL", [3, 7])


def test_unknown_function():
    assert only("P(h(x))") == ("UNKNOWN_SYMBOL", [2, 6])


def test_function_used_as_predicate():
    assert only("f(x) ∧ P(x)") == ("UNKNOWN_SYMBOL", [0, 4])


def test_predicate_used_as_term():
    assert only("R(x, P(x))") == ("UNKNOWN_SYMBOL", [5, 9])


def test_predicate_arity_mismatch():
    assert only("R(x)") == ("ARITY_MISMATCH", [0, 4])
    assert only("P(x, y)") == ("ARITY_MISMATCH", [0, 7])


def test_predicate_without_arguments():
    assert only("P ∧ Q(x)") == ("ARITY_MISMATCH", [0, 1])


def test_function_arity_mismatch():
    assert only("P(g(x))") == ("ARITY_MISMATCH", [2, 6])


def test_function_without_arguments():
    assert only("P(f)") == ("ARITY_MISMATCH", [2, 3])


def test_constant_used_with_parentheses():
    assert only("P(c())") == ("ARITY_MISMATCH", [2, 5])


def test_all_symbol_errors_are_reported_together():
    found = errors("S(x) ∧ R(x) ∧ P(h(c()))")
    assert [(e["code"], e["span"]) for e in found] == [
        ("UNKNOWN_SYMBOL", [0, 4]),
        ("ARITY_MISMATCH", [7, 11]),
        ("ARITY_MISMATCH", [18, 21]),
        ("UNKNOWN_SYMBOL", [16, 22]),
    ]


def test_error_messages_are_in_spanish():
    assert errors("R(x)")[0]["message"] == "R espera 2 argumentos y recibió 1"
    assert "no está declarado" in errors("S(x)")[0]["message"]


def test_invalid_language_is_reported_before_the_formula():
    bad = {"functions": [], "predicates": [{"name": "P", "arity": 0}]}
    assert [e["code"] for e in errors("P(x", bad)] == ["INVALID_LANGUAGE"]


def test_non_string_formula():
    assert parse(None, LANGUAGE)["errors"][0]["code"] == "SYNTAX_ERROR"
