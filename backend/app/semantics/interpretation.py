"""Validación de dominios, funciones, predicados y entornos."""

from __future__ import annotations

from typing import Any


def _error(code: str, message: str, path: str) -> dict[str, str]:
    return {"code": code, "stage": "interpretation", "message": message, "path": path}


def _environment_error(code: str, message: str, path: str) -> dict[str, str]:
    return {"code": code, "stage": "environment", "message": message, "path": path}


def validate_environment(
    free_vars: list[str], environment: dict[str, str], domain: list[str]
) -> list[dict[str, str]]:
    """Comprueba solo las asignaciones de variables libres."""
    errors: list[dict[str, str]] = []
    for name in free_vars:
        if name not in environment or not environment[name]:
            errors.append(
                _environment_error(
                    "MISSING_ASSIGNMENT",
                    f"La variable libre {name} no tiene asignación",
                    f"environment.{name}",
                )
            )
        elif environment[name] not in domain:
            errors.append(
                _environment_error(
                    "ASSIGNMENT_OUT_OF_DOMAIN",
                    f"{name} apunta a {environment[name]!r}, que no está en D",
                    f"environment.{name}",
                )
            )
    return errors


def validate_interpretation(
    language: dict[str, Any], interpretation: dict[str, Any]
) -> list[dict[str, str]]:
    errors: list[dict[str, str]] = []
    domain = interpretation.get("domain", [])
    domain_set = set(domain)

    if not domain:
        errors.append(_error("EMPTY_DOMAIN", "El dominio no puede estar vacío", "domain"))
    if len(domain_set) != len(domain):
        errors.append(
            _error("DUPLICATE_ELEMENT", "El dominio tiene elementos repetidos", "domain")
        )
    if any(not isinstance(element, str) or not element for element in domain):
        errors.append(
            _error(
                "DUPLICATE_ELEMENT",
                "Los elementos del dominio deben ser strings no vacíos",
                "domain",
            )
        )

    functions = interpretation.get("functions", {})
    for symbol in language.get("functions", []):
        name = symbol["name"]
        arity = symbol["arity"]
        rows = functions.get(name, [])
        expected = len(domain_set) ** arity
        keys: set[tuple[str, ...]] = set()
        for index, row in enumerate(rows):
            if not isinstance(row, list) or len(row) != 2:
                errors.append(
                    _error(
                        "FUNCTION_INCOMPLETE",
                        f"{name} tiene una fila inválida",
                        f"functions.{name}[{index}]",
                    )
                )
                continue
            arguments, value = row
            if not isinstance(arguments, list) or not isinstance(value, str):
                errors.append(
                    _error(
                        "FUNCTION_VALUE_OUT_OF_DOMAIN",
                        f"{name} tiene una fila con formato inválido",
                        f"functions.{name}[{index}]",
                    )
                )
                continue
            key = tuple(arguments)
            if key in keys:
                errors.append(
                    _error(
                        "FUNCTION_INCOMPLETE",
                        f"{name} tiene una tupla definida dos veces",
                        f"functions.{name}[{index}]",
                    )
                )
            keys.add(key)
            if len(arguments) != arity or any(argument not in domain_set for argument in arguments):
                errors.append(
                    _error(
                        "FUNCTION_VALUE_OUT_OF_DOMAIN",
                        f"{name} usa argumentos fuera del dominio o con aridad incorrecta",
                        f"functions.{name}[{index}]",
                    )
                )
            if value not in domain_set:
                errors.append(
                    _error(
                        "FUNCTION_VALUE_OUT_OF_DOMAIN",
                        f"{name} toma el valor {value!r}, que no está en D",
                        f"functions.{name}[{index}]",
                    )
                )
        if len(keys) != expected:
            errors.append(
                _error(
                    "FUNCTION_INCOMPLETE",
                    f"{name} está definida en {len(keys)} de {expected} tuplas",
                    f"functions.{name}",
                )
            )

    predicates = interpretation.get("predicates", {})
    for symbol in language.get("predicates", []):
        name = symbol["name"]
        arity = symbol["arity"]
        tuples = predicates.get(name, [])
        if not tuples:
            errors.append(
                _error(
                    "EMPTY_RELATION",
                    f"La relación {name} no puede estar vacía",
                    f"predicates.{name}",
                )
            )
        for index, values in enumerate(tuples):
            path = f"predicates.{name}[{index}]"
            if not isinstance(values, list):
                errors.append(_error("TUPLE_WRONG_ARITY", f"{name} tiene una tupla inválida", path))
                continue
            if len(values) != arity:
                errors.append(
                    _error(
                        "TUPLE_WRONG_ARITY",
                        f"{name} tiene una tupla de tamaño {len(values)}, se esperaba {arity}",
                        path,
                    )
                )
            elif any(value not in domain_set for value in values):
                errors.append(
                    _error(
                        "TUPLE_OUT_OF_DOMAIN",
                        f"({', '.join(values)}) usa elementos fuera de D",
                        path,
                    )
                )
    return errors
