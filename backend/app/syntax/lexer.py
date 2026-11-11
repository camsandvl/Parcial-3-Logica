"""Lexer: convierte el texto de la fórmula en tokens con su posición.

Acepta los símbolos Unicode y sus equivalentes ASCII (REPARTO.md, sección 3.3).
Cada token guarda `start` y `end` (fin exclusivo) en caracteres del texto original,
que es lo que después se usa para los `span` del AST y de los errores.
"""

from __future__ import annotations

from dataclasses import dataclass

from .errors import SyntaxFailure

# Tipos de token
NOT, AND, OR, IMPLIES, IFF = "NOT", "AND", "OR", "IMPLIES", "IFF"
FORALL, EXISTS = "FORALL", "EXISTS"
LPAREN, RPAREN, COMMA = "LPAREN", "RPAREN", "COMMA"
IDENT, EOF = "IDENT", "EOF"

# Se prueban en este orden: los de varios caracteres primero ("<->" antes que "->").
SYMBOLS: list[tuple[str, str]] = [
    ("<->", IFF), ("->", IMPLIES), ("\\A", FORALL), ("\\E", EXISTS),
    ("¬", NOT), ("~", NOT),
    ("∧", AND), ("&", AND),
    ("∨", OR), ("|", OR),
    ("→", IMPLIES), ("↔", IFF),
    ("∀", FORALL), ("∃", EXISTS),
    ("(", LPAREN), (")", RPAREN), (",", COMMA),
]

# Pistas para caracteres sueltos que casi forman un símbolo válido.
HINTS = {
    "-": "¿quisiste escribir -> ?",
    "<": "¿quisiste escribir <-> ?",
    "=": "la igualdad no forma parte del lenguaje",
    "\\": "solo se aceptan \\A (∀) y \\E (∃)",
}

DESCRIPTION = {
    NOT: "¬", AND: "∧", OR: "∨", IMPLIES: "→", IFF: "↔", FORALL: "∀", EXISTS: "∃",
    LPAREN: "(", RPAREN: ")", COMMA: ",", EOF: "el final de la fórmula",
}


@dataclass(frozen=True)
class Token:
    kind: str
    text: str
    start: int
    end: int

    def describe(self) -> str:
        if self.kind == IDENT:
            return f"«{self.text}»"
        return f"«{DESCRIPTION[self.kind]}»" if self.kind != EOF else DESCRIPTION[EOF]


def _is_ident_start(char: str) -> bool:
    return char.isascii() and char.isalpha()


def _is_ident_part(char: str) -> bool:
    return char.isascii() and (char.isalnum() or char == "_")


def tokenize(text: str) -> list[Token]:
    """Lista de tokens terminada en EOF. Lanza SyntaxFailure ante un carácter desconocido."""
    tokens: list[Token] = []
    i, n = 0, len(text)
    while i < n:
        char = text[i]
        if char.isspace():
            i += 1
            continue
        if _is_ident_start(char):
            j = i + 1
            while j < n and _is_ident_part(text[j]):
                j += 1
            tokens.append(Token(IDENT, text[i:j], i, j))
            i = j
            continue
        for symbol, kind in SYMBOLS:
            if text.startswith(symbol, i):
                tokens.append(Token(kind, symbol, i, i + len(symbol)))
                i += len(symbol)
                break
        else:
            hint = HINTS.get(char)
            message = f"Símbolo desconocido «{char}»" + (f": {hint}" if hint else "")
            raise SyntaxFailure(message, (i, i + 1))
    tokens.append(Token(EOF, "", n, n))
    return tokens
