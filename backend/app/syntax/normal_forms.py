"""Aporte opcional: forma normal negativa (NNF) y forma prenexa.

Ambas transformaciones producen una fórmula LÓGICAMENTE EQUIVALENTE: en toda interpretación
y con todo entorno tienen el mismo valor de verdad que la original. Las pruebas lo verifican
evaluando las dos versiones sobre muchas interpretaciones.

NNF (¬ solo delante de átomos, sin → ni ↔):
    φ → ψ   ≡  ¬φ ∨ ψ
    φ ↔ ψ   ≡  (¬φ ∨ ψ) ∧ (φ ∨ ¬ψ)
    ¬¬φ     ≡  φ
    ¬(φ ∧ ψ) ≡ ¬φ ∨ ¬ψ          ¬(φ ∨ ψ) ≡ ¬φ ∧ ¬ψ        (De Morgan)
    ¬∀x φ   ≡  ∃x ¬φ            ¬∃x φ    ≡ ∀x ¬φ

Prenexa (todos los cuantificadores al frente, partiendo de la NNF):
    (Qx φ) ∘ ψ ≡ Qx (φ ∘ ψ)   y   ψ ∘ (Qx φ) ≡ Qx (ψ ∘ φ)   para ∘ ∈ {∧, ∨},
    siempre que x no sea libre en ψ. Para garantizarlo, antes se renombran las variables
    ligadas que chocan (`P(x) ∧ ∀x Q(x)` pasa a `∀x1(P(x) ∧ Q(x1))`).
    Esto usa que el dominio no es vacío, cosa que el programa ya exige.

Los nodos nuevos heredan el `span` del nodo original del que salen, así el frontend
puede seguir señalando de qué parte de la fórmula viene cada pieza.
"""

from __future__ import annotations

from typing import Any

from .free_vars import free_vars

Node = dict[str, Any]
DUAL = {"and": "or", "or": "and", "forall": "exists", "exists": "forall"}


def _not(body: Node, span: list[int]) -> Node:
    return {"type": "not", "body": body, "span": list(span)}


def _bin(node_type: str, left: Node, right: Node, span: list[int]) -> Node:
    return {"type": node_type, "left": left, "right": right, "span": list(span)}


def _nnf(node: Node, negated: bool) -> Node:
    node_type, span = node["type"], node["span"]
    if node_type == "pred":
        return _not(node, span) if negated else node
    if node_type == "not":
        return _nnf(node["body"], not negated)
    if node_type in ("and", "or"):
        result_type = DUAL[node_type] if negated else node_type
        return _bin(result_type, _nnf(node["left"], negated), _nnf(node["right"], negated), span)
    if node_type == "implies":  # φ → ψ ≡ ¬φ ∨ ψ
        rewritten = _bin("or", _not(node["left"], node["left"]["span"]), node["right"], span)
        return _nnf(rewritten, negated)
    if node_type == "iff":  # (¬φ ∨ ψ) ∧ (φ ∨ ¬ψ)
        left, right = node["left"], node["right"]
        rewritten = _bin(
            "and",
            _bin("or", _not(left, left["span"]), right, span),
            _bin("or", left, _not(right, right["span"]), span),
            span,
        )
        return _nnf(rewritten, negated)
    if node_type in ("forall", "exists"):
        result_type = DUAL[node_type] if negated else node_type
        return {"type": result_type, "var": node["var"], "body": _nnf(node["body"], negated), "span": list(span)}
    raise ValueError(f"Nodo AST desconocido: {node_type}")


def to_nnf(ast: dict) -> dict:
    """Forma normal negativa equivalente."""
    return _nnf(ast, False)


# ---------- prenexa ----------
def _all_var_names(node: Node, out: set[str]) -> None:
    if node["type"] == "var":
        out.add(node["name"])
    if node["type"] in ("forall", "exists"):
        out.add(node["var"])
    for child in node.get("args", []):
        _all_var_names(child, out)
    for key in ("body", "left", "right"):
        if key in node:
            _all_var_names(node[key], out)


def _fresh(base: str, taken: set[str]) -> str:
    """Primer nombre x1, x2… (con la letra de `base`) que no aparece en ningún lado."""
    letter = base[0]
    index = 1
    while f"{letter}{index}" in taken:
        index += 1
    name = f"{letter}{index}"
    taken.add(name)
    return name


def _rename(node: Node, mapping: dict[str, str]) -> Node:
    """Copia el nodo aplicando el renombre solo a ocurrencias libres."""
    node_type = node["type"]
    if node_type == "var":
        return {**node, "name": mapping.get(node["name"], node["name"])}
    if node_type in ("func", "pred"):
        return {**node, "args": [_rename(arg, mapping) for arg in node["args"]]}
    if node_type == "not":
        return {**node, "body": _rename(node["body"], mapping)}
    if node_type in ("and", "or", "implies", "iff"):
        return {**node, "left": _rename(node["left"], mapping), "right": _rename(node["right"], mapping)}
    inner = {key: value for key, value in mapping.items() if key != node["var"]}
    return {**node, "body": _rename(node["body"], inner)}


def _standardize(node: Node, used: set[str], taken: set[str]) -> Node:
    """Hace que cada cuantificador ligue una variable propia, que no es libre en ningún lado.

    `used`: variables libres de toda la fórmula más las ya ligadas por otro cuantificador.
    `taken`: todos los nombres de variable que aparecen, para que los nuevos no choquen.
    """
    node_type = node["type"]
    if node_type in ("forall", "exists"):
        var, body = node["var"], node["body"]
        if var in used:
            new = _fresh(var, taken)
            body = _rename(body, {var: new})
            var = new
        used.add(var)
        return {**node, "var": var, "body": _standardize(body, used, taken)}
    if node_type == "not":
        return {**node, "body": _standardize(node["body"], used, taken)}
    if node_type in ("and", "or"):
        left = _standardize(node["left"], used, taken)
        return {**node, "left": left, "right": _standardize(node["right"], used, taken)}
    return node


def _pull(node: Node) -> tuple[list[tuple[str, str, list[int]]], Node]:
    node_type = node["type"]
    if node_type in ("forall", "exists"):
        prefix, matrix = _pull(node["body"])
        return [(node_type, node["var"], node["span"])] + prefix, matrix
    if node_type in ("and", "or"):
        left_prefix, left = _pull(node["left"])
        right_prefix, right = _pull(node["right"])
        return left_prefix + right_prefix, {**node, "left": left, "right": right}
    return [], node  # átomo o negación de átomo (estamos en NNF)


def to_prenex(ast: dict) -> dict:
    """Forma prenexa equivalente: cuantificadores al frente y una matriz sin cuantificadores."""
    nnf = to_nnf(ast)
    taken: set[str] = set()
    _all_var_names(nnf, taken)
    standardized = _standardize(nnf, set(free_vars(nnf)), taken)
    prefix, matrix = _pull(standardized)
    for node_type, var, span in reversed(prefix):
        matrix = {"type": node_type, "var": var, "body": matrix, "span": list(span)}
    return matrix
