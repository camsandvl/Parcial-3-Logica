"""Evaluador de AST para lógica de primer orden con traza explicativa."""

from __future__ import annotations

from typing import Any


def _term(term: dict[str, Any], environment: dict[str, str], interpretation: dict[str, Any]) -> str:
    if term["type"] == "var":
        return environment[term["name"]]
    rows = interpretation.get("functions", {}).get(term["name"], [])
    arguments = [_term(argument, environment, interpretation) for argument in term["args"]]
    for row_arguments, value in rows:
        if row_arguments == arguments:
            return value
    raise ValueError(f"No se encontró la fila de la función {term['name']}")


def _evaluate(
    node: dict[str, Any],
    environment: dict[str, str],
    interpretation: dict[str, Any],
) -> tuple[bool, dict[str, Any]]:
    node_type = node["type"]
    if node_type == "pred":
        values = [_term(argument, environment, interpretation) for argument in node["args"]]
        result = values in interpretation.get("predicates", {}).get(node["name"], [])
        trace = {
            "node": "pred",
            "value": result,
            "kind": "atomic",
            "span": node["span"],
            "children": [],
        }
        return result, trace
    if node_type == "not":
        value, child = _evaluate(node["body"], environment, interpretation)
        return not value, {
            "node": "not",
            "value": not value,
            "kind": "connective",
            "span": node["span"],
            "children": [child],
        }
    if node_type in {"and", "or", "implies", "iff"}:
        left_value, left_trace = _evaluate(node["left"], environment, interpretation)
        right_value, right_trace = _evaluate(node["right"], environment, interpretation)
        if node_type == "and":
            value = left_value and right_value
        elif node_type == "or":
            value = left_value or right_value
        elif node_type == "implies":
            value = not left_value or right_value
        else:
            value = left_value == right_value
        children = [left_trace, right_trace]
        if node_type == "and" and not value:
            children = [left_trace] if not left_value else [right_trace]
        elif node_type == "or" and value:
            children = [left_trace] if left_value else [right_trace]
        elif node_type == "implies" and value:
            children = [left_trace] if not left_value else [right_trace]
        return value, {
            "node": node_type,
            "value": value,
            "kind": "connective",
            "span": node["span"],
            "children": children,
        }
    if node_type in {"forall", "exists"}:
        values = interpretation["domain"]
        checked: list[dict[str, Any]] = []
        decisive: dict[str, str] | None = None
        selected_trace: dict[str, Any] | None = None
        expected = node_type == "forall"
        result = expected
        for element in values:
            scoped = {**environment, node["var"]: element}
            current, current_trace = _evaluate(node["body"], scoped, interpretation)
            checked.append({node["var"]: element, "value": current})
            if (node_type == "exists" and current) or (node_type == "forall" and not current):
                result = current if node_type == "exists" else False
                decisive = {node["var"]: element}
                selected_trace = current_trace
                break
        else:
            result = expected
        kind = "witness" if node_type == "exists" and result else "counterexample"
        if (node_type == "forall" and result) or (node_type == "exists" and not result):
            kind = "full_check"
        return result, {
            "node": node_type,
            "value": result,
            "kind": kind,
            "span": node["span"],
            "var": node["var"],
            "checked": checked,
            "children": [selected_trace] if selected_trace else [],
            **({"decisive": decisive} if decisive else {}),
        }
    raise ValueError(f"Nodo AST desconocido: {node_type}")


def evaluate(
    ast: dict[str, Any],
    interpretation: dict[str, Any],
    environment: dict[str, str] | None = None,
) -> tuple[bool, dict[str, Any]]:
    """Evalúa un AST ya construido por el parser y devuelve valor más traza."""
    return _evaluate(ast, environment or {}, interpretation)
