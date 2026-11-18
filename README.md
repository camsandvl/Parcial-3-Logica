# Un viaje en el tiempo

Aplicación educativa y evaluador semántico de lógica de primer orden. El proyecto combina una interfaz de videojuego narrativo con React y un backend de FastAPI que analiza fórmulas finitas, interpreta símbolos y devuelve verdadero o falso con una explicación.

Ale Sierra
Cami Sandoval
Emily Góngora

Video de ejecución: https://drive.google.com/file/d/1qFylmuJ_1HJvnPh-5ZlSEX3xXJZJEJG_/view?usp=sharing 

## Objetivo del proyecto

El objetivo es construir un programa que determina si una fórmula de lógica de primer orden es verdadera o falsa dentro de una interpretación finita ingresada por el usuario. Nosotras quisimos darle un enfoque tipo videojuego, partiendo de una situación en la que todos hemos estado, estar en un examen y no saber nada. A partir de eso jugamos con el viaje en el tiempo y visitamos a diferentes matemáticos que nos ayudan explicando:

- Turing: procedimiento paso a paso.
- Gödel: construcción del lenguaje formal.
- Tarski: construcción de la interpretación y semántica de verdad.

Finalmente con el lenguaje y la interpretación ingresamos una fórmula y validamos si es V o F, mostramos el árbol sintáctico y los matemáticos nos ayudan explicando por qué. Regresamos al examen con nuevos conocimientos de lógica matemática y de su historia.

La evaluación depende de:

```text
Fórmula
+ lenguaje
+ dominio
+ interpretación de funciones
+ interpretación de predicados
+ asignación de variables libres
= verdadero o falso
```

Cumple los requisitos:

1. Lenguaje configurable con nombres y aridades.
2. Dominio finito no vacío.
3. Funciones totales `fᴵ: Dⁿ → D`.
4. Relaciones `Pᴵ ⊆ Dⁿ` para los predicados.
5. Fórmulas abiertas y cerradas.
6. Variables libres con asignaciones dentro del dominio.
7. Conectivos `¬`, `∧`, `∨`, `→`, `↔`.
8. Cuantificadores `∀` y `∃`.
9. Resultados con testigos, contraejemplos o comprobación completa.
10. Validación de sintaxis, aridades, tuplas, dominio y variables.

## Tecnologías

### Frontend

- React 19.
- TypeScript.
- Vite.
- Zustand para el estado compartido.
- React Router para las escenas.
- Framer Motion para las transiciones y animaciones.

### Backend

- Python 3.13 recomendado.
- FastAPI.
- Uvicorn.
- SQLite.
- SQLAlchemy.
- pytest.

## Requisitos

Antes de ejecutar el proyecto necesitas:

- Python 3.11 o superior.
- Node.js y npm.
- Windows PowerShell.

## Ejecutar el proyecto

### Forma más sencilla en Windows

Desde la carpeta raíz:

```powershell
.\iniciar.ps1
```

También puedes hacer doble clic en:

```text
iniciar.bat
```

El script realiza estas acciones:

1. Crea `backend/.venv` si no existe.
2. Instala las dependencias de Python.
3. Inicia FastAPI en `http://127.0.0.1:8000`.
4. Instala las dependencias de npm si hace falta.
5. Inicia Vite en `http://localhost:5173`.
6. Abre el navegador.

Para detener ambos procesos, usa `Ctrl+C` en la ventana de PowerShell.

### Ejecución manual

#### Backend

Desde la carpeta raíz:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

O, sin activar el entorno virtual:

```powershell
cd backend
..\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Documentación interactiva del backend:

- API: `http://127.0.0.1:8000/docs`
- Estado básico: `http://127.0.0.1:8000/`

#### Frontend

En otra terminal:

```powershell
cd frontend
npm install
npm run dev
```

Abre la dirección mostrada por Vite, normalmente:

```text
http://localhost:5173
```

El frontend envía las llamadas `/api` al backend mediante el proxy configurado en `frontend/vite.config.ts`.

## Comandos útiles

### Frontend

```powershell
cd frontend
npm run dev       # Servidor de desarrollo
npm run build     # Compilación de producción
npm run lint      # Revisión de ESLint
npm run preview   # Previsualiza la compilación
```

### Backend

```powershell
cd backend
pytest            # Ejecuta todas las pruebas
pytest -q         # Ejecuta las pruebas de forma breve
```

Para probar un módulo específico:

