"""Impresión de AST a texto con símbolos Unicode y paréntesis mínimos.

Reglas de paréntesis (las mismas precedencias que usa el parser):
- Un hijo de un conectivo binario lleva paréntesis si su operador liga MENOS que el del padre.
- Si liga igual, depende de la asociatividad: ∧, ∨ y ↔ asocian a la izquierda, así que el
  hijo derecho del mismo operador lleva paréntesis (`p ∧ (q ∧ r)`); → asocia a la derecha,
  así que es el hijo izquierdo el que los lleva (`(p → q) → r`).
- ¬ y los cuantificadores ligan solo la fórmula inmediata: si su cuerpo es binario, va
  entre paréntesis (`¬(p ∧ q)`, `∀x(P(x) → Q(x))`). Nunca necesitan paréntesis como hijos.

Formato: `∀x P(x)` (espacio antes de un cuerpo sin paréntesis), `∀x(P(x) → Q(x))`,
conectivos binarios rodeados de espacios. Los argumentos se separan con «,» cuando todos son
simples (`R(x,y)`) y con «, » si alguno es una función con argumentos (`R(x, f(x))`), igual
que en los fixtures de contracts/.

Con `subst`, las variables LIBRES se reemplazan por su elemento: dentro de `∀x …` la x está
ligada y no se toca, aunque `subst` tenga un valor para x.
"""

from __future__ import annotations

from typing import Any

PRECEDENCE = {"iff": 1, "implies": 2, "or": 3, "and": 4}
UNARY_PRECEDENCE = 5
SYMBOL = {"iff": "↔", "implies": "→", "or": "∨", "and": "∧", "forall": "∀", "exists": "∃"}
RIGHT_ASSOCIATIVE = {"implies"}


def _precedence(node: dict[str, Any]) -> int:
    return PRECEDENCE.get(node["type"], UNARY_PRECEDENCE)


def _term(term: dict[str, Any], subst: dict[str, str], bound: frozenset[str]) -> str:
    if term["type"] == "var":
        name = term["name"]
        return str(subst[name]) if name in subst and name not in bound else name
    if not term.get("args"):
        return term["name"]
    return f"{term['name']}({_arguments(term['args'], subst, bound)})"


def _arguments(args: list[dict[str, Any]], subst: dict[str, str], bound: frozenset[str]) -> str:
    compound = any(arg["type"] == "func" and arg.get("args") for arg in args)
    return (", " if compound else ",").join(_term(arg, subst, bound) for arg in args)


def _formula(node: dict[str, Any], subst: dict[str, str], bound: frozenset[str]) -> str:
    node_type = node["type"]
    if node_type == "pred":
        if not node.get("args"):
            return node["name"]
        return f"{node['name']}({_arguments(node['args'], subst, bound)})"

    if node_type == "not":
        body = node["body"]
        text = _formula(body, subst, bound)
        return f"¬({text})" if body["type"] in PRECEDENCE else f"¬{text}"

    if node_type in ("forall", "exists"):
        body = node["body"]
        text = _formula(body, subst, bound | {node["var"]})
        head = f"{SYMBOL[node_type]}{node['var']}"
        return f"{head}({text})" if body["type"] in PRECEDENCE else f"{head} {text}"

    if node_type in PRECEDENCE:
        own = PRECEDENCE[node_type]
        left, right = node["left"], node["right"]
        left_text = _formula(left, subst, bound)
        right_text = _formula(right, subst, bound)
        right_assoc = node_type in RIGHT_ASSOCIATIVE
        if _precedence(left) < own or (_precedence(left) == own and right_assoc):
            left_text = f"({left_text})"
        if _precedence(right) < own or (_precedence(right) == own and not right_assoc):
            right_text = f"({right_text})"
        return f"{left_text} {SYMBOL[node_type]} {right_text}"

    if node_type in ("var", "func"):
        return _term(node, subst, bound)
    raise ValueError(f"Nodo AST desconocido: {node_type}")


def to_string(ast: dict, subst: dict[str, str] | None = None) -> str:
    """Imprime la fórmula o el término con símbolos Unicode; si se pasa subst, reemplaza
    esas variables (solo donde están libres) por su elemento. Paréntesis mínimos y legibles."""
    return _formula(ast, subst or {}, frozenset())
