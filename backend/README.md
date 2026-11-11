# Backend semántico

Este avance implementa la parte de Ale sin depender todavía del parser de Emily:

- `app/semantics/interpretation.py` valida dominio, funciones y predicados.
- `app/semantics/evaluator.py` evalúa un AST y construye una traza con testigos y contraejemplos.
- `app/db/database.py` crea una base SQLite con tablas `history` y `scenarios`.
- `app/main.py` expone los endpoints semánticos y de persistencia.

## Ejecutar

Desde `backend/`:

```bash
pip install -r requirements.txt
set PYTHONPATH=.
uvicorn app.main:app --reload
```

Mientras el parser no esté integrado, `/api/evaluate` acepta el campo opcional `ast` definido en `contracts/types.ts`.
Cuando Emily agregue `app/syntax`, el endpoint usará automáticamente `parse(formula, language)` si no recibe AST.

La interfaz no se sirve desde el puerto 8000. Inicia también Vite desde `frontend/`:

```powershell
npm install
npm run dev
```

Después abre la URL que muestre Vite (normalmente `http://localhost:5173`). El proxy de
`frontend/vite.config.ts` redirige `/api` hacia FastAPI.