```powershell
pytest tests/semantics/test_evaluator_cases.py
pytest tests/syntax/test_parser.py
```

## Flujo general

El recorrido completo de la aplicación es:

```text
Salón de clases
    ↓
Taller de Turing
    ↓
Taller de Gödel
    ↓
Taller de Tarski
    ↓
Consola
    ↓
Evaluación e informe
    ↓
Regreso al examen
```

### 1. Inicio narrativo

El estudiante aparece en el salón enfrentando una pregunta de lógica. La historia sirve como introducción educativa, pero no sustituye los conceptos formales.

### 2. Construcción del lenguaje

En el taller de Gödel el usuario declara:

- Funciones.
- Constantes.
- Predicados.
- Nombre de cada símbolo.
- Aridad.

La aridad indica cuántos argumentos recibe el símbolo:

```text
P(x)       predicado de aridad 1
R(x, y)    predicado de aridad 2
c          constante, aridad 0
f(x)       función de aridad 1
```

El lenguaje debe validarse antes de continuar.

### 3. Construcción de la interpretación

En el taller de Tarski el usuario define:

- El dominio finito `D`.
- Una salida en `D` para cada combinación posible de una función.
- Las tuplas que hacen verdadero cada predicado.

Ejemplo:

```text
D = {1, 2, 3}

Pᴵ = {1, 3}
fᴵ(1) = 2
fᴵ(2) = 3
fᴵ(3) = 1
```

Las funciones deben ser totales. Una función no puede estar incompleta ni devolver elementos fuera del dominio.

Los predicados pueden representarse como relaciones: solo las tuplas indicadas son verdaderas.

### 4. Escritura de la fórmula

En la consola el usuario escribe una fórmula:

```text
∀x(P(x) → Q(x))
∃x R(x, f(x))
P(x) ∧ ¬Q(x)
```

El frontend permite:

- Escribir con el teclado.
- Usar botones para conectivos y cuantificadores.
- Introducir nombres declarados en el lenguaje.
- Asignar valores a variables libres.

### 5. Conversión en el backend

La fórmula sigue este proceso:

```text
texto de la fórmula
        ↓
lexer: división en tokens
        ↓
parser: análisis sintáctico
        ↓
AST: árbol de sintaxis
        ↓
evaluador semántico
        ↓
verdadero/falso + traza
```

#### Tokens

El lexer convierte el texto en símbolos con posiciones.

Por ejemplo:

```text
∀ x ( P ( x ) → Q ( x ) )
```

produce tokens como cuantificador, variable, paréntesis, predicado y implicación.

También acepta equivalentes ASCII:

```text
\A = ∀
\E = ∃
-> = →
<-> = ↔
& = ∧
| = ∨
~ = ¬
```

#### AST

El parser verifica la estructura y crea un árbol.

Ejemplo:

```text
∀x(P(x) → Q(x))
```

se representa conceptualmente como:

```text
forall
└── implies
    ├── P(x)
    └── Q(x)
```

El AST describe la estructura sintáctica de la fórmula. No contiene todavía su valor de verdad.

### 6. Evaluación semántica

El evaluador recorre el AST de forma recursiva.

Para cada nodo:

- Predicado: consulta si sus argumentos pertenecen a la relación.
- Variable: busca su valor en el entorno.
- Función: busca su entrada y devuelve su salida.
- Negación: invierte el valor.
- Conectivo: aplica su tabla de verdad.
- Existencial `∃`: busca al menos un testigo.
- Universal `∀`: busca un contraejemplo o revisa todos los casos.

Reglas importantes:

```text
¬A       verdadera si A es falsa
A ∧ B    verdadera solo si ambas son verdaderas
A ∨ B    verdadera si al menos una es verdadera
A → B    falsa solo si A es verdadera y B falsa
A ↔ B    verdadera si ambas tienen el mismo valor
```

Para cuantificadores:

```text
∃x P(x)
verdadero: existe al menos un elemento con P(x) verdadera

∀x P(x)
verdadero: todos los elementos tienen P(x) verdadera
falso: el primer elemento que falle se muestra como contraejemplo
```

### 7. Resultado y explicación

El backend devuelve:

- `value`: verdadero o falso.
- `summary`: resumen textual.
- `trace`: árbol de evaluación.

La interfaz muestra:

- El valor final como sello de verdadero o falso.
- El árbol sintáctico anotado con valores.
- Testigo para un existencial verdadero.
- Contraejemplo para un universal falso.
- Comprobación completa para un universal verdadero o existencial falso.

