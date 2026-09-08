"""Minimal persisted state for an anonymous assessment conversation."""
import json
import secrets
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from threading import RLock

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "assessment_sessions.db"
_SESSION_LOCKS = tuple(RLock() for _ in range(256))


@contextmanager
def session_guard(session_id: str):
    """Serialize mutations for one anonymous session in the single-worker runtime."""
    lock = _SESSION_LOCKS[hash(session_id) % len(_SESSION_LOCKS)]
    with lock:
        yield


def _connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    return sqlite3.connect(DB_PATH)


def init_store() -> None:
    with _connection() as connection:
        connection.execute(
            """CREATE TABLE IF NOT EXISTS assessment_sessions (
                session_id TEXT PRIMARY KEY,
                token TEXT NOT NULL,
                intake_state TEXT NOT NULL DEFAULT '',
                history TEXT NOT NULL DEFAULT '[]',
                assessment_profile TEXT NOT NULL DEFAULT '',
                assessment_result TEXT NOT NULL DEFAULT '',
                haiwen_lead_id TEXT,
                consultation_requested INTEGER NOT NULL DEFAULT 0
            )"""
        )
        columns = {row[1] for row in connection.execute("PRAGMA table_info(assessment_sessions)")}
        migrations = {
            "history": "TEXT NOT NULL DEFAULT '[]'",
            "assessment_profile": "TEXT NOT NULL DEFAULT ''",
            "assessment_result": "TEXT NOT NULL DEFAULT ''",
            "haiwen_lead_id": "TEXT",
            "consultation_requested": "INTEGER NOT NULL DEFAULT 0",
        }
        for name, definition in migrations.items():
            if name not in columns:
                connection.execute(f"ALTER TABLE assessment_sessions ADD COLUMN {name} {definition}")


def create_session() -> dict:
    session_id = f"assessment_{secrets.token_urlsafe(12)}"
    token = secrets.token_urlsafe(32)
    with _connection() as connection:
        connection.execute(
            "INSERT INTO assessment_sessions (session_id, token) VALUES (?, ?)",
            (session_id, token),
        )
    return {"session_id": session_id, "token": token}


def validate_session(session_id: str, token: str) -> bool:
    with _connection() as connection:
        row = connection.execute(
            "SELECT token FROM assessment_sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
    return bool(row and secrets.compare_digest(row[0], token))


def get_intake(session_id: str) -> dict | None:
    with _connection() as connection:
        row = connection.execute(
            "SELECT intake_state FROM assessment_sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
    return json.loads(row[0]) if row and row[0] else None


def save_intake(session_id: str, state: dict | None) -> None:
    with _connection() as connection:
        connection.execute(
            "UPDATE assessment_sessions SET intake_state = ? WHERE session_id = ?",
            (json.dumps(state, ensure_ascii=False) if state else "", session_id),
        )


def append_history(session_id: str, role: str, content: str) -> None:
    history = get_history(session_id)
    history.append({"role": role, "content": content})
    with _connection() as connection:
        connection.execute(
            "UPDATE assessment_sessions SET history = ? WHERE session_id = ?",
            (json.dumps(history, ensure_ascii=False), session_id),
        )


def get_history(session_id: str) -> list[dict]:
    with _connection() as connection:
        row = connection.execute(
            "SELECT history FROM assessment_sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
    return json.loads(row[0]) if row and row[0] else []


def save_completed_assessment(session_id: str, profile: dict, result: dict) -> None:
    with _connection() as connection:
        connection.execute(
            "UPDATE assessment_sessions SET intake_state = '', assessment_profile = ?, assessment_result = ? WHERE session_id = ?",
            (json.dumps(profile, ensure_ascii=False), json.dumps(result, ensure_ascii=False), session_id),
        )


def get_completed_assessment(session_id: str) -> tuple[dict, dict] | None:
    with _connection() as connection:
        row = connection.execute(
            "SELECT assessment_profile, assessment_result FROM assessment_sessions WHERE session_id = ?",
            (session_id,),
        ).fetchone()
    if not row or not row[0] or not row[1]:
        return None
    return json.loads(row[0]), json.loads(row[1])


def save_lead_submission(session_id: str, lead_id: str, consultation_requested: bool) -> None:
    with _connection() as connection:
        connection.execute(
            "UPDATE assessment_sessions SET haiwen_lead_id = ?, consultation_requested = ? WHERE session_id = ?",
            (lead_id, int(consultation_requested), session_id),
        )
