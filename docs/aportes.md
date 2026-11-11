# Aportes creativos

Cada aporte lleva: qué es, qué valor agrega, qué fundamento lógico tiene y cómo se probó
(REPARTO.md, sección 7). Cada quien agrega aquí la sección de su aporte.

## Números de Gödel de los símbolos (Emily + Camila)

**Qué es.** Cada símbolo del lenguaje recibe un número único
`G = 2^tipo · 3^aridad · 5^posición` (tipo 1 = función, 2 = predicado; posición 1, 2, 3… dentro
de su tipo). La ficha del Taller de Gödel lo muestra y el backend lo calcula con la misma fórmula
en [`backend/app/syntax/godel.py`](../backend/app/syntax/godel.py) (`godel_number`, `godel_numbers`
y el inverso `decode_godel`).

**Valor.** Conecta la escena de Gödel con una idea real de la lógica: la sintaxis se puede
codificar con números y esa codificación no pierde información.

**Fundamento lógico.** Es la aritmetización de la sintaxis de Gödel. Por el teorema fundamental
de la aritmética, cada entero mayor que 1 se factoriza en primos de una sola forma: dos símbolos
distintos no pueden compartir número, y factorizando en 2, 3 y 5 se recupera el tipo, la aridad
y la posición.

**Cómo se probó.** `backend/tests/syntax/test_aportes.py`: valores concretos que coinciden con la
fórmula del frontend (f ↦ 30, R ↦ 4500), unicidad sobre un lenguaje completo y decodificación
(incluido el rechazo de un número que no codifica ningún símbolo).

## Modo forma normal: NNF y prenexa (Emily)

**Qué es.** [`backend/app/syntax/normal_forms.py`](../backend/app/syntax/normal_forms.py) transforma
el AST de una fórmula en:
- **Forma normal negativa (`to_nnf`)**: sin → ni ↔, y ¬ solo delante de átomos.
- **Forma prenexa (`to_prenex`)**: todos los cuantificadores al frente de una matriz sin cuantificadores.

El resultado es un AST normal: se imprime con `to_string` y el evaluador lo acepta tal cual.
Los nodos nuevos conservan el `span` del nodo original del que salen.

**Valor.** Permite mostrar en la presentación que la misma fórmula escrita de otra forma da el
mismo veredicto, y deja ver cómo cambia el alcance de los cuantificadores.

**Fundamento lógico.** Son equivalencias lógicas: `φ → ψ ≡ ¬φ ∨ ψ`, `φ ↔ ψ ≡ (¬φ ∨ ψ) ∧ (φ ∨ ¬ψ)`,
las leyes de De Morgan, `¬¬φ ≡ φ`, `¬∀x φ ≡ ∃x ¬φ` y `¬∃x φ ≡ ∀x ¬φ`. Para la prenexa,
`(Qx φ) ∘ ψ ≡ Qx(φ ∘ ψ)` vale solo si x no es libre en ψ, por eso antes se renombran las variables
ligadas que chocan: `P(x) ∧ ∀x Q(x)` pasa a `∀x1(P(x) ∧ Q(x1))`. Sacar un cuantificador de un ∧ o
un ∨ usa además que el dominio no es vacío, que el programa ya exige.

**Cómo se probó.** `backend/tests/syntax/test_aportes.py` compara la fórmula original con su NNF y
su prenexa en 45 interpretaciones aleatorias (dominios de 1, 2 y 3 elementos) y con todos los
entornos posibles para las variables libres: siempre dan el mismo valor. También verifica que el
resultado realmente esté en la forma pedida, que conserve las variables libres y que se pueda
imprimir y volver a parsear.

**Pendiente.** No hay endpoint todavía: exponerlo (por ejemplo `POST /api/normal-form`) cambia los
contratos, así que requiere el visto bueno de los tres antes de agregarlo a `contracts/types.ts`.
