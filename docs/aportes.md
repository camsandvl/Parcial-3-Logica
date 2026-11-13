# Aportes de Ale

## Escenarios guardados e historial

La aplicación conserva escenarios con su lenguaje e interpretación, además de cada
operación evaluada. Esto demuestra que una misma fórmula puede cambiar de valor
cuando cambia la interpretación, que es precisamente la relatividad semántica de
la verdad en lógica de primer orden.

La persistencia se implementa en SQLite en
[`backend/app/db/database.py`](../backend/app/db/database.py). Los endpoints son
`GET /api/scenarios`, `POST /api/scenarios` y `GET /api/history`.

La base incluye tres ejemplos para la demostración:

1. Aritmética módulo 3.
2. Un grafo pequeño.
3. La relación de orden en `{1,2,3}`.

## Evaluación visible

El evaluador recorre el dominio en el orden escrito y devuelve una traza
recursiva. Un existencial verdadero se detiene en el primer testigo, un universal
falso en el primer contraejemplo y los casos restantes conservan la comprobación
completa. La traza se muestra en el informe y se prueba en
[`backend/tests/semantics/test_evaluator_cases.py`](../backend/tests/semantics/test_evaluator_cases.py).
