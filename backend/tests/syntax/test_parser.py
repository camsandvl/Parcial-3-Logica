import pytest

from app.syntax import parse
from helpers import LANGUAGE, A, F, V, strip_spans

P_x, Q_x, P_y = A("P", V("x")), A("Q", V("x")), A("P", V("y"))


def ast(text):
    result = parse(text, LANGUAGE)
    assert result["ok"], result
    return result["ast"]


def shape(text):
    return strip_spans(ast(text))


def bin_(kind, left, right):
    return {"type": kind, "left": left, "right": right}


def contract_example():
    """AST de ejemplo de REPARTO.md 3.4, idéntico, con spans."""
    return {"type": "forall", "var": "x", "span": [0, 20],
            "body": {"type": "implies", "span": [3, 19],
                     "left": {"type": "pred", "name": "P", "args": [{"type": "var", "name": "x", "span": [5, 6]}], "span": [3, 7]},
                     "right": {"type": "exists", "var": "y", "span": [10, 19],
                               "body": {"type": "pred", "name": "R", "span": [13, 19], "args": [
                                   {"type": "var", "name": "x", "span": [15, 16]}, {"type": "var", "name": "y", "span": [17, 18]}]}}}}


def test_contract_example_ast_is_reproduced_exactly():
    result = parse("∀x(P(x) → ∃y R(x,y))", LANGUAGE)
    assert result == {"ok": True, "ast": contract_example(), "freeVars": []}


def test_ascii_version_gives_the_same_structure():
    assert shape("\\Ax(P(x) -> \\Ey R(x,y))") == strip_spans(contract_example())


@pytest.mark.parametrize("text, kind", [
    ("P(x) ∧ Q(x)", "and"), ("P(x) ∨ Q(x)", "or"), ("P(x) → Q(x)", "implies"), ("P(x) ↔ Q(x)", "iff"),
    ("P(x) & Q(x)", "and"), ("P(x) | Q(x)", "or"), ("P(x) -> Q(x)", "implies"), ("P(x) <-> Q(x)", "iff"),
])
def test_each_binary_connective(text, kind):
    assert shape(text) == bin_(kind, P_x, Q_x)


@pytest.mark.parametrize("text", ["¬P(x)", "~P(x)"])
def test_negation(text):
    assert shape(text) == {"type": "not", "body": P_x}


def test_double_negation():
    assert shape("¬¬P(x)") == {"type": "not", "body": {"type": "not", "body": P_x}}


def test_and_binds_tighter_than_or():
    assert shape("P(x) ∨ Q(x) ∧ P(y)") == bin_("or", P_x, bin_("and", Q_x, P_y))
    assert shape("P(x) ∧ Q(x) ∨ P(y)") == bin_("or", bin_("and", P_x, Q_x), P_y)


def test_or_binds_tighter_than_implies_and_implies_tighter_than_iff():
    assert shape("P(x) ∨ Q(x) → P(y) ↔ Q(x)") == bin_("iff", bin_("implies", bin_("or", P_x, Q_x), P_y), Q_x)


def test_negation_binds_tighter_than_and():
    assert shape("¬P(x) ∧ Q(x)") == bin_("and", {"type": "not", "body": P_x}, Q_x)


def test_implication_is_right_associative():
    assert shape("P(x) → Q(x) → P(y)") == bin_("implies", P_x, bin_("implies", Q_x, P_y))


@pytest.mark.parametrize("op, kind", [("∧", "and"), ("∨", "or"), ("↔", "iff")])
def test_other_binary_connectives_are_left_associative(op, kind):
    assert shape(f"P(x) {op} Q(x) {op} P(y)") == bin_(kind, bin_(kind, P_x, Q_x), P_y)


def test_parentheses_override_precedence():
    assert shape("(P(x) → Q(x)) → P(y)") == bin_("implies", bin_("implies", P_x, Q_x), P_y)


def test_quantifier_scope_is_the_immediate_formula():
    # ∀x P(x) → Q(x) se lee (∀x P(x)) → Q(x)
    assert shape("∀x P(x) → Q(x)") == bin_("implies", {"type": "forall", "var": "x", "body": P_x}, Q_x)


def test_parentheses_extend_quantifier_scope():
    assert shape("∀x(P(x) → Q(x))") == {"type": "forall", "var": "x", "body": bin_("implies", P_x, Q_x)}


def test_nested_quantifiers_and_negation():
    assert shape("∀x ∃y ¬R(x,y)") == {"type": "forall", "var": "x", "body": {
        "type": "exists", "var": "y", "body": {"type": "not", "body": A("R", V("x"), V("y"))}}}


def test_quantifier_without_space_before_predicate():
    assert shape("∀xP(x)") == shape("∀x P(x)")
    assert shape("∃x1Q(x1)") == {"type": "exists", "var": "x1", "body": A("Q", V("x1"))}


def test_constants_are_written_without_parentheses():
    assert shape("P(c)") == A("P", F("c"))


def test_nested_functions():
    assert shape("R(g(f(x), c), y)") == A("R", F("g", F("f", V("x")), F("c")), V("y"))


def test_variables_with_digits():
    assert shape("R(x1, y23)") == A("R", V("x1"), V("y23"))


def test_spans_of_terms_and_binary_nodes():
    tree = ast("P(f(x)) ∧ (Q(c))")
    assert tree["span"] == [0, 16]
    assert tree["left"]["args"][0]["span"] == [2, 6]
    # dentro de paréntesis el span no incluye los paréntesis
    assert tree["right"]["span"] == [11, 15]
    assert tree["right"]["args"][0]["span"] == [13, 14]


def test_quantifier_span_includes_closing_parenthesis_of_its_body():
    tree = ast("∀x(P(x))")
    assert tree["span"] == [0, 8]
    assert tree["body"]["span"] == [3, 7]


def test_redundant_parentheses_are_transparent():
    assert ast("((P(x)))") == {"type": "pred", "name": "P", "span": [2, 6],
                               "args": [{"type": "var", "name": "x", "span": [4, 5]}]}


def test_whitespace_does_not_change_structure():
    assert shape("  ∀x ( P ( x )→Q(x) )  ") == shape("∀x(P(x) → Q(x))")
