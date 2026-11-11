"""Endpoints de sintaxis: POST /api/language/validate y POST /api/parse (REPARTO.md 3.7)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body

from .language import validate_language
from .parser import parse

router = APIRouter(prefix="/api", tags=["sintaxis"])


@router.post("/language/validate")
def language_validate(language: Any = Body(...)) -> dict[str, Any]:
    """Recibe un `Language` y devuelve `{ok: true}` o los errores INVALID_LANGUAGE."""
    errors = validate_language(language)
    return {"ok": True} if not errors else {"ok": False, "errors": errors}


@router.post("/parse")
def parse_formula(payload: Any = Body(...)) -> dict[str, Any]:
    """Recibe `{formula, language}` y devuelve `{ok, ast, freeVars}` o los errores."""
    if not isinstance(payload, dict):
        payload = {}
    return parse(payload.get("formula", ""), payload.get("language", {}))