El árbol mostrado contiene estructura sintáctica y datos semánticos, por lo que se puede describir como un **árbol sintáctico anotado semánticamente**.

### 8. Persistencia

SQLite guarda:

- Operaciones y fórmulas evaluadas.
- Valores verdaderos o falsos.
- Resúmenes.
- Trazas.
- Interpretaciones guardadas como escenarios.

Esto permite demostrar que una misma fórmula puede tener valores diferentes al cambiar su interpretación.

## Conceptos que implementa

### Lenguaje

Conjunto de símbolos funcionales y predicados junto con sus aridades.

### Interpretación

Significado asignado a los símbolos dentro de un dominio finito.

Incluye:

- `domain`.
- `functions`.
- `predicates`.

### Dominio

Conjunto finito y no vacío de elementos sobre los que se evalúa la fórmula.

Ejemplo:

```text
D = {1, 2, 3}
```

### Función

Una función recibe tuplas de elementos y devuelve un elemento de `D`.

Internamente se representa como filas:

```python
"f": [
    [["1"], "2"],
    [["2"], "3"],
    [["3"], "1"]
]
```

Cada fila significa:

```text
entrada -> salida
```

La estructura se eligió porque puede intercambiarse fácilmente mediante JSON y permite validar explícitamente que la función esté completa.

### Predicado

Una relación cuyo resultado es verdadero o falso.

```python
"P": [["1"], ["3"]]
```

significa:

```text
P(1) = verdadero
P(2) = falso
P(3) = verdadero
```

### Variable ligada

Una variable dentro de un cuantificador recibe temporalmente elementos del dominio.

```text
∀x P(x)
∃x P(x)
```

### Variable libre

Una variable que no está afectada por un cuantificador.

```text
P(x)
```

Esta variable necesita una asignación en el entorno:

```python
{"x": "1"}
```

### Testigo

Elemento que hace verdadera una fórmula existencial.

Ejemplo:

```text
∃x P(x) = verdadero
testigo: x = 2
```

### Contraejemplo

Elemento que hace falsa una instancia dentro de un universal falso.

Ejemplo:

```text
∀x P(x) = falso
contraejemplo: x = 3
```

### Traza

Árbol que guarda el valor y los casos revisados en cada nodo. Permite explicar por qué el resultado final es verdadero o falso.

## Estructura del proyecto

```text
Parcial-3-Logica/
├── backend/
├── contracts/
├── frontend/
├── docs/
├── iniciar.ps1
└── iniciar.bat
```

### `backend/`

Contiene el servidor FastAPI, el parser, el evaluador, las pruebas y la base de datos.

```text
backend/
├── app/
│   ├── main.py
│   ├── db/
│   ├── semantics/
│   └── syntax/
├── tests/
├── data/
├── requirements.txt
└── README.md
```

#### `backend/app/main.py`

Punto de entrada de FastAPI.

Implementa:

- Configuración CORS.
- Inicialización de SQLite.
- Endpoint de validación de interpretación.
- Endpoint de evaluación.
- Endpoints de historial y escenarios.
- Integración con el módulo sintáctico.

#### `backend/app/syntax/`

Implementa el análisis sintáctico realizado por la parte de Emily.

```text
syntax/
├── lexer.py
├── parser.py
├── free_vars.py
├── printer.py
├── language.py
├── normal_forms.py
├── godel.py
├── errors.py
└── router.py
```

- `lexer.py`: convierte texto en tokens.
- `parser.py`: crea el AST.
- `free_vars.py`: identifica variables libres.
- `printer.py`: convierte AST a texto.
- `language.py`: valida el lenguaje.
- `errors.py`: define los errores sintácticos.
- `router.py`: expone `/api/language/validate` y `/api/parse`.

#### `backend/app/semantics/`

Implementa la parte semántica realizada por Ale.

```text
semantics/
├── interpretation.py
├── evaluator.py
└── explain.py
```

- `interpretation.py`: valida dominio, funciones, predicados y entornos.
- `evaluator.py`: evalúa recursivamente el AST y crea la traza.
- `explain.py`: genera el resumen explicativo del resultado.

#### `backend/app/db/`

Contiene la persistencia SQLite:

- Escenarios.
- Fórmulas evaluadas.
- Interpretaciones.
- Trazas.

#### `backend/tests/`

Contiene pruebas de:

- Lexer.
- Parser.
- Variables libres.
- Lenguaje.
- Evaluador.
- Validación semántica.
- Endpoints.
- Persistencia.

