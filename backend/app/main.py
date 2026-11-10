"""Aplicación HTTP del backend semántico."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException

from app.db import Database
from app.semantics.evaluator import evaluate
from app.semantics.interpretation import validate_interpretation

app = FastAPI(title="La Máquina de Turing")
database = Database(os.getenv("LOGIC_DATABASE", "backend/data/logic.db"))
NAME = r"^[A-Za-z][A-Za-z0-9_]*$"
VARIABLE = r"^[xyzw]\d*$"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parser():
    try:
        from app.syntax import parse
    except ModuleNotFoundError:
        return None
    return parse


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "La Máquina de Turing API", "status": "ok", "docs": "/docs"}


@app.post("/api/language/validate")
def language_validate(language: dict[str, Any]) -> dict[str, Any]:
    import re

    errors: list[dict[str, Any]] = []
    seen: set[str] = set()
    for kind in ("functions", "predicates"):
        for index, symbol in enumerate(language.get(kind, [])):
            name = symbol.get("name", "")
            path = f"language.{kind}[{index}]"
            if not re.fullmatch(NAME, name) or re.fullmatch(VARIABLE, name):
                errors.append({
                    "code": "INVALID_LANGUAGE",
                    "stage": "language",
                    "message": f'"{name}" no es un nombre válido',
                    "path": path,
                })
            if name in seen:
                errors.append({
                    "code": "INVALID_LANGUAGE",
                    "stage": "language",
                    "message": f'"{name}" está repetido',
                    "path": path,
                })
            seen.add(name)
            minimum = 1 if kind == "predicates" else 0
            if not isinstance(symbol.get("arity"), int) or symbol["arity"] < minimum:
                errors.append({
                    "code": "INVALID_LANGUAGE",
                    "stage": "language",
                    "message": f"La aridad de {name} debe ser un entero >= {minimum}",
                    "path": path,
                })
    return {"ok": True} if not errors else {"ok": False, "errors": errors}


@app.post("/api/parse")
def parse_formula(payload: dict[str, Any]) -> dict[str, Any]:
    parser = _parser()
    if parser is None:
        return {
            "ok": False,
            "errors": [{
                "code": "SYNTAX_ERROR",
                "stage": "syntax",
                "message": "El parser de Emily todavía no está integrado.",
                "path": "formula",
            }],
        }
    return parser(payload.get("formula", ""), payload.get("language", {}))


@app.post("/api/interpretation/validate")
def interpretation_validate(payload: dict[str, Any]) -> dict[str, Any]:
    errors = validate_interpretation(payload.get("language", {}), payload.get("interpretation", {}))
    return {"ok": True} if not errors else {"ok": False, "errors": errors}


@app.post("/api/evaluate")
def evaluate_formula(payload: dict[str, Any]) -> dict[str, Any]:
    language = payload.get("language", {})
    interpretation = payload.get("interpretation", {})
    interpretation_errors = validate_interpretation(language, interpretation)
    if interpretation_errors:
        return {"ok": False, "errors": interpretation_errors}

    ast = payload.get("ast")
    formula = payload.get("formula", "")
    if ast is None:
        parser = _parser()
        if parser is None:
            return {
                "ok": False,
                "errors": [{
                    "code": "SYNTAX_ERROR",
                    "stage": "syntax",
                    "message": "El parser todavía no está disponible; envía un AST para probar la semántica.",
                    "path": "formula",
                }],
            }
        parsed = parser(formula, language)
        if not parsed["ok"]:
            return parsed
        ast = parsed["ast"]

    environment = payload.get("environment", {})
    try:
        value, trace = evaluate(ast, interpretation, environment)
    except (KeyError, ValueError) as error:
        return {
            "ok": False,
            "errors": [{
                "code": "MISSING_ASSIGNMENT",
                "stage": "environment",
                "message": str(error),
                "path": "environment",
            }],
        }
    summary = f"{formula or 'Fórmula'} es {'Verdadero' if value else 'Falso'}"
    database.add_history(
        created_at=_now(), formula=formula, value=value, summary=summary, trace=trace
    )
    return {"ok": True, "value": value, "summary": summary, "trace": trace}


@app.get("/api/history")
def history() -> list[dict[str, Any]]:
    return database.list_history()


@app.get("/api/scenarios")
def scenarios() -> list[dict[str, Any]]:
    return database.list_scenarios()


@app.post("/api/scenarios")
def save_scenario(payload: dict[str, Any]) -> dict[str, Any]:
    name = payload.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre del escenario es obligatorio")
    errors = validate_interpretation(payload.get("language", {}), payload.get("interpretation", {}))
    if errors:
        return {"ok": False, "errors": errors}
    return database.save_scenario(
        name=name,
        language=payload["language"],
        interpretation=payload["interpretation"],
        created_at=_now(),
    )
