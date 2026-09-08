"""数据读写层 — SQLite 实现（兼容旧 JSON 接口）

提供 locked_read_json / locked_write_json 两个函数，
行为与原 JSON 文件读写完全一致（读→改→写），但底层使用 SQLite。
首次启动自动从 JSON 迁移数据。
"""

import json
import logging
from pathlib import Path

from .database import init as _init_db, read_all, write_all

logger = logging.getLogger(__name__)

# 数据库初始化标志
_db_initialized = False


def _ensure_db():
    global _db_initialized
    if not _db_initialized:
        _init_db()
        _db_initialized = True


def locked_read_json(path: Path) -> dict | list:
    """读全部数据（等效原 JSON 全量读取）"""
    _ensure_db()
    try:
        return read_all(path)
    except Exception as e:
        logger.warning(f"SQLite read failed for {path.name}, fallback JSON: {e}")
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        return {} if path.suffix == ".json" else []


def locked_write_json(path: Path, data: dict | list):
    """写全部数据（等效原 JSON 全量写入）"""
    _ensure_db()
    try:
        write_all(path, data)
    except Exception as e:
        logger.error(f"SQLite write failed for {path.name}: {e}")
        raise
