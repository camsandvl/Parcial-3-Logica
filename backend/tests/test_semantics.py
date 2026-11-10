from app.semantics.evaluator import evaluate
from app.semantics.interpretation import validate_interpretation


def test_validates_function_completeness():
    language = {"functions": [{"name": "f", "arity": 1}], "predicates": []}
    interpretation = {"domain": ["1", "2"], "functions": {"f": [[["1"], "2"]]}, "predicates": {}}

    errors = validate_interpretation(language, interpretation)

    assert any(error["code"] == "FUNCTION_INCOMPLETE" for error in errors)


def test_evaluates_existential_witness():
    ast = {
        "type": "exists",
        "var": "x",
        "span": [0, 8],
        "body": {"type": "pred", "name": "P", "args": [
            {"type": "var", "name": "x", "span": [6, 7]}
        ], "span": [5, 8]},
    }
    interpretation = {
        "domain": ["1", "2"],
        "functions": {},
        "predicates": {"P": [["2"]]},
    }

    value, trace = evaluate(ast, interpretation)

    assert value is True
    assert trace["kind"] == "witness"
    assert trace["decisive"] == {"x": "2"}
