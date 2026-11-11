"""Datos y utilidades compartidas por las pruebas de sintaxis."""

from __future__ import annotations

import itertools
import random
from typing import Any

LANGUAGE = {
    "functions": [
        {"name": "f", "arity": 1},
        {"name": "g", "arity": 2},
        {"name": "c", "arity": 0},
    ],
    "predicates": [
        {"name": "P", "arity": 1},
        {"name": "Q", "arity": 1},
        {"name": "R", "arity": 2},
    ],
}


def strip_spans(node: Any) -> Any:
    """Quita los `span` para comparar solo la estructura del AST."""
    if isinstance(node, dict):
        return {key: strip_spans(value) for key, value in node.items() if key != "span"}
    if isinstance(node, list):
        return [strip_spans(item) for item in node]
    return node


def V(name: str) -> dict:
    return {"type": "var", "name": name}


def F(name: str, *args: dict) -> dict:
    return {"type": "func", "name": name, "args": list(args)}


def A(name: str, *args: dict) -> dict:
    return {"type": "pred", "name": name, "args": list(args)}


def random_interpretation(rng: random.Random, size: int) -> dict:
    """Interpretación aleatoria (total y con relaciones no vacías) para LANGUAGE."""
    domain = [str(i) for i in range(1, size + 1)]
    functions = {}
    for symbol in LANGUAGE["functions"]:
        tuples = itertools.product(domain, repeat=symbol["arity"])
        functions[symbol["name"]] = {t: rng.choice(domain) for t in tuples}
    predicates = {}
    for symbol in LANGUAGE["predicates"]:
        tuples = list(itertools.product(domain, repeat=symbol["arity"]))
        predicates[symbol["name"]] = {t for t in tuples if rng.random() < 0.5} or {tuples[0]}
    return {"domain": domain, "functions": functions, "predicates": predicates}


def _term(term: dict, interp: dict, env: dict) -> str:
    if term["type"] == "var":
        return env[term["name"]]
    args = tuple(_term(arg, interp, env) for arg in term["args"])
    return interp["functions"][term["name"]][args]


def truth(node: dict, interp: dict, env: dict) -> bool:
    """Evaluador de referencia mínimo (solo para comprobar equivalencias en las pruebas)."""
    kind = node["type"]
    if kind == "pred":
        return tuple(_term(arg, interp, env) for arg in node["args"]) in interp["predicates"][node["name"]]
    if kind == "not":
        return not truth(node["body"], interp, env)
    if kind in ("and", "or", "implies", "iff"):
        left, right = truth(node["left"], interp, env), truth(node["right"], interp, env)
        return {
            "and": left and right,
            "or": left or right,
            "implies": (not left) or right,
            "iff": left == right,
        }[kind]
    results = (truth(node["body"], interp, {**env, node["var"]: d}) for d in interp["domain"])
    return all(results) if kind == "forall" else any(results)
