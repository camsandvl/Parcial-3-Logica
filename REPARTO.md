# Reparto del proyecto: La Máquina de Turing

Este documento dice **qué hace cada quien, con qué formatos y cuándo está terminado**. Cada parte se puede hacer sin esperar a las demás. Si algo no está aquí, se pregunta en el grupo antes de inventarlo.

| Miembro | Parte | Carpeta propia | Puntos de la rúbrica que carga |
|---|---|---|---|
| **Camila** | Frontend, diseño y escenas del juego | `frontend/` | Interfaz gráfica (10) y la mayor parte de los aportes creativos |
| **Emily** | Sintaxis: lenguaje, lexer, parser, variables libres | `backend/app/syntax/` | Análisis sintáctico (10) |
| **Ale** | Semántica: validación de la interpretación, evaluador, justificación, base de datos y API | `backend/app/semantics/`, `backend/app/db/`, `backend/app/main.py` | Evaluación semántica y justificación (30) |
| **Los tres** | Contratos, pruebas de punta a punta y defensa | `contracts/`, `docs/` | Defensa individual (30) y aportes creativos (20) |

> **Regla de oro:** nadie edita la carpeta de otra persona. Lo único compartido es `contracts/`, y un cambio ahí necesita el visto bueno de los tres.

---

## 1. Cómo sacamos 100

La nota máxima depende del ticket: **80 sin ticket, 90 con plata y 100 con oro**. El ticket lo da la votación de la clase, pero solo pone un tope: los puntos salen de cumplir los requerimientos. Necesitamos las dos cosas.

| Rubro | Puntos | Qué tenemos que demostrar |
|---|---|---|
| Evaluación semántica y justificación | 30 | Veredicto correcto en todos los casos, con testigo, contraejemplo o comprobación completa según corresponda (req. 6) |
| Análisis sintáctico | 10 | Todos los conectivos y cuantificadores, precedencias claras, errores con posición exacta (req. 3, 4, 7) |
| Interfaz gráfica | 10 | Ingreso gráfico de todo, botones ¬ ∧ ∨ → ∀ ∃ ( ) y edición con teclado (req. 5) |
| Defensa individual | 30 | **Cada quien** explica cualquier parte del programa, no solo la suya |
| Aportes creativos | 20 | Implementados, **probados** y **justificados por escrito** (sección 7) |
| Ticket de oro | tope 100 | Una presentación que gane la votación: el juego visual es nuestra carta fuerte |

---

## 2. Stack y estructura del repositorio

- **Frontend:** React 19 + TypeScript + Vite, Zustand y Framer Motion. Ya existe.
- **Backend:** Python 3.12, FastAPI, pytest, SQLite con SQLAlchemy. Hay que crearlo.
- **Comunicación:** JSON por HTTP. El frontend llama a `/api/*`, y Vite redirige esas llamadas a `http://localhost:8000`.

```
Parcial-3-Logica/
├── REPARTO.md                  ← este documento
├── contracts/                  ← COMPARTIDO (cambios con aprobación de los tres)
│   ├── types.ts                ← definición oficial de todos los formatos
│   └── fixtures/               ← ejemplos JSON reales de entrada y salida
├── frontend/                   ← Camila
├── backend/
│   ├── requirements.txt        ← Ale lo crea; Emily agrega lo que necesite por PR
│   ├── app/
│   │   ├── main.py             ← Ale: crea la app FastAPI e incluye los dos routers
│   │   ├── syntax/             ← Emily
│   │   │   ├── __init__.py     ← exporta las funciones públicas (sección 4.2)
│   │   │   ├── language.py
│   │   │   ├── lexer.py
│   │   │   ├── parser.py
│   │   │   ├── printer.py      ← to_string(ast)
│   │   │   └── router.py       ← endpoints /api/language/validate y /api/parse
│   │   ├── semantics/          ← Ale
│   │   │   ├── interpretation.py
│   │   │   ├── environment.py
│   │   │   ├── evaluator.py
│   │   │   ├── explain.py      ← texto en español a partir de la traza
│   │   │   └── router.py       ← /api/interpretation/validate, /api/evaluate
│   │   └── db/                 ← Ale (historial y escenarios)
│   └── tests/
│       ├── syntax/             ← Emily
│       └── semantics/          ← Ale
└── docs/
    ├── aportes.md              ← justificación de cada aporte creativo
    └── defensa.md              ← preguntas de estudio (sección 8)
```

