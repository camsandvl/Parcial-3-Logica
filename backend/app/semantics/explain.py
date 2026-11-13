"""Mensajes en español derivados de la traza semántica."""

from __future__ import annotations

from typing import Any


def summary(formula: str, value: bool, trace: dict[str, Any]) -> str:
    """Construye el resumen visible sin alterar el valor lógico."""
    if trace["kind"] in {"witness", "counterexample"}:
        label = "testigo" if trace["kind"] == "witness" else "contraejemplo"
        assignment = ", ".join(
            f"{name} = {element}" for name, element in trace["decisive"].items()
        )
        return (
            f"{formula} es {'Verdadero' if value else 'Falso'}: "
            f"{label} {assignment}"
        )
    return f"{formula} es {'Verdadero' if value else 'Falso'}"
