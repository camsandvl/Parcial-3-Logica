"""Parser de descenso recursivo para fórmulas de primer orden.

Gramática (de menor a mayor precedencia, REPARTO.md sección 3.3):

    formula  := implies ( "↔" implies )*          ↔ asocia a la izquierda
    implies  := or ( "→" implies )?                → asocia a la DERECHA
    or       := and ( "∨" and )*                   ∨ asocia a la izquierda
    and      := unary ( "∧" unary )*               ∧ asocia a la izquierda
    unary    := "¬" unary
              | ("∀" | "∃") VAR unary              el cuantificador liga SOLO la fórmula inmediata
              | primary
    primary  := "(" formula ")" | atom
    atom     := PRED [ "(" term ("," term)* ")" ]
    term     := VAR | FUNC [ "(" term ("," term)* ")" ]

Cada nivel llama al siguiente más fuerte, así la precedencia sale de la propia
estructura de llamadas. Por eso `∀x P(x) → Q(x)` se lee `(∀x P(x)) → Q(x)`:
`unary` consume `∀x` y luego UNA sola `unary` (el átomo `P(x)`); el `→` lo recoge
`implies`, que está más arriba.

Cada función devuelve `(nodo, inicio, fin)`: el nodo con su `span` y la extensión
real en el texto. Las dos coinciden salvo en una subfórmula entre paréntesis, cuyo
`span` cubre solo lo de adentro (contrato 3.4) pero cuya extensión incluye `(` y `)`.

Errores:
- SYNTAX_ERROR detiene el análisis (ya no se sabe cómo seguir leyendo).
- UNKNOWN_SYMBOL y ARITY_MISMATCH se acumulan y el análisis continúa, para
  devolver todos los errores de símbolos de una vez.
"""

from __future__ import annotations

from typing import Any

from . import lexer as lx
from .errors import SyntaxFailure, formula_error
from .language import VARIABLE_RE, is_variable_name, symbol_tables, validate_language

Node = dict[str, Any]
Parsed = tuple[Node, int, int]

BINARY = {lx.AND: "and", lx.OR: "or", lx.IMPLIES: "implies", lx.IFF: "iff"}
STARTS_FORMULA = {lx.NOT, lx.FORALL, lx.EXISTS, lx.LPAREN, lx.IDENT}


def _plural(count: int) -> str:
    return f"{count} argumento" if count == 1 else f"{count} argumentos"


