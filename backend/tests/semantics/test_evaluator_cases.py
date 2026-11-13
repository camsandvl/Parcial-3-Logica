import pytest

from app.semantics.evaluator import evaluate
from app.semantics.interpretation import validate_environment, validate_interpretation


def variable(name="x"):
    return {"type": "var", "name": name, "span": [0, 1]}


def atom(name="P", variable_name="x"):
    return {
        "type": "pred",
        "name": name,
        "args": [variable(variable_name)],
        "span": [0, 4],
    }


def binary(kind, left, right):
    return {"type": kind, "left": left, "right": right, "span": [0, 9]}


def quantified(kind, body, name="x"):
    return {"type": kind, "var": name, "body": body, "span": [0, 8]}


INTERPRETATION = {
    "domain": ["1", "2"],
    "functions": {},
    "predicates": {"P": [["1"]], "Q": [["2"]]},
}


@pytest.mark.parametrize(
    ("case", "ast", "environment", "expected"),
    [
        ("not-true", {"type": "not", "body": atom(), "span": [0, 5]}, {"x": "1"}, False),
        ("not-false", {"type": "not", "body": atom("Q"), "span": [0, 5]}, {"x": "1"}, True),
        ("and-true", binary("and", atom(), atom()), {"x": "1"}, True),
        ("and-false-left", binary("and", atom("Q"), atom()), {"x": "1"}, False),
        ("and-false-right", binary("and", atom(), atom("Q")), {"x": "1"}, False),
        ("or-true-left", binary("or", atom(), atom("Q")), {"x": "1"}, True),
        ("or-true-right", binary("or", atom("Q"), atom()), {"x": "1"}, True),
        ("or-false", binary("or", atom("Q"), atom("Q")), {"x": "1"}, False),
        ("implies-false", binary("implies", atom(), atom("Q")), {"x": "1"}, False),
        ("implies-true-antecedent-false", binary("implies", atom("Q"), atom()), {"x": "1"}, True),
        ("implies-true-consequent", binary("implies", atom(), atom()), {"x": "1"}, True),
        ("iff-true", binary("iff", atom(), atom()), {"x": "1"}, True),
        ("iff-false", binary("iff", atom(), atom("Q")), {"x": "1"}, False),
        ("forall-false", quantified("forall", atom()), {}, False),
        ("forall-true", quantified("forall", atom("P")), {}, False),
        ("exists-true", quantified("exists", atom()), {}, True),
        ("exists-false", quantified("exists", atom("Q")), {}, True),
        ("nested-forall-exists", quantified("forall", quantified("exists", atom())), {}, True),
        ("nested-exists-forall", quantified("exists", quantified("forall", atom())), {}, False),
        ("bound-variable-shadowing", quantified("forall", atom(), "x"), {"x": "2"}, False),
        ("open-p", atom(), {"x": "1"}, True),
        ("open-q", atom("Q"), {"x": "2"}, True),
        ("open-p-false", atom(), {"x": "2"}, False),
        ("open-q-false", atom("Q"), {"x": "1"}, False),
        ("double-not", {"type": "not", "body": {"type": "not", "body": atom(), "span": [1, 5]}, "span": [0, 6]}, {"x": "1"}, True),
        ("and-both-false", binary("and", atom("Q"), atom("Q")), {"x": "1"}, False),
        ("or-both-true", binary("or", atom(), atom()), {"x": "1"}, True),
        ("iff-both-false", binary("iff", atom("Q"), atom("Q")), {"x": "1"}, True),
        ("forall-q-false", quantified("forall", atom("Q")), {}, False),
        ("exists-q-true", quantified("exists", atom("Q")), {}, True),
        ("forall-p-on-one", quantified("forall", atom()), {}, False),
        ("exists-p-on-one", quantified("exists", atom()), {}, True),
        ("and-q-p", binary("and", atom("Q"), atom()), {"x": "1"}, False),
        ("or-q-p", binary("or", atom("Q"), atom()), {"x": "1"}, True),
        ("implies-q-p", binary("implies", atom("Q"), atom()), {"x": "1"}, True),
        ("implies-p-q", binary("implies", atom(), atom("Q")), {"x": "1"}, False),
        ("iff-q-p", binary("iff", atom("Q"), atom()), {"x": "1"}, False),
        ("not-q", {"type": "not", "body": atom("Q"), "span": [0, 5]}, {"x": "1"}, True),
        ("not-p-at-two", {"type": "not", "body": atom(), "span": [0, 5]}, {"x": "2"}, True),
        ("not-q-at-two", {"type": "not", "body": atom("Q"), "span": [0, 5]}, {"x": "2"}, False),
    ],
)
def test_evaluator_truth_cases(case, ast, environment, expected):
    value, trace = evaluate(ast, INTERPRETATION, environment)

    assert value is expected, case
    assert trace["value"] is expected
    assert "children" in trace


