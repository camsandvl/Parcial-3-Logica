"""Evaluación recursiva de fórmulas de primer orden y construcción de trazas."""

from __future__ import annotations

from typing import Any

from app.syntax.printer import to_string


def _term(
    term: dict[str, Any], environment: dict[str, str], interpretation: dict[str, Any]
) -> str:
    if term["type"] == "var":
        return environment[term["name"]]
    arguments = [
        _term(argument, environment, interpretation) for argument in term.get("args", [])
    ]
    for row_arguments, value in interpretation.get("functions", {}).get(term["name"], []):
        if row_arguments == arguments:
            return value
    raise ValueError(f"No se encontró la fila de la función {term['name']}")


def _atomic_text(
    node: dict[str, Any], environment: dict[str, str], interpretation: dict[str, Any]
) -> str:
    raw = to_string(node, environment)
    values = [_term(argument, environment, interpretation) for argument in node["args"]]
    evaluated = f"{node['name']}({', '.join(values)})"
    return f"{raw} = {evaluated}" if raw != evaluated else raw


def _evaluate(
    node: dict[str, Any],
    environment: dict[str, str],
    interpretation: dict[str, Any],
) -> tuple[bool, dict[str, Any]]:
    node_type = node["type"]
    if node_type == "pred":
        values = [_term(argument, environment, interpretation) for argument in node["args"]]
        result = values in interpretation.get("predicates", {}).get(node["name"], [])
        return result, {
            "node": "pred",
            "value": result,
            "kind": "atomic",
            "span": node["span"],
            "text": _atomic_text(node, environment, interpretation),
            "children": [],
        }

    if node_type == "not":
        value, child = _evaluate(node["body"], environment, interpretation)
        return not value, {
            "node": "not",
            "value": not value,
            "kind": "connective",
            "span": node["span"],
            "text": to_string(node, environment),
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
            "text": to_string(node, environment),
            "children": children,
        }

    if node_type in {"forall", "exists"}:
        checked: list[dict[str, Any]] = []
        decisive: dict[str, str] | None = None
        selected_trace: dict[str, Any] | None = None
        result = node_type == "forall"
        for element in interpretation["domain"]:
            scoped = {**environment, node["var"]: element}
            current, current_trace = _evaluate(node["body"], scoped, interpretation)
            checked.append({node["var"]: element, "value": current})
            if (node_type == "exists" and current) or (
                node_type == "forall" and not current
            ):
                result = current if node_type == "exists" else False
                decisive = {node["var"]: element}
                selected_trace = current_trace
                break

        if node_type == "exists":
            kind = "witness" if result else "full_check"
        else:
            kind = "counterexample" if not result else "full_check"
        trace: dict[str, Any] = {
            "node": node_type,
            "value": result,
            "kind": kind,
            "span": node["span"],
            "text": to_string(node, environment),
            "var": node["var"],
            "checked": checked,
            "children": [selected_trace] if selected_trace else [],
        }
        if decisive:
            trace["decisive"] = decisive
        return result, trace

    raise ValueError(f"Nodo AST desconocido: {node_type}")


def evaluate(
    ast: dict[str, Any],
    language_or_interpretation: dict[str, Any],
    interpretation: dict[str, Any] | None = None,
    environment: dict[str, str] | None = None,
) -> tuple[bool, dict[str, Any]]:
    """Evalúa un AST.

    Acepta tanto ``evaluate(ast, interpretation, environment)`` como la firma
    acordada ``evaluate(ast, language, interpretation, environment)``.
    """
    if interpretation is None:
        interpretation = language_or_interpretation
        environment = environment or {}
    elif "domain" in language_or_interpretation and "domain" not in interpretation:
        # Compatibilidad con la forma histórica evaluate(ast, interpretation, env).
        environment = interpretation
        interpretation = language_or_interpretation
    return _evaluate(ast, environment or {}, interpretation)
