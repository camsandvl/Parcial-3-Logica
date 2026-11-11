import pytest

from app.syntax import free_vars, parse, to_string
from helpers import LANGUAGE, strip_spans


def ast(text):
    result = parse(text, LANGUAGE)
    assert result["ok"], result
    return result["ast"]


# ---------- variables libres ----------
@pytest.mark.parametrize("text, expected", [
    ("∀x(P(x) → ∃y R(x,y))", []),            # cerrada
    ("R(x, y)", ["x", "y"]),                  # abierta
    ("∀x R(x, y)", ["y"]),
    ("P(x) ∧ ∀x Q(x)", ["x"]),               # x libre a la izquierda y ligada a la derecha
    ("∀x Q(x) ∧ P(x)", ["x"]),               # el alcance de ∀ es solo Q(x)
    ("∀x(Q(x) ∧ P(x))", []),
    ("∃y ∀y P(y)", []),                       # cuantificador vacuo, sin variables libres
    ("R(z, w) ∨ R(x, y)", ["w", "x", "y", "z"]),  # ordenadas alfabéticamente
    ("R(x, x) ∧ P(x)", ["x"]),               # sin repetir
    ("P(g(f(z), c))", ["z"]),                # dentro de funciones anidadas
    ("P(c)", []),                            # las constantes no son variables
])
def test_free_vars(text, expected):
    assert free_vars(ast(text)) == expected
    assert parse(text, LANGUAGE)["freeVars"] == expected


# ---------- to_string ----------
@pytest.mark.parametrize("text, printed", [
    ("∀x(P(x) → ∃y R(x,y))", "∀x(P(x) → ∃y R(x,y))"),
    ("∃x R(x, f(x))", "∃x R(x, f(x))"),
    ("\\Ax (P(x) -> Q(x))", "∀x(P(x) → Q(x))"),
    ("~P(x) & Q(x) | P(y)", "¬P(x) ∧ Q(x) ∨ P(y)"),
    ("((P(x)))", "P(x)"),
    ("(P(x) ∧ Q(x)) ∨ P(y)", "P(x) ∧ Q(x) ∨ P(y)"),     # paréntesis mínimos
    ("P(x) ∧ (Q(x) ∨ P(y))", "P(x) ∧ (Q(x) ∨ P(y))"),   # los necesarios se conservan
    ("P(x) → (Q(x) → P(y))", "P(x) → Q(x) → P(y)"),     # → asocia a la derecha
    ("(P(x) → Q(x)) → P(y)", "(P(x) → Q(x)) → P(y)"),
    ("(P(x) ∧ Q(x)) ∧ P(y)", "P(x) ∧ Q(x) ∧ P(y)"),     # ∧ asocia a la izquierda
    ("P(x) ∧ (Q(x) ∧ P(y))", "P(x) ∧ (Q(x) ∧ P(y))"),
    ("¬(P(x) ∨ Q(x))", "¬(P(x) ∨ Q(x))"),
    ("¬∀x P(x)", "¬∀x P(x)"),
    ("∀x ∃y R(x,y)", "∀x ∃y R(x,y)"),
    ("(∀x P(x)) → Q(x)", "∀x P(x) → Q(x)"),
    ("P(c) ↔ R(g(x,c), y)", "P(c) ↔ R(g(x,c), y)"),
])
def test_to_string(text, printed):
    assert to_string(ast(text)) == printed


@pytest.mark.parametrize("text", [
    "∀x(P(x) → ∃y R(x,y))",
    "P(x) ∨ Q(x) → P(y) ↔ Q(x)",
    "(P(x) ↔ Q(x)) ↔ (P(y) ↔ Q(y))",
    "¬(¬P(x) ∧ ¬∃y ¬R(f(x), g(y, c)))",
    "(P(x) → Q(x)) → (P(y) → Q(y))",
    "∀x P(x) ∧ ∃y(Q(y) ∨ P(y)) → ¬R(x,y)",
    "P(x) ∨ (Q(x) ∨ P(y)) ∨ (Q(y) ∧ (P(c) ∨ Q(c)))",
])
def test_printed_formula_parses_back_to_the_same_ast(text):
    original = ast(text)
    printed = to_string(original)
    assert strip_spans(ast(printed)) == strip_spans(original)
    assert to_string(ast(printed)) == printed  # punto fijo


def test_substitution_replaces_free_variables():
    tree = ast("∀x(P(x) → ∃y R(x,y))")
    assert to_string(tree["body"], {"x": "3"}) == "P(3) → ∃y R(3,y)"


def test_substitution_does_not_touch_bound_variables():
    tree = ast("P(x) ∧ ∀x Q(x)")
    assert to_string(tree, {"x": "1"}) == "P(1) ∧ ∀x Q(x)"


def test_substitution_inside_functions():
    assert to_string(ast("R(x, f(x))"), {"x": "1"}) == "R(1, f(1))"


def test_to_string_of_terms():
    term = ast("P(g(f(x), c))")["args"][0]
    assert to_string(term) == "g(f(x), c)"
    assert to_string(term, {"x": "2"}) == "g(f(2), c)"