def test_nested_function_and_constant_are_evaluated():
    ast = {
        "type": "pred",
        "name": "R",
        "args": [
            {"type": "func", "name": "f", "args": [
                {"type": "func", "name": "g", "args": [{"type": "var", "name": "x", "span": [0, 1]}], "span": [0, 5]}
            ], "span": [0, 8]},
            {"type": "func", "name": "c", "args": [], "span": [0, 1]},
        ],
        "span": [0, 10],
    }
    interpretation = {
        "domain": ["1", "2"],
        "functions": {
            "g": [[["1"], "2"], [["2"], "1"]],
            "f": [[["1"], "1"], [["2"], "1"]],
            "c": [[[], "1"]],
        },
        "predicates": {"R": [["1", "1"]]},
    }

    value, trace = evaluate(ast, interpretation, {"x": "1"})

    assert value is True
    assert trace["text"] == "R(f(g(1)), c) = R(1, 1)"


@pytest.mark.parametrize(
    "error_code",
    [
        "EMPTY_DOMAIN",
        "DUPLICATE_ELEMENT",
        "FUNCTION_INCOMPLETE",
        "FUNCTION_VALUE_OUT_OF_DOMAIN",
        "EMPTY_RELATION",
        "TUPLE_OUT_OF_DOMAIN",
        "TUPLE_WRONG_ARITY",
    ],
)
def test_interpretation_error_codes(error_code):
    language = {
        "functions": [{"name": "f", "arity": 1}],
        "predicates": [{"name": "P", "arity": 1}],
    }
    interpretations = {
        "EMPTY_DOMAIN": {"domain": [], "functions": {}, "predicates": {}},
        "DUPLICATE_ELEMENT": {"domain": ["1", "1"], "functions": {}, "predicates": {"P": [["1"]]}},
        "FUNCTION_INCOMPLETE": {"domain": ["1"], "functions": {}, "predicates": {"P": [["1"]]}},
        "FUNCTION_VALUE_OUT_OF_DOMAIN": {"domain": ["1"], "functions": {"f": [[["2"], "1"]]}, "predicates": {"P": [["1"]]}},
        "EMPTY_RELATION": {"domain": ["1"], "functions": {"f": [[["1"], "1"]]}, "predicates": {}},
        "TUPLE_OUT_OF_DOMAIN": {"domain": ["1"], "functions": {"f": [[["1"], "1"]]}, "predicates": {"P": [["2"]]}},
        "TUPLE_WRONG_ARITY": {"domain": ["1"], "functions": {"f": [[["1"], "1"]]}, "predicates": {"P": [[]]}},
    }

    errors = validate_interpretation(language, interpretations[error_code])

    assert any(error["code"] == error_code for error in errors)


def test_environment_reports_missing_assignment():
    errors = validate_environment(["x", "y"], {"x": "1"}, ["1", "2"])

    assert [error["code"] for error in errors] == ["MISSING_ASSIGNMENT"]


def test_environment_reports_assignment_outside_domain():
    errors = validate_environment(["x"], {"x": "3"}, ["1", "2"])

    assert errors[0]["code"] == "ASSIGNMENT_OUT_OF_DOMAIN"
