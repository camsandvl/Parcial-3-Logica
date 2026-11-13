"""Aplicación HTTP del backend semántico y de sintaxis."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.db import Database
from app.semantics.evaluator import evaluate
from app.semantics.explain import summary
from app.semantics.interpretation import validate_environment, validate_interpretation
from app.syntax import free_vars, parse, router as syntax_router, to_string, validate_language

app = FastAPI(title="La Máquina de Turing")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
database = Database(os.getenv("LOGIC_DATABASE"))
app.include_router(syntax_router)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _failure(errors: list[dict[str, Any]]) -> dict[str, Any]:
    return {"ok": False, "errors": errors}


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "La Máquina de Turing API", "status": "ok", "docs": "/docs"}


@app.post("/api/interpretation/validate")
def interpretation_validate(payload: dict[str, Any]) -> dict[str, Any]:
    language = payload.get("language", {})
    interpretation = payload.get("interpretation", {})
    language_errors = validate_language(language)
    if language_errors:
        return _failure(language_errors)
    errors = validate_interpretation(language, interpretation)
    return {"ok": True} if not errors else _failure(errors)


@app.post("/api/evaluate")
def evaluate_formula(payload: dict[str, Any]) -> dict[str, Any]:
    language = payload.get("language", {})
    interpretation = payload.get("interpretation", {})
    language_errors = validate_language(language)
    if language_errors:
        return _failure(language_errors)

    interpretation_errors = validate_interpretation(language, interpretation)
    if interpretation_errors:
        return _failure(interpretation_errors)

    formula = payload.get("formula", "")
    ast = payload.get("ast")
    free = free_vars(ast) if isinstance(ast, dict) else None
    if ast is None:
        parsed = parse(formula, language)
        if not parsed["ok"]:
            return parsed
        ast = parsed["ast"]
        free = parsed["freeVars"]

    environment = payload.get("environment", {})
    environment_errors = validate_environment(free or [], environment, interpretation["domain"])
    if environment_errors:
        return _failure(environment_errors)

    try:
        value, trace = evaluate(ast, language, interpretation, environment)
    except (KeyError, ValueError) as error:
        return _failure([{
            "code": "MISSING_ASSIGNMENT",
            "stage": "environment",
            "message": str(error),
            "path": "environment",
        }])

    formula_text = formula or to_string(ast)
    result_summary = summary(formula_text, value, trace)

    database.add_history(
        created_at=_now(),
        formula=formula_text,
        environment=environment,
        value=value,
        summary=result_summary,
        trace=trace,
    )
    return {"ok": True, "value": value, "summary": result_summary, "trace": trace}


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
    language = payload.get("language", {})
    interpretation = payload.get("interpretation", {})
    language_errors = validate_language(language)
    if language_errors:
        return _failure(language_errors)
    errors = validate_interpretation(language, interpretation)
    if errors:
        return _failure(errors)
    return database.save_scenario(
        name=name,
        language=language,
        interpretation=interpretation,
        created_at=_now(),
    )