---

## 3. Contratos compartidos

**La fuente oficial es [contracts/types.ts](contracts/types.ts).** En Python se usan **los mismos nombres de campo, en camelCase** (`freeVars`, no `free_vars`), porque el JSON viaja tal cual. Los ejemplos están en [contracts/fixtures/](contracts/fixtures/).

### 3.1 Lenguaje
```json
{
  "functions":  [{ "name": "f", "arity": 1 }, { "name": "c", "arity": 0 }],
  "predicates": [{ "name": "P", "arity": 1 }, { "name": "R", "arity": 2 }]
}
```
- Una función de **aridad 0 es una constante** y se escribe sin paréntesis: `c`, no `c()`.
- Los predicados tienen **aridad ≥ 1**.
- **Nombre válido:** empieza con letra y sigue con letras, dígitos o `_`. No puede repetirse entre funciones y predicados, ni tener forma de variable (sección 3.3).

### 3.2 Interpretación
```json
{
  "domain": ["1", "2", "3"],
  "functions":  { "f": [[["1"], "2"], [["2"], "3"], [["3"], "1"]], "c": [[[], "1"]] },
  "predicates": { "P": [["1"], ["3"]], "R": [["1", "2"], ["2", "3"]] }
}
```
- Los elementos del dominio son **strings** no vacíos y sin repetir.
- **Función:** una lista de filas `[argumentos, valor]` que cubre **las |D|ⁿ tuplas**, con cada valor dentro de D. Una constante tiene exactamente una fila `[[], valor]`.
- **Predicado:** la lista de tuplas donde es verdadero. **No puede estar vacía**, como pide el req. 2.

### 3.3 Fórmulas (texto que escribe el usuario)
| Elemento | Símbolos aceptados | Notas |
|---|---|---|
| Negación | `¬` o `~` | |
| Conjunción | `∧` o `&` | |
| Disyunción | `∨` o `\|` | |
| Implicación | `→` o `->` | asociativa a la **derecha**: `p → q → r` = `p → (q → r)` |
| Bicondicional | `↔` o `<->` | |
| Cuantificadores | `∀` y `∃` | el frontend convierte `\A` y `\E` antes de enviar |
| Variables | `x`, `y`, `z`, `w`, con dígitos opcionales: `x1`, `y23` | |
| Paréntesis y coma | `(` `)` `,` | |

**Precedencia, de mayor a menor:** `¬` y cuantificadores > `∧` > `∨` > `→` > `↔`.
- **Alcance de un cuantificador:** liga la fórmula **inmediatamente siguiente** (un átomo, una negación, otro cuantificador o algo entre paréntesis). Por eso `∀x P(x) → Q(x)` se lee `(∀x P(x)) → Q(x)`, y para abarcar más se usan paréntesis: `∀x(P(x) → Q(x))`.
- `∧`, `∨` y `↔` asocian a la izquierda.
- Los espacios se ignoran.

