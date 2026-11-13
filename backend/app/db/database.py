"""Persistencia SQLite para historial de evaluaciones y escenarios."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from threading import Lock
from typing import Any


class Database:
    """Repositorio pequeño y explícito para la información persistente de la app."""

    def __init__(self, path: str | Path | None = None) -> None:
        if path is None:
            path = Path(__file__).resolve().parents[2] / "data" / "logic.db"
        self.path = Path(path)
        if self.path != Path(":memory:"):
            self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(str(self.path), check_same_thread=False)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._lock, self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS operations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL,
                    formula TEXT NOT NULL,
                    environment_json TEXT NOT NULL,
                    value INTEGER,
                    summary TEXT NOT NULL,
                    trace_json TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS scenarios (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    language_json TEXT NOT NULL,
                    interpretation_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                """
            )
            self._seed_scenarios(connection)

    @staticmethod
    def _seed_scenarios(connection: sqlite3.Connection) -> None:
        scenarios = [
            (
                "Aritmética módulo 3",
                {"functions": [{"name": "s", "arity": 1}], "predicates": [{"name": "Z", "arity": 1}]},
                {
                    "domain": ["0", "1", "2"],
                    "functions": {
                        "s": [[["0"], "1"], [["1"], "2"], [["2"], "0"]]
                    },
                    "predicates": {"Z": [["0"]]},
                },
            ),
            (
                "Grafo pequeño",
                {"functions": [], "predicates": [{"name": "E", "arity": 2}]},
                {
                    "domain": ["A", "B", "C"],
                    "functions": {},
                    "predicates": {"E": [["A", "B"], ["B", "C"]]},
                },
            ),
            (
                "Orden en {1,2,3}",
                {"functions": [], "predicates": [{"name": "Menor", "arity": 2}]},
                {
                    "domain": ["1", "2", "3"],
                    "functions": {},
                    "predicates": {
                        "Menor": [["1", "2"], ["1", "3"], ["2", "3"]]
                    },
                },
            ),
        ]
        created_at = "2026-01-01T00:00:00+00:00"
        for name, language, interpretation in scenarios:
            connection.execute(
                """
                INSERT OR IGNORE INTO scenarios
                    (name, language_json, interpretation_json, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (
                    name,
                    json.dumps(language, ensure_ascii=False),
                    json.dumps(interpretation, ensure_ascii=False),
                    created_at,
                ),
            )

    def add_history(
        self,
        *,
        created_at: str,
        formula: str,
        environment: dict[str, str],
        value: bool,
        summary: str,
        trace: dict[str, Any],
    ) -> dict[str, Any]:
        with self._lock, self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO operations
                    (created_at, formula, environment_json, value, summary, trace_json)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    created_at,
                    formula,
                    json.dumps(environment, ensure_ascii=False),
                    int(value),
                    summary,
                    json.dumps(trace, ensure_ascii=False),
                ),
            )
            return {
                "id": cursor.lastrowid,
                "createdAt": created_at,
                "formula": formula,
                "value": value,
                "summary": summary,
            }

    def list_history(self) -> list[dict[str, Any]]:
        with self._lock, self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, created_at, formula, value, summary
                FROM operations ORDER BY id DESC
                """
            ).fetchall()
        return [
            {
                "id": row["id"],
                "createdAt": row["created_at"],
                "formula": row["formula"],
                "value": bool(row["value"]) if row["value"] is not None else None,
                "summary": row["summary"],
            }
            for row in rows
        ]

    def save_scenario(
        self,
        *,
        name: str,
        language: dict[str, Any],
        interpretation: dict[str, Any],
        created_at: str,
    ) -> dict[str, Any]:
        with self._lock, self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO scenarios
                    (name, language_json, interpretation_json, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(name) DO UPDATE SET
                    language_json = excluded.language_json,
                    interpretation_json = excluded.interpretation_json,
                    created_at = excluded.created_at
                """,
                (
                    name,
                    json.dumps(language, ensure_ascii=False),
                    json.dumps(interpretation, ensure_ascii=False),
                    created_at,
                ),
            )
            scenario_id = cursor.lastrowid
            if scenario_id == 0:
                scenario_id = connection.execute(
                    "SELECT id FROM scenarios WHERE name = ?", (name,)
                ).fetchone()["id"]
        return {
            "id": scenario_id,
            "name": name,
            "language": language,
            "interpretation": interpretation,
            "createdAt": created_at,
        }

    def list_scenarios(self) -> list[dict[str, Any]]:
        with self._lock, self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, name, language_json, interpretation_json, created_at
                FROM scenarios ORDER BY id DESC
                """
            ).fetchall()
        return [
            {
                "id": row["id"],
                "name": row["name"],
                "language": json.loads(row["language_json"]),
                "interpretation": json.loads(row["interpretation_json"]),
                "createdAt": row["created_at"],
            }
            for row in rows
        ]