class Parser:
    def __init__(self, text: str, language: dict) -> None:
        self.text = text
        self.tokens = lx.tokenize(text)
        self.pos = 0
        self.functions, self.predicates = symbol_tables(language)
        self.errors: list[dict[str, Any]] = []

    # ---------- utilidades ----------
    @property
    def current(self) -> lx.Token:
        return self.tokens[self.pos]

    @property
    def previous(self) -> lx.Token | None:
        return self.tokens[self.pos - 1] if self.pos > 0 else None

    def advance(self) -> lx.Token:
        token = self.tokens[self.pos]
        if token.kind != lx.EOF:
            self.pos += 1
        return token

    def fail(self, message: str, token: lx.Token | None = None) -> SyntaxFailure:
        token = token or self.current
        return SyntaxFailure(message, (token.start, token.end))

    def expected_formula(self) -> SyntaxFailure:
        """Error cuando falta un operando: explica qué había antes o qué apareció."""
        token, prev = self.current, self.previous
        if token.kind == lx.EOF and prev is None:
            return self.fail("La fórmula está vacía")
        if token.kind == lx.EOF:
            return self.fail(f"Falta una fórmula después de {prev.describe()}")
        if token.kind in BINARY:
            where = f"antes de {token.describe()}" if prev is None or prev.kind == lx.LPAREN \
                else f"entre {prev.describe()} y {token.describe()}"
            return self.fail(f"Falta una fórmula {where}")
        if token.kind == lx.RPAREN:
            if prev is not None and prev.kind == lx.LPAREN:
                return self.fail("Los paréntesis están vacíos: falta una fórmula adentro")
            if prev is None:
                return self.fail("Paréntesis de cierre sin abrir")
            return self.fail(f"Falta una fórmula después de {prev.describe()}")
        return self.fail(f"Se esperaba una fórmula y apareció {token.describe()}")

    # ---------- fórmulas ----------
    def parse(self) -> Node:
        node, _, _ = self.formula()
        token = self.current
        if token.kind != lx.EOF:
            if token.kind == lx.RPAREN:
                raise self.fail("Paréntesis de cierre sin abrir")
            if token.kind == lx.COMMA:
                raise self.fail("La coma solo separa argumentos dentro de P(…) o f(…)")
            raise self.fail(f"Falta un conectivo (∧, ∨, →, ↔) antes de {token.describe()}")
        return node

    def _binary(self, node_type: str, left: Parsed, right: Parsed) -> Parsed:
        start, end = left[1], right[2]
        return {"type": node_type, "left": left[0], "right": right[0], "span": [start, end]}, start, end

    def formula(self) -> Parsed:  # ↔, izquierda
        left = self.implies()
        while self.current.kind == lx.IFF:
            self.advance()
            left = self._binary("iff", left, self.implies())
        return left

    def implies(self) -> Parsed:  # →, derecha
        left = self.disjunction()
        if self.current.kind == lx.IMPLIES:
            self.advance()
            return self._binary("implies", left, self.implies())
        return left

    def disjunction(self) -> Parsed:  # ∨, izquierda
        left = self.conjunction()
        while self.current.kind == lx.OR:
            self.advance()
            left = self._binary("or", left, self.conjunction())
        return left

    def conjunction(self) -> Parsed:  # ∧, izquierda
        left = self.unary()
        while self.current.kind == lx.AND:
            self.advance()
            left = self._binary("and", left, self.unary())
        return left

    def unary(self) -> Parsed:
        token = self.current
        if token.kind == lx.NOT:
            self.advance()
            body, _, end = self.unary()
            return {"type": "not", "body": body, "span": [token.start, end]}, token.start, end
        if token.kind in (lx.FORALL, lx.EXISTS):
            self.advance()
            var = self.quantified_variable(token)
            body, _, end = self.unary()
            node_type = "forall" if token.kind == lx.FORALL else "exists"
            return {"type": node_type, "var": var, "body": body, "span": [token.start, end]}, token.start, end
        return self.primary()

    def quantified_variable(self, quantifier: lx.Token) -> str:
        token = self.current
        symbol = lx.DESCRIPTION[quantifier.kind]
        if token.kind == lx.IDENT:
            if is_variable_name(token.text):
                self.advance()
                return token.text
            # Permite escribir ∀xP(x) sin espacio: separa la variable del resto del identificador.
            match = VARIABLE_RE.match(token.text)
            if match:
                var = match.group(0)
                cut = token.start + len(var)
                self.tokens[self.pos] = lx.Token(lx.IDENT, token.text[len(var):], cut, token.end)
                return var
        raise self.fail(f"Después de {symbol} va una variable (x, y, z, w…) y apareció {token.describe()}")

    def primary(self) -> Parsed:
        token = self.current
        if token.kind == lx.LPAREN:
            self.advance()
            node, _, _ = self.formula()
            closing = self.current
            if closing.kind != lx.RPAREN:
                if closing.kind == lx.EOF:
                    raise self.fail("Este paréntesis nunca se cierra", token)
                if closing.kind == lx.COMMA:
                    raise self.fail("La coma solo separa argumentos dentro de P(…) o f(…)")
                raise self.fail(f"Se esperaba «)» o un conectivo y apareció {closing.describe()}")
            self.advance()
            # El span del nodo queda sin paréntesis; la extensión sí los incluye.
            return node, token.start, closing.end
        if token.kind == lx.IDENT:
            return self.atom()
        raise self.expected_formula()

    def atom(self) -> Parsed:
        name_token = self.advance()
        name = name_token.text
        if is_variable_name(name):
            raise self.fail(
                f"«{name}» es una variable; aquí se esperaba una fórmula, por ejemplo P({name})",
                name_token,
            )
        args, end, _ = self.arguments(name_token)
        span = [name_token.start, end]

        if name in self.predicates:
            arity = self.predicates[name]
            if len(args) != arity:
                self.errors.append(formula_error(
                    "ARITY_MISMATCH",
                    f"{name} espera {_plural(arity)} y recibió {len(args)}",
                    span,
                ))
        elif name in self.functions:
            self.errors.append(formula_error(
                "UNKNOWN_SYMBOL",
                f"«{name}» es una función, no un predicado: no tiene valor de verdad por sí sola",
                span,
            ))
        else:
            self.errors.append(formula_error(
                "UNKNOWN_SYMBOL", f"El predicado «{name}» no está declarado en el lenguaje", span
            ))
        return {"type": "pred", "name": name, "args": args, "span": span}, span[0], span[1]

    # ---------- términos ----------
    def arguments(self, name_token: lx.Token) -> tuple[list[Node], int, bool]:
        """Lee `( t1, …, tn )` si viene. Devuelve (argumentos, fin, ¿había paréntesis?)."""
        if self.current.kind != lx.LPAREN:
            return [], name_token.end, False
        opening = self.advance()
        args: list[Node] = []
        if self.current.kind == lx.RPAREN:
            return args, self.advance().end, True
        while True:
            args.append(self.term())
            token = self.current
            if token.kind == lx.COMMA:
                self.advance()
                continue
            if token.kind == lx.RPAREN:
                return args, self.advance().end, True
            if token.kind == lx.EOF:
                raise self.fail(f"Falta cerrar el paréntesis de {name_token.text}(…)", opening)
            raise self.fail(f"Se esperaba «,» o «)» y apareció {token.describe()}")

    def term(self) -> Node:
        token = self.current
        if token.kind != lx.IDENT:
            if token.kind in (lx.COMMA, lx.RPAREN):
                raise self.fail("Falta un argumento: se esperaba una variable, constante o función")
            if token.kind == lx.EOF:
                raise self.fail(f"Falta un argumento después de {self.previous.describe()}")
            raise self.fail(
                f"{token.describe()} no puede ir dentro de los argumentos: solo variables, constantes o funciones"
            )
        self.advance()
        name = token.text
        if is_variable_name(name):
            if self.current.kind == lx.LPAREN:
                raise self.fail(f"La variable «{name}» no lleva argumentos")
            return {"type": "var", "name": name, "span": [token.start, token.end]}

        args, end, had_parens = self.arguments(token)
        span = [token.start, end]
        if name in self.functions:
            arity = self.functions[name]
            if arity == 0 and had_parens:
                self.errors.append(formula_error(
                    "ARITY_MISMATCH", f"«{name}» es una constante y se escribe sin paréntesis", span
                ))
            elif len(args) != arity:
                self.errors.append(formula_error(
                    "ARITY_MISMATCH", f"{name} espera {_plural(arity)} y recibió {len(args)}", span
                ))
        elif name in self.predicates:
            self.errors.append(formula_error(
                "UNKNOWN_SYMBOL",
                f"«{name}» es un predicado: dentro de un argumento solo van variables, constantes o funciones",
                span,
            ))
        else:
            self.errors.append(formula_error(
                "UNKNOWN_SYMBOL", f"La función o constante «{name}» no está declarada en el lenguaje", span
            ))
        return {"type": "func", "name": name, "args": args, "span": span}


def parse_ast(formula: str, language: dict) -> tuple[Node | None, list[dict[str, Any]]]:
    """AST y errores de fórmula (sin validar el lenguaje)."""
    try:
        parser = Parser(formula, language)
        ast = parser.parse()
    except SyntaxFailure as failure:
        return None, [failure.error]
    return (None, parser.errors) if parser.errors else (ast, [])


def parse(formula: str, language: dict) -> dict:
    """{'ok': True, 'ast': {...}, 'freeVars': [...]} o {'ok': False, 'errors': [...]}."""
    from .free_vars import free_vars

    language_errors = validate_language(language)
    if language_errors:
        return {"ok": False, "errors": language_errors}
    if not isinstance(formula, str):
        return {"ok": False, "errors": [formula_error("SYNTAX_ERROR", "La fórmula debe ser texto", (0, 0))]}
    ast, errors = parse_ast(formula, language)
    if errors:
        return {"ok": False, "errors": errors}
    return {"ok": True, "ast": ast, "freeVars": free_vars(ast)}