### 3.4 AST (lo que devuelve el parser)
Todo nodo lleva `span: [inicio, fin]`, con posiciones de caracteres en el texto original (fin exclusivo). El ejemplo corresponde a `∀x(P(x) → ∃y R(x,y))`. En una subfórmula entre paréntesis, el `span` cubre lo de adentro, sin los paréntesis.
```json
{ "type": "forall", "var": "x", "span": [0, 20],
  "body": { "type": "implies", "span": [3, 19],
    "left":  { "type": "pred", "name": "P", "args": [{ "type": "var", "name": "x", "span": [5, 6] }], "span": [3, 7] },
    "right": { "type": "exists", "var": "y", "span": [10, 19],
      "body": { "type": "pred", "name": "R", "span": [13, 19], "args": [
        { "type": "var", "name": "x", "span": [15, 16] }, { "type": "var", "name": "y", "span": [17, 18] } ] } } } }
```
| `type` | Campos |
|---|---|
| `var` | `name` |
| `func` | `name`, `args` (lista de términos; vacía si es constante) |
| `pred` | `name`, `args` |
| `not` | `body` |
| `and`, `or`, `implies`, `iff` | `left`, `right` |
| `forall`, `exists` | `var`, `body` |

### 3.5 Errores
Cualquier respuesta con error tiene esta forma, y **nunca trae valor de verdad**:
```json
{ "ok": false, "errors": [
  { "code": "ARITY_MISMATCH", "stage": "syntax", "message": "R espera 2 argumentos y recibió 1", "span": [12, 16], "path": "formula" } ] }
```
- `message` va en español y lo lee el usuario final.
- `span` va solo en errores de la fórmula.
- `path` indica dónde está el error: `formula`, `domain`, `functions.f`, `predicates.R[2]`, `environment.x`, `language.functions[1]`.

| Código | `stage` | Cuándo | Responsable |
|---|---|---|---|
| `INVALID_LANGUAGE` | `language` | nombre inválido o repetido, aridad no entera, negativa o 0 en un predicado | Emily |
| `SYNTAX_ERROR` | `syntax` | fórmula vacía, token desconocido, paréntesis sin cerrar, falta un operando | Emily |
| `UNKNOWN_SYMBOL` | `syntax` | se usa `g(x)` y `g` no está declarado | Emily |
| `ARITY_MISMATCH` | `syntax` | número de argumentos distinto a la aridad, o una constante usada con paréntesis | Emily |
| `EMPTY_DOMAIN` | `interpretation` | D vacío | Ale |
| `DUPLICATE_ELEMENT` | `interpretation` | elemento repetido en D | Ale |
| `FUNCTION_INCOMPLETE` | `interpretation` | falta alguna tupla de Dⁿ, o hay una tupla definida dos veces | Ale |
| `FUNCTION_VALUE_OUT_OF_DOMAIN` | `interpretation` | un argumento o un valor no está en D | Ale |
| `EMPTY_RELATION` | `interpretation` | predicado sin tuplas | Ale |
| `TUPLE_OUT_OF_DOMAIN` | `interpretation` | una tupla usa elementos fuera de D | Ale |
| `TUPLE_WRONG_ARITY` | `interpretation` | el tamaño de una tupla no coincide con la aridad | Ale |
| `MISSING_ASSIGNMENT` | `environment` | una variable libre no tiene valor en el entorno | Ale |
| `ASSIGNMENT_OUT_OF_DOMAIN` | `environment` | se asignó un elemento que no está en D | Ale |

Las asignaciones a variables que **no** son libres se ignoran sin error.

### 3.6 Resultado y traza (lo que devuelve `/api/evaluate`)
```json
{ "ok": true, "value": false,
  "summary": "∀x(P(x) → ∃y R(x,y)) es Falso: contraejemplo x = 3",
  "trace": { "node": "forall", "var": "x", "value": false, "kind": "counterexample", "span": [0, 20],
             "text": "∀x(P(x) → ∃y R(x,y))",
             "checked": [{ "x": "1", "value": true }, { "x": "2", "value": true }, { "x": "3", "value": false }],
             "decisive": { "x": "3" },
             "children": [ "…traza del cuerpo con x = 3…" ] } }
```

**Qué lleva la traza según el nodo.** Esto es lo que más pesa en la nota (30 puntos), así que se cumple al pie de la letra:

