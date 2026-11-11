"""Variables libres de una fórmula o término.

Definición recursiva:
- FV(x) = {x};  FV(f(t1,…,tn)) = FV(t1) ∪ … ∪ FV(tn);  igual para P(t1,…,tn).
- FV(¬φ) = FV(φ);  FV(φ ∘ ψ) = FV(φ) ∪ FV(ψ) para ∧, ∨, →, ↔.
- FV(∀x φ) = FV(∃x φ) = FV(φ) − {x}.

Una variable puede ser libre en un lugar y ligada en otro: en `P(x) ∧ ∀x Q(x)` la x de
P(x) es libre (la de Q(x) no), así que x ∈ FV y la fórmula necesita un valor para x.
"""

from __future__ import annotations

from typing import Any


def _collect(node: dict[str, Any], bound: frozenset[str], out: set[str]) -> None:
    node_type = node["type"]
    if node_type == "var":
        if node["name"] not in bound:
            out.add(node["name"])
    elif node_type in ("func", "pred"):
        for arg in node.get("args", []):
            _collect(arg, bound, out)
    elif node_type == "not":
        _collect(node["body"], bound, out)
    elif node_type in ("and", "or", "implies", "iff"):
        _collect(node["left"], bound, out)
        _collect(node["right"], bound, out)
    elif node_type in ("forall", "exists"):
        _collect(node["body"], bound | {node["var"]}, out)
    else:
        raise ValueError(f"Nodo AST desconocido: {node_type}")


def free_vars(ast: dict) -> list[str]:
    """Variables libres, ordenadas alfabéticamente y sin repetir."""
    out: set[str] = set()
    _collect(ast, frozenset(), out)
    return sorted(out)
