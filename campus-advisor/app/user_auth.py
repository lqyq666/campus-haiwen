"""用户注册/登录/密码找回模块"""
import hashlib
import hmac
import secrets
import logging
from datetime import datetime, timedelta

from .config import USERS_FILE
from .db import locked_read_json, locked_write_json

logger = logging.getLogger(__name__)

# ── 密码哈希 ──

def hash_password(password: str) -> str:
    """使用 pbkdf2_hmac_sha256 哈希密码，返回格式: pbkdf2:sha256:iterations$salt$hash"""
    salt = secrets.token_hex(16)
    iterations = 600_000
    pwd_hash = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), iterations)
    return f"pbkdf2:sha256:{iterations}${salt}${pwd_hash.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    """验证密码是否匹配存储的哈希"""
    try:
        parts = hashed.split("$")
        if len(parts) != 3:
            return False
        meta, salt, stored_hash = parts
        algo_info = meta.split(":")
        if len(algo_info) != 3:
            return False
        _, algo, iterations_str = algo_info
        iterations = int(iterations_str)
        pwd_hash = hashlib.pbkdf2_hmac(algo, password.encode(), salt.encode(), iterations)
        return hmac.compare_digest(pwd_hash.hex(), stored_hash)
    except (ValueError, IndexError):
        return False


# ── 用户数据读写 ──

def _load_users() -> dict:
    # SQLite is the source of truth; the legacy JSON file may not exist in a
    # clean release after migration.
    return locked_read_json(USERS_FILE)


def _save_users(users: dict):
    locked_write_json(USERS_FILE, users)


# ── 用户操作 ──

def register_user(email: str, phone: str, password: str) -> dict:
    """注册新用户。返回 {ok, user_id, message}"""
    if not email and not phone:
        return {"ok": False, "message": "Email or phone number cannot both be empty"}

    users = _load_users()

    # 检查重复
    email = email.strip().lower()
    phone = phone.strip()
    for uid, u in users.items():
        if email and u.get("email", "").lower() == email:
            return {"ok": False, "message": "This email is already registered"}
        if phone and u.get("phone", "") == phone:
            return {"ok": False, "message": "This phone number is already registered"}

    if len(password) < 6:
        return {"ok": False, "message": "Password must be at least 6 characters"}

    user_id = "user_" + secrets.token_hex(12)
    users[user_id] = {
        "email": email,
        "phone": phone,
        "password_hash": hash_password(password),
        "session_id": "",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "reset_token": "",
        "reset_token_expires": "",
    }
    _save_users(users)
    logger.info(f"New user registered: {user_id} ({email or phone})")
    return {"ok": True, "user_id": user_id, "message": "Registration successful"}


def authenticate_user(email: str, phone: str, password: str) -> dict:
    """验证用户登录。返回 {ok, user_id, message}"""
    if not email and not phone:
        return {"ok": False, "message": "Please enter email or phone number"}

    users = _load_users()
    email = email.strip().lower()
    phone = phone.strip()

    for uid, u in users.items():
        if email and u.get("email", "").lower() == email:
            if verify_password(password, u["password_hash"]):
                return {"ok": True, "user_id": uid, "message": "Login successful"}
            return {"ok": False, "message": "Wrong password"}
        if phone and u.get("phone", "") == phone:
            if verify_password(password, u["password_hash"]):
                return {"ok": True, "user_id": uid, "message": "Login successful"}
            return {"ok": False, "message": "Wrong password"}

    return {"ok": False, "message": "User not found"}


def get_user(user_id: str) -> dict | None:
    """根据 user_id 获取用户信息（不包含密码哈希）"""
    users = _load_users()
    u = users.get(user_id)
    if not u:
        return None
    # 返回不含密码哈希的副本
    return {k: v for k, v in u.items() if k != "password_hash"}


def update_user_session(user_id: str, session_id: str):
    """更新用户关联的 session_id"""
    users = _load_users()
    if user_id in users:
        users[user_id]["session_id"] = session_id
        users[user_id]["updated_at"] = datetime.now().isoformat()
        _save_users(users)


def find_user_by_account(account: str) -> dict | None:
    """通过邮箱或手机号查找用户（包含密码哈希，仅内部使用）"""
    users = _load_users()
    account = account.strip().lower()
    for uid, u in users.items():
        if u.get("email", "").lower() == account or u.get("phone", "") == account:
            return {"user_id": uid, **u}
    return None


# ── 密码重置 ──

def generate_reset_token(account: str) -> dict:
    """生成密码重置 token，返回 {ok, message, token}"""
    user_data = find_user_by_account(account)
    if not user_data:
        return {"ok": False, "message": "Account not registered", "token": ""}

    user_id = user_data["user_id"]
    token = secrets.token_hex(32)
    expires = (datetime.now() + timedelta(minutes=30)).isoformat()

    users = _load_users()
    users[user_id]["reset_token"] = token
    users[user_id]["reset_token_expires"] = expires
    _save_users(users)

    logger.info("Password reset token generated: user=%s, expires=%s", user_id, expires)
    return {
        "ok": True,
        "message": "Reset link sent (dev mode: see server logs for token)",
        "token": token,
    }


def verify_reset_token(token: str) -> str | None:
    """验证重置 token，返回 user_id 或 None"""
    users = _load_users()
    for uid, u in users.items():
        if u.get("reset_token") == token:
            expires = u.get("reset_token_expires", "")
            if expires and datetime.fromisoformat(expires) > datetime.now():
                return uid
    return None


def reset_password(token: str, new_password: str) -> dict:
    """使用 token 重置密码。返回 {ok, message}"""
    if len(new_password) < 6:
        return {"ok": False, "message": "Password must be at least 6 characters"}

    user_id = verify_reset_token(token)
    if not user_id:
        return {"ok": False, "message": "Reset link is invalid or expired"}

    users = _load_users()
    users[user_id]["password_hash"] = hash_password(new_password)
    users[user_id]["reset_token"] = ""
    users[user_id]["reset_token_expires"] = ""
    users[user_id]["updated_at"] = datetime.now().isoformat()
    _save_users(users)

    logger.info(f"Password reset: {user_id}")
    return {"ok": True, "message": "Password reset successful"}
