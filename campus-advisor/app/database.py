"""SQLite 数据层 — 替代 JSON 文件存储

用法：
    from .database import db

    # 自动建表、自动从 JSON 迁移
    db.init()
"""

import json
import logging
import sqlite3
import threading
from datetime import datetime
from pathlib import Path
from typing import Any

from .config import (
    CONVERSATIONS_FILE, CUSTOM_CATEGORIES_FILE,
    PAYMENTS_FILE, PROFILES_FILE, RECHARGE_CODES_FILE, SESSION_TOKENS_FILE,
    USERS_FILE,
)

logger = logging.getLogger(__name__)

DB_DIR = Path(__file__).resolve().parent.parent / "data"
DB_PATH = DB_DIR / "data.db"

# ── 线程本地连接 ──
_local = threading.local()


def _get_conn() -> sqlite3.Connection:
    """获取当前线程的 SQLite 连接（WAL 模式，自动创建表）"""
    if not hasattr(_local, "conn") or _local.conn is None:
        _local.conn = sqlite3.connect(str(DB_PATH), timeout=10, check_same_thread=False)
        _local.conn.row_factory = sqlite3.Row
        _local.conn.execute("PRAGMA journal_mode=WAL")
        _local.conn.execute("PRAGMA synchronous=NORMAL")
        _local.conn.execute("PRAGMA foreign_keys=ON")
    return _local.conn


def close_thread_connection():
    """Close the SQLite connection owned by the current thread, if any."""
    conn = getattr(_local, "conn", None)
    if conn is not None:
        conn.close()
        _local.conn = None