| Nodo y resultado | `kind` | `checked` | `decisive` | `children` |
|---|---|---|---|---|
| `∃` verdadero | `witness` | los elementos probados hasta encontrar el testigo | el testigo | traza del cuerpo con el testigo |
| `∀` falso | `counterexample` | los elementos probados hasta el contraejemplo | el contraejemplo | traza del cuerpo con el contraejemplo |
| `∀` verdadero | `full_check` | **todos** los elementos de D, todos con `true` | — | `[]` |
| `∃` falso | `full_check` | **todos** los elementos de D, todos con `false` | — | `[]` |
| `¬` | `connective` | — | — | traza del cuerpo |
| `∧` falso / `∨` verdadero | `connective` | — | — | **solo** el primer hijo decisivo (falso / verdadero) |
| `∧` verdadero / `∨` falso | `connective` | — | — | ambos hijos |
| `→` falso | `connective` | — | — | ambos hijos (antecedente V, consecuente F) |
| `→` verdadero | `connective` | — | — | el decisivo: antecedente F **o** consecuente V |
| `↔` | `connective` | — | — | ambos hijos |
| átomo `P(…)` | `atomic` | — | — | `[]` |

- **`text`:** la subfórmula impresa con `to_string` de Emily, **sustituyendo las variables ya fijadas** por su elemento. Por ejemplo, `P(3) → ∃y R(3,y)`. En los átomos se muestra también el cálculo de los términos: `R(1, f(1)) = R(1, 2)`.
- **Orden:** el evaluador recorre D **en el orden en que el usuario lo escribió**, así los resultados son predecibles y se pueden probar.

### 3.7 Endpoints
| Método y ruta | Recibe | Devuelve | Dueña/o |
|---|---|---|---|
| `POST /api/language/validate` | `Language` | `{ok:true}` o error | Emily |
| `POST /api/parse` | `{formula, language}` | `{ok:true, ast, freeVars}` o error | Emily |
| `POST /api/interpretation/validate` | `{language, interpretation}` | `{ok:true}` o error | Ale |
| `POST /api/evaluate` | `{language, interpretation, formula, environment, ast?}` | resultado o error | Ale |
| `GET /api/history` | — | `HistoryEntry[]`, el más reciente primero | Ale |
| `GET /api/scenarios` y `POST /api/scenarios` | `{name, language, interpretation}` | escenarios guardados | Ale |

**Orden de validación dentro de `/api/evaluate`:**
1. Lenguaje
2. Interpretación
3. Fórmula
4. Entorno

En el primer paso que falle se devuelven **todos** sus errores juntos y no se evalúa nada.

---

## 4. Tareas por persona

### 4.1 Camila: frontend (`frontend/`)

**Estado actual:** ya están la escena 1 (Activación, con Turing, la máquina, la palanca y el diálogo), el panel lateral, el teclado lógico, el backend simulado (`mockApi`) y las pantallas básicas de las escenas 2 a 6.

**Cómo trabaja sola:** con `npm run dev` y `VITE_USE_MOCK=true` (ya configurado en `.env.development`) usa respuestas simuladas sacadas de `contracts/fixtures/`. No necesita el backend.

- [ ] **Escena 2, Taller de Gödel:** fichas de símbolos con entradas según la aridad y número de Gödel visible. Gödel reacciona a los errores y al éxito.
- [ ] **Escena 3, Sala de Tarski:**
    - Dominio como fichas.
    - Tabla de cada función generada a partir de Dⁿ.
    - Selector de tuplas para cada predicado.
    - Tarski explica cada parte.
- [ ] **Escena 4, Consola:**
    - Campo de fórmula y teclado lógico con ¬ ∧ ∨ → ↔ ∀ ∃ ( ), más variables y los símbolos del lenguaje.
    - Atajos de teclado.
    - El error de sintaxis se marca con `^` bajo la posición exacta (`span`).
- [ ] **Escena 4b, Entorno:** un selector por cada variable libre. «Procesar» queda deshabilitado mientras falte alguna.
- [ ] **Escena 5, Procesamiento:** animación del recorrido del árbol usando `trace` (sección 3.6).
- [ ] **Escena 6, Informe:**
    - Sello VERDADERO o FALSO.
    - `summary`.
    - Árbol de razones con la fila decisiva resaltada.
    - Tabla completa cuando es `full_check`.
