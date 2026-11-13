import pytest

from app.syntax import validate_language
from helpers import LANGUAGE


def lang(functions=(), predicates=()):
    return {"functions": list(functions), "predicates": list(predicates)}


def test_valid_language_has_no_errors():
    assert validate_language(LANGUAGE) == []


def test_empty_language_is_valid():
    assert validate_language(lang()) == []


def test_constant_is_function_of_arity_zero():
    assert validate_language(lang(functions=[{"name": "c", "arity": 0}])) == []


@pytest.mark.parametrize("name", ["1f", "_f", "f-g", "", "P(x)", "ñ", "f g"])
def test_invalid_names(name):
    errors = validate_language(lang(functions=[{"name": name, "arity": 1}]))
    assert [e["code"] for e in errors] == ["INVALID_LANGUAGE"]
    assert errors[0]["stage"] == "language"
    assert errors[0]["path"] == "language.functions[0]"


@pytest.mark.parametrize("name", ["x", "y", "z", "w", "x1", "y23"])
def test_names_with_variable_shape_are_rejected(name):
    errors = validate_language(lang(predicates=[{"name": name, "arity": 1}]))
    assert len(errors) == 1 and "variable" in errors[0]["message"]


def test_names_that_only_start_like_variables_are_allowed():
    assert validate_language(lang(predicates=[{"name": "xP", "arity": 1}, {"name": "Wolf", "arity": 1}])) == []


def test_duplicate_between_functions_and_predicates():
    errors = validate_language(lang(functions=[{"name": "f", "arity": 1}], predicates=[{"name": "f", "arity": 1}]))
    assert len(errors) == 1
    assert errors[0]["path"] == "language.predicates[0]"
    assert "repetido" in errors[0]["message"]


def test_duplicate_inside_the_same_kind():
    errors = validate_language(lang(predicates=[{"name": "P", "arity": 1}, {"name": "P", "arity": 2}]))
    assert [e["path"] for e in errors] == ["language.predicates[1]"]


@pytest.mark.parametrize("arity", [-1, 1.5, "2", None, True])
def test_function_arity_must_be_non_negative_integer(arity):
    errors = validate_language(lang(functions=[{"name": "f", "arity": arity}]))
    assert [e["code"] for e in errors] == ["INVALID_LANGUAGE"]


def test_predicate_of_arity_zero_is_invalid():
    errors = validate_language(lang(predicates=[{"name": "P", "arity": 0}]))
    assert len(errors) == 1 and "aridad 1 o mayor" in errors[0]["message"]


def test_all_errors_are_reported_together():
    errors = validate_language(lang(
        functions=[{"name": "x", "arity": 1}, {"name": "f", "arity": -2}],
        predicates=[{"name": "f", "arity": 0}],
    ))
    assert [e["path"] for e in errors] == [
        "language.functions[0]",
        "language.functions[1]",
        "language.predicates[0]",
        "language.predicates[0]",
    ]


@pytest.mark.parametrize("language", [None, [], {"functions": "f"}, {"predicates": [5]}])
def test_malformed_language_does_not_crash(language):
    errors = validate_language(language)
    assert errors and all(e["code"] == "INVALID_LANGUAGE" for e in errors)