### `frontend/`

Contiene la aplicación React.

```text
frontend/
├── public/
├── src/
│   ├── api/
│   ├── components/
│   ├── scenes/
│   ├── store/
│   ├── utils/
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── scripts/
├── package.json
└── vite.config.ts
```

#### `frontend/src/api/`

Conecta React con FastAPI.

- `httpApi.ts`: realiza las llamadas HTTP.
- `mockApi.ts`: permite ejecutar una implementación simulada.
- `index.ts`: selecciona backend real o simulación.
- `types.ts`: contratos de la API.

Por defecto se usa el backend real porque `.env.development` contiene:

```text
VITE_USE_MOCK=false
```

#### `frontend/src/store/`

`machine.ts` contiene el estado global creado con Zustand:

- Lenguaje.
- Interpretación.
- Fórmula.
- AST.
- Variables libres.
- Entorno.
- Errores.
- Resultado.
- Estado de desbloqueo de cada escena.

#### `frontend/src/scenes/`

Contiene cada pantalla del recorrido narrativo:

- `ExamRoom.tsx`: inicio en el salón.
- `Activation.tsx`: taller de Turing.
- `LanguageWorkshop.tsx`: taller de Gödel.
- `UniverseRoom.tsx`: taller de Tarski.
- `Console.tsx`: escritura y análisis.
- `Report.tsx`: resultado, traza y árbol.
- `ExamReturn.tsx`: regreso al examen.
- `Intro.tsx`: portada histórica, si se requiere en otra rama o versión.

#### `frontend/src/components/vn/`

Contiene componentes visuales reutilizables:

- Personajes.
- Diálogos.
- Máquina.
- Árbol sintáctico.
- Fórmulas.
- Variables libres.
- Paletas de predicados.
- Diagramas de funciones.
- Información de escena.

#### `frontend/src/components/`

Incluye componentes generales de interfaz, como:

- Panel de control.
- Lista de errores.
- Entrada de fórmulas.
- Guías.

#### `frontend/public/`

Contiene las imágenes y fondos usados por el juego.

#### `frontend/scripts/`

Contiene scripts auxiliares usados para generar o procesar recursos visuales.

### `contracts/`

Contiene los tipos compartidos TypeScript que definen el contrato entre frontend, parser y semántica:

- `Language`.
- `Interpretation`.
- `FunctionRow`.
- `Formula`.
- `Term`.
- `Environment`.
- `TraceNode`.
- `EvaluateResponse`.
- Validaciones y errores.

Este archivo debe coincidir con las estructuras Python enviadas por el backend.

### `docs/`

Contiene documentación de diseño y aportes del proyecto.

### `iniciar.ps1` e `iniciar.bat`

Son los lanzadores de Windows.

- `iniciar.ps1`: crea entorno virtual, instala dependencias y arranca ambos servidores.
- `iniciar.bat`: abre el script PowerShell con doble clic.

## API principal

| Método | Ruta | Función |
|---|---|---|
| `GET` | `/` | Comprueba que la API responde |
| `POST` | `/api/language/validate` | Valida funciones y predicados |
| `POST` | `/api/parse` | Convierte una fórmula en AST y obtiene variables libres |
| `POST` | `/api/interpretation/validate` | Valida dominio, funciones y predicados |
| `POST` | `/api/evaluate` | Evalúa una fórmula y genera su traza |
| `GET` | `/api/history` | Obtiene evaluaciones previas |
| `GET` | `/api/scenarios` | Obtiene escenarios guardados |
| `POST` | `/api/scenarios` | Guarda un lenguaje e interpretación |

## Pruebas

Las pruebas cubren ejemplos positivos y negativos de:

- Conectivos.
- Negación.
- Cuantificadores.
- Variables libres.
- Variables ligadas.
- Testigos.
- Contraejemplos.
- Funciones anidadas.
- Constantes.
- Dominio vacío.
- Elementos repetidos.
- Funciones incompletas.
- Valores fuera del dominio.
- Predicados vacíos.
- Tuplas con aridad incorrecta.
- Asignaciones de variables inválidas.

Ejemplo completo:

```powershell
cd backend
pytest
```

Para validar el frontend:

```powershell
cd frontend
npm run build
npm run lint
```


## Datos almacenados

La base de datos predeterminada se encuentra en:

```text
backend/data/logic.db
```

Puede cambiarse mediante la variable de entorno `LOGIC_DATABASE`.
