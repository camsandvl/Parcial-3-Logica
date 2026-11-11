"""Aportes opcionales: números de Gödel y formas normales (NNF y prenexa)."""

import itertools
import random

import pytest

from app.syntax import decode_godel, free_vars, godel_number, godel_numbers, parse, to_nnf, to_prenex, to_string
from helpers import LANGUAGE, random_interpretation, truth

FORMULAS = [
    "∀x(P(x) → ∃y R(x,y))",
    "¬(P(x) ↔ Q(y))",
    "P(x) ∧ ∀x Q(x) → ¬∃y R(x,y)",
    "∀x ∃y R(x,y) ↔ ∃y ∀x R(x,y)",
    "¬∀x(P(x) ∨ ¬∃y(R(x,y) ∧ Q(f(y))))",
    "(∃x P(x) → ∀y Q(y)) ∧ ∃x ¬R(x, g(x, c))",
    "∀x P(x) ∨ ∀x Q(x)",
]


def ast(text):
    result = parse(text, LANGUAGE)
    assert result["ok"], result
    return result["ast"]


def is_nnf(node):
    kind = node["type"]
    if kind == "pred":
        return True
    if kind == "not":
        return node["body"]["type"] == "pred"
    if kind in ("and", "or"):
        return is_nnf(node["left"]) and is_nnf(node["right"])
    if kind in ("forall", "exists"):
        return is_nnf(node["body"])
    return False  # → y ↔ no deben aparecer


def is_prenex(node):
    while node["type"] in ("forall", "exists"):
        node = node["body"]
    return "∀" not in to_string(node) and "∃" not in to_string(node)


def assert_equivalent(original, transformed):
    rng = random.Random(2026)
    variables = sorted(set(free_vars(original)) | set(free_vars(transformed)))
    for size in (1, 2, 3):
        for _ in range(15):
            interp = random_interpretation(rng, size)
            for values in itertools.product(interp["domain"], repeat=len(variables)):
                env = dict(zip(variables, values))
                assert truth(original, interp, env) == truth(transformed, interp, env), (to_string(original), env)


@pytest.mark.parametrize("text", FORMULAS)
def test_nnf_is_equivalent_and_well_formed(text):
    original = ast(text)
    nnf = to_nnf(original)
    assert is_nnf(nnf)
    assert free_vars(nnf) == free_vars(original)
    assert_equivalent(original, nnf)


@pytest.mark.parametrize("text", FORMULAS)
def test_prenex_is_equivalent_and_well_formed(text):
    original = ast(text)
    prenex = to_prenex(original)
    assert is_prenex(prenex)
    assert free_vars(prenex) == free_vars(original)
    assert_equivalent(original, prenex)


def test_nnf_examples():
    assert to_string(to_nnf(ast("¬∀x(P(x) → Q(x))"))) == "∃x(P(x) ∧ ¬Q(x))"
    assert to_string(to_nnf(ast("¬(P(x) ∨ Q(x))"))) == "¬P(x) ∧ ¬Q(x)"


def test_prenex_renames_to_avoid_capture():
    assert to_string(to_prenex(ast("P(x) ∧ ∀x Q(x)"))) == "∀x1(P(x) ∧ Q(x1))"


def test_normal_forms_print_and_parse_back():
    for text in FORMULAS:
        for transform in (to_nnf, to_prenex):
            assert parse(to_string(transform(ast(text))), LANGUAGE)["ok"]


def test_godel_number_matches_frontend_formula():
    # f es la función n.º 1 de aridad 1: 2^1 · 3^1 · 5^1 = 30
    assert godel_number("functions", 1, 1) == 30
    # R es el predicado n.º 3 de aridad 2: 2^2 · 3^2 · 5^3 = 4500
    assert godel_numbers(LANGUAGE)["R"] == 4500


def test_godel_numbers_are_unique_and_decodable():
    numbers = godel_numbers(LANGUAGE)
    assert len(set(numbers.values())) == len(numbers)
    assert decode_godel(4500) == {"kind": "predicates", "arity": 2, "position": 3}
    with pytest.raises(ValueError):
        decode_godel(7)
