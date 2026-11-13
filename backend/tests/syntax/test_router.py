"""Endpoints probados sobre el router propio, sin depender de app/main.py."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.syntax import router
from helpers import LANGUAGE

app = FastAPI()
app.include_router(router)
client = TestClient(app)


def test_language_validate_ok():
    assert client.post("/api/language/validate", json=LANGUAGE).json() == {"ok": True}


def test_language_validate_error():
    body = {"functions": [{"name": "f", "arity": -1}], "predicates": [{"name": "f", "arity": 0}]}
    response = client.post("/api/language/validate", json=body).json()
    assert response["ok"] is False
    assert {e["code"] for e in response["errors"]} == {"INVALID_LANGUAGE"}
    assert len(response["errors"]) == 3


def test_parse_ok_returns_ast_and_free_vars():
    response = client.post("/api/parse", json={"formula": "∀x R(x, y)", "language": LANGUAGE})
    data = response.json()
    assert response.status_code == 200
    assert data["ok"] is True
    assert data["ast"]["type"] == "forall"
    assert data["freeVars"] == ["y"]


def test_parse_error_never_has_value():
    data = client.post("/api/parse", json={"formula": "R(x)", "language": LANGUAGE}).json()
    assert data["ok"] is False and "value" not in data
    assert data["errors"][0]["code"] == "ARITY_MISMATCH"
    assert data["errors"][0]["span"] == [0, 4]


def test_parse_with_missing_fields_is_an_error_not_a_crash():
    data = client.post("/api/parse", json={}).json()
    assert data["ok"] is False
    assert data["errors"][0]["code"] == "SYNTAX_ERROR"


def test_parse_with_non_object_body():
    data = client.post("/api/parse", json=["P(x)"]).json()
    assert data["ok"] is False