- [ ] Con errores, la máquina queda «bloqueada» y **nunca** muestra veredicto (req. 7).
- [ ] Historial («bitácora») y escenarios guardados (UI).
- [ ] **Integración:** cambiar a `VITE_USE_MOCK=false` y pasar la lista de verificación de la sección 6.

**Terminado cuando:** todo el flujo se completa con el mock y con el backend real, cada código de error de la tabla 3.5 se ve en la pantalla correcta, y `npx tsc -b` no da errores.

### 4.2 Emily: sintaxis (`backend/app/syntax/`)

**Cómo trabaja sola:** son funciones puras de Python, sin base de datos ni dependencia de Ale. Se prueban con `pytest tests/syntax`. Si `main.py` aún no existe, los endpoints se prueban con `TestClient` sobre su propio `router`.

**Funciones públicas que exporta `app/syntax/__init__.py`** (Ale las usa con exactamente estas firmas):
```python
def validate_language(language: dict) -> list[dict]:
    """Errores INVALID_LANGUAGE (lista vacía si es válido)."""

def parse(formula: str, language: dict) -> dict:
    """{'ok': True, 'ast': {...}, 'freeVars': ['x', ...]}  o  {'ok': False, 'errors': [...]}.
    Incluye SYNTAX_ERROR, UNKNOWN_SYMBOL y ARITY_MISMATCH con su span."""

def free_vars(ast: dict) -> list[str]:
    """Variables libres, ordenadas alfabéticamente y sin repetir."""

def to_string(ast: dict, subst: dict[str, str] | None = None) -> str:
    """Imprime la fórmula o el término con símbolos Unicode; si se pasa subst, reemplaza
    esas variables (solo donde están libres) por su elemento. Paréntesis mínimos y legibles."""
```

- [ ] `validate_language` con todas las reglas de la sección 3.1.
- [ ] **Lexer:** Unicode y ASCII (sección 3.3), con la posición de cada token.
- [ ] **Parser de descenso recursivo** con la precedencia y el alcance de la sección 3.3. Construye el AST de la sección 3.4, con `span` en todos los nodos.
- [ ] Revisión de símbolos y aridades contra el lenguaje: un nombre de función usado como predicado, o al revés, da `UNKNOWN_SYMBOL`.
- [ ] `free_vars`: maneja variables ligadas y libres a la vez, como en `P(x) ∧ ∀x Q(x)`, donde x es libre a la izquierda.
- [ ] `to_string` con sustitución.
- [ ] `router.py` con `POST /api/language/validate` y `POST /api/parse`.
- [ ] **Al menos 40 pruebas** en `tests/syntax/`: cada conectivo, la precedencia, la asociatividad de →, el alcance de los cuantificadores, constantes, funciones anidadas como `f(g(x), c)`, cada código de error con su `span`, variables libres y ligadas, y que `to_string(parse(t))` se pueda volver a parsear.
- [ ] *(Aporte opcional)* `godel_number(symbol)` para las fichas y `to_nnf` / `to_prenex` para el modo «forma normal» (sección 7).

**Terminado cuando:** pasan las pruebas, los dos endpoints responden según la sección 3.7, y Ale puede hacer `from app.syntax import parse, free_vars, to_string`.

### 4.3 Ale: semántica, justificación, base de datos y API (`backend/app/semantics/`, `backend/app/db/`, `backend/app/main.py`)

**Cómo trabaja solo:** prueba el evaluador con **ASTs escritos a mano** (los fixtures sirven de modelo) o mandando `ast` en `/api/evaluate`. Mientras el parser de Emily no esté listo, usa un stub mínimo de `to_string`.