# ── Schema ──

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS profiles (
    session_id TEXT PRIMARY KEY,
    school TEXT DEFAULT '',
    major TEXT DEFAULT '',
    grade TEXT DEFAULT '',
    goal TEXT DEFAULT '',
    skills TEXT DEFAULT '',
    experience TEXT DEFAULT '',
    interests TEXT DEFAULT '',
    achievements TEXT DEFAULT '',
    balance INTEGER DEFAULT 0,
    free_trial_granted INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS conversations (
    session_id TEXT NOT NULL,
    conv_id TEXT NOT NULL,
    title TEXT DEFAULT '新对话',
    mode TEXT DEFAULT '',
    created_at TEXT DEFAULT '',
    updated_at TEXT DEFAULT '',
    messages TEXT DEFAULT '[]',
    summary TEXT DEFAULT '',
    PRIMARY KEY (session_id, conv_id)
);

CREATE TABLE IF NOT EXISTS session_tokens (
    session_id TEXT PRIMARY KEY,
    token TEXT DEFAULT '',
    created_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    password_hash TEXT DEFAULT '',
    session_id TEXT DEFAULT '',
    created_at TEXT DEFAULT '',
    updated_at TEXT DEFAULT '',
    reset_token TEXT DEFAULT '',
    reset_token_expires TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS custom_categories (
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT '',
    PRIMARY KEY (session_id, name)
);

CREATE TABLE IF NOT EXISTS recharge_codes (
    code TEXT PRIMARY KEY,
    value INTEGER DEFAULT 0,
    used INTEGER DEFAULT 0,
    used_by TEXT DEFAULT '',
    used_at TEXT DEFAULT '',
    created_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS payments (
    order_id TEXT PRIMARY KEY,
    session_id TEXT DEFAULT '',
    amount_yuan REAL DEFAULT 0,
    status TEXT DEFAULT '',
    created_at TEXT DEFAULT '',
    paid_at TEXT DEFAULT '',
    trade_no TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS session_memory (
    session_id TEXT PRIMARY KEY,
    direction TEXT DEFAULT '',
    conv_id TEXT DEFAULT '',
    history TEXT DEFAULT '[]',
    assessment_intake TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    title TEXT DEFAULT '',
    content TEXT DEFAULT '',
    target TEXT DEFAULT 'all',
    created_at TEXT DEFAULT '',
    active INTEGER DEFAULT 1
);
"""


def init():
    """初始化 SQLite：建表 + 从 JSON 迁移数据"""
    DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = _get_conn()
    conn.executescript(SCHEMA_SQL)
    conn.commit()

    _migrate_from_json()
    _cleanup_json_flag()

    # Migrate: add new profile columns for existing databases
    _add_profile_columns(conn)
    _add_conversation_columns(conn)
    _add_session_memory_columns(conn)


def _add_profile_columns(conn):
    """Add new memory columns to profiles table if they don't exist (for existing DBs)."""
    existing_cols = {row[1] for row in conn.execute("PRAGMA table_info(profiles)").fetchall()}
    new_cols = ["skills", "experience", "interests", "achievements"]
    for col in new_cols:
        if col not in existing_cols:
            try:
                conn.execute(f"ALTER TABLE profiles ADD COLUMN {col} TEXT DEFAULT ''")
                logger.info(f"Added column '{col}' to profiles table")
            except Exception as e:
                logger.warning(f"Failed to add column '{col}': {e}")
    conn.commit()


def _add_conversation_columns(conn):
    """Add conversation metadata columns for existing databases."""
    existing_cols = {row[1] for row in conn.execute("PRAGMA table_info(conversations)").fetchall()}
    if "summary" not in existing_cols:
        conn.execute("ALTER TABLE conversations ADD COLUMN summary TEXT DEFAULT ''")
        conn.commit()


def _add_session_memory_columns(conn):
    """Add assessment state storage for existing databases."""
    existing_cols = {row[1] for row in conn.execute("PRAGMA table_info(session_memory)").fetchall()}
    if "assessment_intake" not in existing_cols:
        conn.execute("ALTER TABLE session_memory ADD COLUMN assessment_intake TEXT DEFAULT ''")
        conn.commit()


# ── JSON → SQLite 迁移 ──

_MIGRATED_FLAG = DB_DIR / ".db_migrated"


def _migrate_from_json():
    """从现有 JSON 文件导入数据（仅首次运行）"""
    # 如果 data.db 不存在，即使是重新迁移
    if _MIGRATED_FLAG.exists() and DB_PATH.exists():
        return

    conn = _get_conn()
    migrations = [
        (_migrate_profiles, PROFILES_FILE),
        (_migrate_conversations, CONVERSATIONS_FILE),
        (_migrate_session_tokens, SESSION_TOKENS_FILE),
        (_migrate_recharge_codes, RECHARGE_CODES_FILE),
        (_migrate_payments, PAYMENTS_FILE),
        (_migrate_users, USERS_FILE),
        (_migrate_custom_categories, CUSTOM_CATEGORIES_FILE),
    ]
    for fn, path in migrations:
        if path.exists():
            try:
                fn(conn, path)
                logger.info(f"Migrated {path.name} → SQLite")
            except Exception as e:
                logger.warning(f"Migration skipped {path.name}: {e}")

    conn.commit()


def _cleanup_json_flag():
    """标记迁移完成"""
    _MIGRATED_FLAG.write_text("done", encoding="utf-8")


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _migrate_profiles(conn, path):
    data = _load_json(path)
    for sid, prof in data.items():
        conn.execute(
            """INSERT OR REPLACE INTO profiles
               (session_id, school, major, grade, goal, skills, experience, interests, achievements, balance, free_trial_granted, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (sid, prof.get("school", ""), prof.get("major", ""),
             prof.get("grade", ""), prof.get("goal", ""),
             prof.get("skills", ""), prof.get("experience", ""),
             prof.get("interests", ""), prof.get("achievements", ""),
             prof.get("balance", 0), 1 if prof.get("free_trial_granted") else 0,
             prof.get("updated_at", "")),
        )


def _migrate_conversations(conn, path):
    data = _load_json(path)
    for sid, convs in data.items():
        for cid, conv in convs.items():
            msgs = json.dumps(conv.get("messages", []), ensure_ascii=False)
            conn.execute(
                """INSERT OR REPLACE INTO conversations
                   (session_id, conv_id, title, mode, created_at, updated_at, messages, summary)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (sid, cid, conv.get("title", "新对话"), conv.get("mode", ""),
                 conv.get("created_at", ""), conv.get("updated_at", ""), msgs,
                 conv.get("summary", "")),
            )


def _migrate_session_tokens(conn, path):
    data = _load_json(path)
    for sid, sd in data.items():
        conn.execute(
            "INSERT OR REPLACE INTO session_tokens VALUES (?,?,?)",
            (sid, sd.get("token", ""), sd.get("created_at", "")),
        )


def _migrate_recharge_codes(conn, path):
    codes = _load_json(path)
    for c in codes:
        conn.execute(
            """INSERT OR REPLACE INTO recharge_codes
               (code, value, used, used_by, used_at, created_at)
               VALUES (?,?,?,?,?,?)""",
            (c["code"], c.get("value", 0), 1 if c.get("used") else 0,
             c.get("used_by", ""), c.get("used_at", ""), c.get("created_at", "")),
        )


def _migrate_payments(conn, path):
    data = _load_json(path)
    for oid, pay in data.items():
        conn.execute(
            """INSERT OR REPLACE INTO payments
               (order_id, session_id, amount_yuan, status, created_at, paid_at, trade_no)
               VALUES (?,?,?,?,?,?,?)""",
            (oid, pay.get("session_id", ""), pay.get("amount_yuan", 0),
             pay.get("status", ""), pay.get("created_at", ""),
             pay.get("paid_at", ""), pay.get("trade_no", "")),
        )


def _migrate_users(conn, path):
    data = _load_json(path)
    for uid, u in data.items():
        conn.execute(
            """INSERT OR REPLACE INTO users
               (user_id, email, phone, password_hash, session_id,
                created_at, updated_at, reset_token, reset_token_expires)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (uid, u.get("email", ""), u.get("phone", ""),
             u.get("password_hash", ""), u.get("session_id", ""),
             u.get("created_at", ""), u.get("updated_at", ""),
             u.get("reset_token", ""), u.get("reset_token_expires", "")),
        )


def _migrate_custom_categories(conn, path):
    data = _load_json(path)
    for sid, cats in data.items():
        for name, info in cats.items():
            conn.execute(
                "INSERT OR REPLACE INTO custom_categories VALUES (?,?,?,?)",
                (sid, name, info.get("description", ""), info.get("created_at", "")),
            )


# ── 公共读写接口（与旧 JSON 文件路径兼容） ──

_FILE_TABLE_MAP = {
    "user_profiles": "profiles",
    "conversations": "conversations",
    "session_tokens": "session_tokens",
    "users": "users",
    "custom_categories": "custom_categories",
    "recharge_codes": "recharge_codes",
    "payments": "payments",
    "announcements": "announcements",
}


def _table_for(path: Path) -> str | None:
    return _FILE_TABLE_MAP.get(path.stem)


def read_all(path: Path) -> dict | list:
    """从 SQLite 表读取全部数据，返回与原 JSON 格式相同的 dict/list"""
    table = _table_for(path)
    if table is None:
        # fallback: 读 JSON 文件
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        return {} if path.suffix == ".json" else []

    conn = _get_conn()
    return _read_table(table, conn)


def _read_table(table: str, conn) -> dict | list:
    if table == "profiles":
        rows = conn.execute("SELECT * FROM profiles").fetchall()
        return {r["session_id"]: {
            "school": r["school"], "major": r["major"], "grade": r["grade"],
            "goal": r["goal"],
            "skills": r["skills"] if "skills" in r.keys() else "",
            "experience": r["experience"] if "experience" in r.keys() else "",
            "interests": r["interests"] if "interests" in r.keys() else "",
            "achievements": r["achievements"] if "achievements" in r.keys() else "",
            "balance": r["balance"],
            "free_trial_granted": bool(r["free_trial_granted"]),
            "updated_at": r["updated_at"],
        } for r in rows}

    if table == "conversations":
        rows = conn.execute("SELECT * FROM conversations").fetchall()
        result = {}
        for r in rows:
            sid = r["session_id"]
            if sid not in result:
                result[sid] = {}
            result[sid][r["conv_id"]] = {
                "id": r["conv_id"],
                "title": r["title"],
                "mode": r["mode"],
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
                "messages": json.loads(r["messages"]),
                "summary": r["summary"] if "summary" in r.keys() else "",
            }
        return result

    if table == "session_tokens":
        rows = conn.execute("SELECT * FROM session_tokens").fetchall()
        return {r["session_id"]: {"token": r["token"], "created_at": r["created_at"]} for r in rows}

    if table == "users":
        rows = conn.execute("SELECT * FROM users").fetchall()
        return {r["user_id"]: {
            "email": r["email"], "phone": r["phone"],
            "password_hash": r["password_hash"], "session_id": r["session_id"],
            "created_at": r["created_at"], "updated_at": r["updated_at"],
            "reset_token": r["reset_token"], "reset_token_expires": r["reset_token_expires"],
        } for r in rows}

    if table == "custom_categories":
        rows = conn.execute("SELECT * FROM custom_categories").fetchall()
        result = {}
        for r in rows:
            sid = r["session_id"]
            if sid not in result:
                result[sid] = {}
            result[sid][r["name"]] = {
                "description": r["description"],
                "created_at": r["created_at"],
            }
        return result

    if table == "recharge_codes":
        rows = conn.execute("SELECT * FROM recharge_codes").fetchall()
        return [{
            "code": r["code"], "value": r["value"], "used": bool(r["used"]),
            "used_by": r["used_by"], "used_at": r["used_at"], "created_at": r["created_at"],
        } for r in rows]

    if table == "payments":
        rows = conn.execute("SELECT * FROM payments").fetchall()
        return {r["order_id"]: {
            "session_id": r["session_id"], "amount_yuan": r["amount_yuan"],
            "status": r["status"], "created_at": r["created_at"],
            "paid_at": r["paid_at"], "trade_no": r["trade_no"],
        } for r in rows}

    if table == "announcements":
        rows = conn.execute("SELECT * FROM announcements ORDER BY created_at DESC").fetchall()
        return [{
            "id": r["id"], "title": r["title"], "content": r["content"],
            "target": r["target"], "created_at": r["created_at"],
            "active": bool(r["active"]),
        } for r in rows]

    return {} if path.suffix == ".json" else []


def write_all(path: Path, data: dict | list):
    """将完整数据写入 SQLite 表（全量替换，等效原 JSON 重写）"""
    table = _table_for(path)
    if table is None:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        return

    conn = _get_conn()
    conn.execute("BEGIN")
    try:
        _write_table(table, conn, data)
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def _write_table(table: str, conn, data: dict | list):
    if table == "profiles":
        conn.execute("DELETE FROM profiles")
        for sid, prof in data.items():
            conn.execute(
                """INSERT INTO profiles
                   (session_id, school, major, grade, goal, skills, experience, interests, achievements, balance, free_trial_granted, updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                (sid, prof.get("school", ""), prof.get("major", ""),
                 prof.get("grade", ""), prof.get("goal", ""),
                 prof.get("skills", ""), prof.get("experience", ""),
                 prof.get("interests", ""), prof.get("achievements", ""),
                 prof.get("balance", 0), 1 if prof.get("free_trial_granted") else 0,
                 prof.get("updated_at", "")),
            )

    elif table == "conversations":
        conn.execute("DELETE FROM conversations")
        for sid, convs in data.items():
            for cid, conv in convs.items():
                msgs = json.dumps(conv.get("messages", []), ensure_ascii=False)
                conn.execute(
                    """INSERT INTO conversations
                       (session_id, conv_id, title, mode, created_at, updated_at, messages, summary)
                       VALUES (?,?,?,?,?,?,?,?)""",
                    (sid, cid, conv.get("title", "新对话"), conv.get("mode", ""),
                     conv.get("created_at", ""), conv.get("updated_at", ""), msgs,
                     conv.get("summary", "")),
                )

    elif table == "session_tokens":
        conn.execute("DELETE FROM session_tokens")
        for sid, sd in data.items():
            conn.execute(
                "INSERT INTO session_tokens VALUES (?,?,?)",
                (sid, sd.get("token", ""), sd.get("created_at", "")),
            )

    elif table == "users":
        conn.execute("DELETE FROM users")
        for uid, u in data.items():
            conn.execute(
                """INSERT INTO users
                   (user_id, email, phone, password_hash, session_id,
                    created_at, updated_at, reset_token, reset_token_expires)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (uid, u.get("email", ""), u.get("phone", ""),
                 u.get("password_hash", ""), u.get("session_id", ""),
                 u.get("created_at", ""), u.get("updated_at", ""),
                 u.get("reset_token", ""), u.get("reset_token_expires", "")),
            )

    elif table == "custom_categories":
        conn.execute("DELETE FROM custom_categories")
        for sid, cats in data.items():
            for name, info in cats.items():
                conn.execute(
                    "INSERT INTO custom_categories VALUES (?,?,?,?)",
                    (sid, name, info.get("description", ""), info.get("created_at", "")),
                )

    elif table == "recharge_codes":
        conn.execute("DELETE FROM recharge_codes")
        for c in data:
            conn.execute(
                """INSERT INTO recharge_codes
                   (code, value, used, used_by, used_at, created_at)
                   VALUES (?,?,?,?,?,?)""",
                (c["code"], c.get("value", 0), 1 if c.get("used") else 0,
                 c.get("used_by", ""), c.get("used_at", ""), c.get("created_at", "")),
            )

    elif table == "payments":
        conn.execute("DELETE FROM payments")
        for oid, pay in data.items():
            conn.execute(
                """INSERT INTO payments
                   (order_id, session_id, amount_yuan, status, created_at, paid_at, trade_no)
                   VALUES (?,?,?,?,?,?,?)""",
                (oid, pay.get("session_id", ""), pay.get("amount_yuan", 0),
                 pay.get("status", ""), pay.get("created_at", ""),
                 pay.get("paid_at", ""), pay.get("trade_no", "")),
            )

    elif table == "announcements":
        conn.execute("DELETE FROM announcements")
        for ann in data:
            conn.execute(
                "INSERT INTO announcements VALUES (?,?,?,?,?,?)",
                (ann["id"], ann.get("title", ""), ann.get("content", ""),
                 ann.get("target", "all"), ann.get("created_at", ""),
                 1 if ann.get("active", True) else 0),
            )


# ── 单行读写（用于不需要全量读写的场景） ──

def read_profile(session_id: str) -> dict | None:
    rows = _get_conn().execute("SELECT * FROM profiles WHERE session_id=?", (session_id,)).fetchall()
    if not rows:
        return None
    r = rows[0]
    return {
        "school": r["school"], "major": r["major"], "grade": r["grade"],
        "goal": r["goal"],
        "skills": r["skills"] if "skills" in r.keys() else "",
        "experience": r["experience"] if "experience" in r.keys() else "",
        "interests": r["interests"] if "interests" in r.keys() else "",
        "achievements": r["achievements"] if "achievements" in r.keys() else "",
        "balance": r["balance"],
        "free_trial_granted": bool(r["free_trial_granted"]),
        "updated_at": r["updated_at"],
    }


def upsert_profile(session_id: str, data: dict):
    existing = read_profile(session_id) or {}
    merged = {**existing, **data}
    conn = _get_conn()
    conn.execute(
        """INSERT OR REPLACE INTO profiles
           (session_id, school, major, grade, goal, skills, experience, interests, achievements, balance, free_trial_granted, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        (session_id, merged.get("school", ""), merged.get("major", ""),
         merged.get("grade", ""), merged.get("goal", ""),
         merged.get("skills", ""), merged.get("experience", ""),
         merged.get("interests", ""), merged.get("achievements", ""),
         merged.get("balance", 0), 1 if merged.get("free_trial_granted") else 0,
         merged.get("updated_at", "")),
    )
    conn.commit()


def read_conversations_for_session(session_id: str) -> list:
    rows = _get_conn().execute(
        "SELECT * FROM conversations WHERE session_id=? ORDER BY updated_at DESC",
        (session_id,),
    ).fetchall()
    return [{
        "id": r["conv_id"],
        "title": r["title"],
        "mode": r["mode"],
        "created_at": r["created_at"],
        "updated_at": r["updated_at"],
        "message_count": len(json.loads(r["messages"])),
        "messages": json.loads(r["messages"]),
        "summary": r["summary"] if "summary" in r.keys() else "",
    } for r in rows]


def upsert_conversation(session_id: str, conv_data: dict):
    conn = _get_conn()
    msgs = json.dumps(conv_data.get("messages", []), ensure_ascii=False)
    conn.execute(
        """INSERT OR REPLACE INTO conversations
           (session_id, conv_id, title, mode, created_at, updated_at, messages, summary)
           VALUES (?,?,?,?,?,?,?,?)""",
        (session_id, conv_data["id"], conv_data.get("title", "新对话"),
         conv_data.get("mode", ""), conv_data.get("created_at", ""),
         conv_data.get("updated_at", ""), msgs, conv_data.get("summary", "")),
    )
    conn.commit()


def delete_conversation_row(session_id: str, conv_id: str):
    conn = _get_conn()
    conn.execute("DELETE FROM conversations WHERE session_id=? AND conv_id=?", (session_id, conv_id))
    conn.commit()


def get_session_token(session_id: str) -> str | None:
    rows = _get_conn().execute(
        "SELECT token FROM session_tokens WHERE session_id=?", (session_id,)
    ).fetchall()
    return rows[0]["token"] if rows else None


def upsert_session_token(session_id: str, token: str, created_at: str):
    conn = _get_conn()
    conn.execute(
        "INSERT OR REPLACE INTO session_tokens VALUES (?,?,?)",
        (session_id, token, created_at),
    )
    conn.commit()


def add_balance_sql(session_id: str, amount: int):
    conn = _get_conn()
    cursor = conn.execute(
        "UPDATE profiles SET balance = MAX(0, balance + ?) WHERE session_id=?",
        (amount, session_id),
    )
    if cursor.rowcount == 0:
        conn.execute(
            "INSERT INTO profiles (session_id, balance) VALUES (?,?)",
            (session_id, max(0, amount)),
        )
    conn.commit()


def get_balance_sql(session_id: str) -> int:
    rows = _get_conn().execute(
        "SELECT balance FROM profiles WHERE session_id=?", (session_id,)
    ).fetchall()
    return rows[0]["balance"] if rows else 0


def deduct_balance_sql(session_id: str, cost: int) -> bool:
    """扣费，余额不足返回 False"""
    conn = _get_conn()
    cursor = conn.execute(
        "UPDATE profiles SET balance = balance - ? WHERE session_id=? AND balance >= ?",
        (cost, session_id, cost),
    )
    conn.commit()
    return cursor.rowcount == 1


def redeem_recharge_code_sql(session_id: str, code: str) -> tuple[str, int]:
    """原子兑换充值码，返回 (status, value)。"""
    conn = _get_conn()
    try:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            "SELECT value, used FROM recharge_codes WHERE code=?",
            (code,),
        ).fetchone()
        if row is None:
            conn.rollback()
            return "invalid", 0
        if row["used"]:
            conn.rollback()
            return "used", 0
        cursor = conn.execute(
            """UPDATE recharge_codes
               SET used=1, used_by=?, used_at=?
               WHERE code=? AND used=0""",
            (session_id, datetime.now().isoformat(), code),
        )
        if cursor.rowcount != 1:
            conn.rollback()
            return "used", 0
        conn.commit()
        return "ok", int(row["value"])
    except Exception:
        conn.rollback()
        raise


# ── Session Memory (shared across workers) ──

def read_session_memory(session_id: str) -> dict | None:
    """读取会话内存（方向、当前对话ID、历史记录）"""
    rows = _get_conn().execute(
        "SELECT * FROM session_memory WHERE session_id=?", (session_id,)
    ).fetchall()
    if not rows:
        return None
    r = rows[0]
    return {
        "direction": r["direction"] or "",
        "conv_id": r["conv_id"] or "",
        "history": json.loads(r["history"]) if r["history"] else [],
        "assessment_intake": json.loads(r["assessment_intake"])
        if r["assessment_intake"] else None,
    }


def upsert_session_memory(session_id: str, data: dict):
    """保存会话内存"""
    conn = _get_conn()
    conn.execute(
        """INSERT OR REPLACE INTO session_memory
           (session_id, direction, conv_id, history, assessment_intake)
           VALUES (?,?,?,?,?)""",
        (session_id, data.get("direction", ""), data.get("conv_id", ""),
         json.dumps(data.get("history", []), ensure_ascii=False),
         json.dumps(data.get("assessment_intake"), ensure_ascii=False)
         if data.get("assessment_intake") else ""),
    )
    conn.commit()


# ── Single conversation read ──

def read_conversation(session_id: str, conv_id: str) -> dict | None:
    """读取单个对话"""
    rows = _get_conn().execute(
        "SELECT * FROM conversations WHERE session_id=? AND conv_id=?",
        (session_id, conv_id),
    ).fetchall()
    if not rows:
        return None
    r = rows[0]
    return {
        "id": r["conv_id"],
        "title": r["title"],
        "mode": r["mode"],
        "created_at": r["created_at"],
        "updated_at": r["updated_at"],
        "messages": json.loads(r["messages"]),
        "summary": r["summary"] if "summary" in r.keys() else "",
    }


# ── Custom Categories (single-row) ──

def read_custom_categories_for_session(session_id: str) -> dict:
    """读取某个用户的自定义方向"""
    rows = _get_conn().execute(
        "SELECT * FROM custom_categories WHERE session_id=?", (session_id,)
    ).fetchall()
    return {r["name"]: {"description": r["description"], "created_at": r["created_at"]} for r in rows}


def upsert_custom_category(session_id: str, name: str, description: str, created_at: str):
    """添加或更新自定义方向"""
    conn = _get_conn()
    conn.execute(
        "INSERT OR REPLACE INTO custom_categories VALUES (?,?,?,?)",
        (session_id, name, description, created_at),
    )
    conn.commit()
