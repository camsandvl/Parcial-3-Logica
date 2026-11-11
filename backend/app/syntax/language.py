"""Validación del lenguaje (signatura): funciones y predicados con su aridad.

Reglas (REPARTO.md, sección 3.1):
- Nombre: empieza con letra y sigue con letras, dígitos o `_`.
- El nombre no puede tener forma de variable (`x`, `y`, `z`, `w` con dígitos opcionales).
- Ningún nombre se repite, ni dentro de un tipo ni entre funciones y predicados.
- Aridad entera: funciones >= 0 (0 = constante), predicados >= 1.
"""

from __future__ import annotations

import re
from typing import Any

from .errors import language_error

NAME_RE = re.compile(r"[A-Za-z][A-Za-z0-9_]*")
VARIABLE_RE = re.compile(r"[xyzw]\d*")

KINDS = (("functions", "función", 0), ("predicates", "predicado", 1))


def is_variable_name(name: str) -> bool:
    return VARIABLE_RE.fullmatch(name) is not None


def validate_language(language: dict) -> list[dict]:
    """Errores INVALID_LANGUAGE (lista vacía si es válido)."""
    if not isinstance(language, dict):
        return [language_error("El lenguaje debe ser un objeto con funciones y predicados", "language")]

    errors: list[dict[str, Any]] = []
    seen: dict[str, str] = {}  # nombre -> path donde apareció primero

    for kind, label, minimum in KINDS:
        symbols = language.get(kind, [])
        if not isinstance(symbols, list):
            errors.append(language_error(f"«{kind}» debe ser una lista", f"language.{kind}"))
            continue
        for index, symbol in enumerate(symbols):
            path = f"language.{kind}[{index}]"
            if not isinstance(symbol, dict):
                errors.append(language_error(f"La {label} n.º {index + 1} no tiene nombre ni aridad", path))
                continue

            name = symbol.get("name")
            if not isinstance(name, str) or not name:
                errors.append(language_error(f"La {label} n.º {index + 1} no tiene nombre", path))
            elif NAME_RE.fullmatch(name) is None:
                errors.append(language_error(
                    f"«{name}» no es un nombre válido: debe empezar con letra y seguir con letras, dígitos o _",
                    path,
                ))
            elif is_variable_name(name):
                errors.append(language_error(
                    f"«{name}» tiene forma de variable (x, y, z, w); elige otro nombre", path
                ))
            elif name in seen:
                errors.append(language_error(f"«{name}» está repetido", path))
            else:
                seen[name] = path

            arity = symbol.get("arity")
            shown = name if isinstance(name, str) and name else f"la {label} n.º {index + 1}"
            # bool es subclase de int en Python: True no es una aridad válida.
            if not isinstance(arity, int) or isinstance(arity, bool):
                errors.append(language_error(f"La aridad de {shown} debe ser un número entero", path))
            elif arity < minimum:
                if kind == "predicates":
                    message = f"El predicado {shown} debe tener aridad 1 o mayor (recibió {arity})"
                else:
                    message = f"La aridad de {shown} no puede ser negativa (recibió {arity})"
                errors.append(language_error(message, path))
    return errors


def symbol_tables(language: Any) -> tuple[dict[str, int], dict[str, int]]:
    """Diccionarios nombre -> aridad para funciones y predicados (ignora entradas malformadas)."""
    tables: list[dict[str, int]] = [{}, {}]
    if isinstance(language, dict):
        for table, (kind, _, _) in zip(tables, KINDS):
            symbols = language.get(kind, [])
            if not isinstance(symbols, list):
                continue
            for symbol in symbols:
                if isinstance(symbol, dict) and isinstance(symbol.get("name"), str):
                    arity = symbol.get("arity")
                    if isinstance(arity, int) and not isinstance(arity, bool):
                        table.setdefault(symbol["name"], arity)
    return tables[0], tables[1]