**Funciones principales:**
```python
def validate_interpretation(language: dict, interp: dict) -> list[dict]: ...
def validate_environment(free_vars: list[str], env: dict, domain: list[str]) -> list[dict]: ...
def evaluate(ast: dict, language: dict, interp: dict, env: dict) -> dict:
    """{'ok': True, 'value': bool, 'summary': str, 'trace': {...}} según la sección 3.6."""
```

- [ ] **Día 1:** crear `backend/` con `requirements.txt` (fastapi, uvicorn, sqlalchemy y pytest), `app/main.py` que incluye los routers de `syntax` y `semantics`, y CORS para `localhost:5173`. Dejar `uvicorn app.main:app --reload --port 8000` funcionando.
- [ ] `validate_interpretation` con todos los códigos de la sección 3.5 que le tocan.
- [ ] `validate_environment`.
- [ ] Evaluador recursivo según la definición de satisfacción de Tarski: términos con funciones anidadas, todos los conectivos y los cuantificadores sobre D en el orden del usuario.
- [ ] Traza **exactamente** como dice la tabla de la sección 3.6.
- [ ] `explain.py`: el `summary` y textos claros en español. Ejemplos: «Falso: contraejemplo x = 3, porque P(3) es verdadero pero ∃y R(3,y) es falso».
- [ ] Endpoints `/api/interpretation/validate` y `/api/evaluate`, con el orden de validación de la sección 3.7.
- [ ] Base de datos SQLite: tablas `scenarios` (nombre, lenguaje e interpretación en JSON) y `operations` (fórmula, entorno, valor, resumen y fecha). Endpoints `/api/history` y `/api/scenarios`.
- [ ] **Al menos 40 pruebas** en `tests/semantics/`: cada fila de la tabla 3.6, fórmulas abiertas y cerradas, cuantificadores anidados (∀∃ y ∃∀ con resultados distintos), variable ligada que oculta a una libre, cada error de interpretación y de entorno, y que con error nunca haya `value`.
- [ ] Al menos 3 **escenarios de ejemplo** precargados, por ejemplo: aritmética mod 3, un grafo pequeño y orden en {1,2,3}.

**Terminado cuando:** pasan las pruebas, los fixtures de `contracts/fixtures/result-*.json` se reproducen idénticos desde el endpoint, y la lista de verificación de la sección 6 pasa contra el frontend.

---

## 5. Cómo trabajar sin pisarnos

1. **Ramas:** `feat/front-<tema>`, `feat/syntax-<tema>` y `feat/sem-<tema>`. Nadie trabaja directo en `main`.
2. **PR a `main`** con una revisión de **otra persona**: así todos conocen el código, y eso cuenta en la defensa.
3. **`main` siempre funciona:** antes de mezclar, `npx tsc -b` (frontend) o `pytest` (backend).
4. **¿Hace falta cambiar un contrato?** Se propone en el grupo, los tres aprueban, se hace un PR solo con `contracts/` y se actualizan los fixtures.
5. **Mensajes visibles en español, código en inglés.**
6. **Archivos de imagen:** van en `frontend/public/assets/<escena o personaje>/`, nunca en la raíz.

---

## 6. Integración final (los tres juntos)

Lista de verificación. **Cada punto se prueba desde la interfaz**, con el backend real:

- [ ] Lenguaje inválido (nombre repetido, aridad −1 o predicado de aridad 0): bloquea y no avanza.
- [ ] Dominio vacío, elemento repetido, función incompleta, valor fuera de D, relación vacía, tupla de aridad incorrecta: cada uno muestra su error.
- [ ] Fórmula con paréntesis sin cerrar, símbolo no declarado o aridad incorrecta: el error se marca en la posición exacta.
- [ ] Fórmula abierta: pide el entorno y no deja procesar si falta una variable.
- [ ] `∃` verdadero muestra **testigo**.
- [ ] `∀` falso muestra **contraejemplo**.
- [ ] `∀` verdadero muestra **comprobación completa**, con la tabla de todos los elementos.
- [ ] `∃` falso muestra **comprobación completa**.
- [ ] Cada conectivo (¬ ∧ ∨ → ↔) aparece al menos una vez en una demo.
- [ ] Con cualquier error **no** aparece VERDADERO ni FALSO.
- [ ] Los 3 escenarios de ejemplo cargan y evalúan bien.
- [ ] Demo grabada de respaldo, por si algo falla el día de la presentación.

