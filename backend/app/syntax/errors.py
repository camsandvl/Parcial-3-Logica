"""Construcción de errores con el formato de contracts/types.ts (ValidationError)."""

from __future__ import annotations

from typing import Any


def language_error(message: str, path: str) -> dict[str, Any]:
    return {"code": "INVALID_LANGUAGE", "stage": "language", "message": message, "path": path}


def formula_error(code: str, message: str, span: tuple[int, int] | list[int]) -> dict[str, Any]:
    return {
        "code": code,
        "stage": "syntax",
        "message": message,
        "span": [span[0], span[1]],
        "path": "formula",
    }


class SyntaxFailure(Exception):
    """Error estructural: detiene el análisis porque ya no se puede seguir leyendo."""

    def __init__(self, message: str, span: tuple[int, int]) -> None:
        super().__init__(message)
        self.error = formula_error("SYNTAX_ERROR", message, span)
