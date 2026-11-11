"""Persistencia SQLite para historial de evaluaciones y escenarios."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from threading import Lock
from typing import Any


class Database:
    """Repositorio pequeño y explícito para la información persistente de la app."""

    def __init__(self, path: str | Path = "backend/data/logic.db") -> None:
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
                CREATE TABLE IF NOT EXISTS history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL,
                    formula TEXT NOT NULL,
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

    def add_history(
        self,
        *,
        created_at: str,
        formula: str,
        value: bool,
        summary: str,
        trace: dict[str, Any],
    ) -> dict[str, Any]:
        with self._lock, self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO history (created_at, formula, value, summary, trace_json)
                VALUES (?, ?, ?, ?, ?)
                """,
                (created_at, formula, int(value), summary, json.dumps(trace, ensure_ascii=False)),
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
                FROM history ORDER BY id DESC
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