---

## 7. Aportes creativos (20 puntos)

Cada aporte necesita **implementación, prueba y justificación escrita en `docs/aportes.md`**. La justificación lleva qué es, qué valor agrega, qué fundamento lógico tiene y cómo se probó.

| Aporte | Dueña/o | Fundamento lógico para la defensa | Estado |
|---|---|---|---|
| Narrativa de juego con módulos que se desbloquean (Turing, Gödel, Tarski) | Camila | La semántica depende de una sintaxis y una estructura ya fijadas: el orden lenguaje → interpretación → fórmula es obligatorio | Escena 1 lista |
| Recorrido animado del árbol de evaluación | Camila + Ale (traza) | Es la definición recursiva de satisfacción de Tarski hecha visible | Pendiente |
| Fichas de símbolos con número de Gödel | Camila + Emily | La aritmetización de la sintaxis de Gödel: cada símbolo recibe un número único | Pendiente |
| Escenarios guardados e historial | Ale | La misma fórmula cambia de valor según la interpretación: la verdad es relativa a 𝓘 | Pendiente |
| *(Opcional)* Modo forma normal (NNF o prenexa) | Emily | Equivalencia lógica: el evaluador confirma que ambas formas dan el mismo valor | Se recorta si falta tiempo |

---

## 8. Preparación de la defensa (30 puntos, individual)

**Cada persona debe poder responder todo esto**, no solo lo de su parte. Se ensaya explicando la parte de otra persona.

1. ¿Qué es una interpretación y por qué una fórmula solo tiene valor de verdad dentro de una?
2. ¿Qué es la aridad? ¿Por qué una constante es una función de aridad 0?
3. ¿Cómo se evalúa un término como `f(g(x), c)` en el programa?
4. Definición de satisfacción para ¬, ∧, ∨, →, ↔, ∀ y ∃. ¿Dónde está en el código?
5. ¿Qué es una variable libre y una ligada? ¿Por qué una fórmula abierta necesita entorno?
6. ¿Por qué un ∃ verdadero se justifica con un testigo y un ∀ verdadero necesita comprobación completa?
7. ¿Por qué ∀x∃y R(x,y) y ∃y∀x R(x,y) pueden dar distinto? Muéstrenlo con un ejemplo.
8. ¿Cómo maneja el parser la precedencia y el alcance de los cuantificadores? ¿Cómo se lee `∀x P(x) → Q(x)`?
9. ¿Por qué no se aceptan funciones parciales ni relaciones vacías?
10. ¿Qué pasa en el programa, paso por paso, desde que se pulsa «Procesar» hasta que aparece el sello?
11. Justificación de cada aporte creativo (sección 7).

Las respuestas se escriben en `docs/defensa.md`, una sección por pregunta, con enlaces al código.

---

## 9. Fases

| Fase | Quién | Qué |
|---|---|---|
| 0. Arranque | Los tres | Leer este documento, aprobar `contracts/` y crear las ramas. Ale crea el esqueleto de `backend/` |
| 1. Trabajo independiente | Cada quien | Las tareas de la sección 4 contra los contratos y fixtures |
| 2. Profundidad | Cada quien | Errores completos, traza, animaciones, base de datos y pruebas |
| 3. Integración | Los tres | Apagar el mock y pasar la lista de verificación de la sección 6 |
| 4. Aportes y defensa | Los tres | `docs/aportes.md`, `docs/defensa.md`, demo grabada y ensayo cruzado |

> **Pendiente de confirmar con el docente:** si ↔ cuenta como conectivo definido en clase. Por seguridad lo incluimos.
