"""Sintaxis de la Máquina de Turing: lenguaje, lexer, parser, variables libres e impresión.

Funciones públicas (firmas acordadas en REPARTO.md, sección 4.2):
    validate_language(language) -> list[dict]
    parse(formula, language)    -> dict
    free_vars(ast)              -> list[str]
    to_string(ast, subst=None)  -> str
Aportes opcionales: godel_number, decode_godel, godel_numbers, to_nnf, to_prenex.
"""

from .free_vars import free_vars
from .godel import decode_godel, godel_number, godel_numbers
from .language import validate_language
from .normal_forms import to_nnf, to_prenex
from .parser import parse
from .printer import to_string
from .router import router

__all__ = [
    "validate_language",
    "parse",
    "free_vars",
    "to_string",
    "router",
    "godel_number",
    "decode_godel",
    "godel_numbers",
    "to_nnf",
    "to_prenex",
]
