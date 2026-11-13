"""Aporte creativo: número de Gödel de cada símbolo del lenguaje.

    G = 2^tipo · 3^aridad · 5^posición

tipo: 1 = función, 2 = predicado; posición: 1, 2, 3… dentro de su tipo.
Es la misma fórmula que usa la ficha del frontend (frontend/src/components/vn/SymbolTile.tsx),
así backend y pantalla muestran el mismo número.

Por el teorema fundamental de la aritmética (factorización única en primos), dos símbolos
distintos nunca comparten número y del número se recupera el símbolo (`decode_godel`).
"""

from __future__ import annotations

from typing import Any

KIND_CODE = {"functions": 1, "predicates": 2}
CODE_KIND = {code: kind for kind, code in KIND_CODE.items()}


def godel_number(kind: str, arity: int, position: int) -> int:
    """Número de Gödel de un símbolo. `position` empieza en 1."""
    if kind not in KIND_CODE:
        raise ValueError("kind debe ser 'functions' o 'predicates'")
    if arity < 0 or position < 1:
        raise ValueError("aridad >= 0 y posición >= 1")
    return 2 ** KIND_CODE[kind] * 3 ** arity * 5 ** position


def decode_godel(number: int) -> dict[str, Any]:
    """Inverso de `godel_number`: factoriza en 2, 3 y 5."""
    exponents = []
    for prime in (2, 3, 5):
        exponent = 0
        while number % prime == 0 and number > 1:
            number //= prime
            exponent += 1
        exponents.append(exponent)
    if number != 1 or exponents[0] not in CODE_KIND or exponents[2] < 1:
        raise ValueError("No es el número de Gödel de un símbolo")
    return {"kind": CODE_KIND[exponents[0]], "arity": exponents[1], "position": exponents[2]}


def godel_numbers(language: dict) -> dict[str, int]:
    """Nombre -> número de Gödel para todo el lenguaje (supone un lenguaje ya validado)."""
    return {
        symbol["name"]: godel_number(kind, symbol["arity"], index)
        for kind in KIND_CODE
        for index, symbol in enumerate(language.get(kind, []), start=1)
    }
