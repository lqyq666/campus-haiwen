"""充值码系统"""
import secrets
import string
from datetime import datetime

from .config import RECHARGE_CODES_FILE
from .db import locked_read_json, locked_write_json
from .database import redeem_recharge_code_sql


# ── 充值码 ──

def load_recharge_codes() -> list[dict]:
    return locked_read_json(RECHARGE_CODES_FILE)

def save_recharge_codes(codes: list[dict]):
    locked_write_json(RECHARGE_CODES_FILE, codes)

def generate_recharge_codes(count: int = 10, value: int = 1000) -> list[dict]:
    """生成充值码，value 单位是分（¥10=1000）"""
    chars = string.ascii_uppercase + string.digits
    codes = []
    for _ in range(count):
        code = f"CZ-{''.join(secrets.choice(chars) for _ in range(4))}-{''.join(secrets.choice(chars) for _ in range(4))}"
        codes.append({
            "code": code,
            "value": value,
            "used": False,
            "used_by": "",
            "created_at": datetime.now().isoformat(),
        })
    return codes

def redeem_recharge_code(session_id: str, code: str) -> dict:
    """兑换充值码。返回 {ok, value(分), message}"""
    code = code.strip().upper()
    status, value = redeem_recharge_code_sql(session_id, code)
    if status == "used":
        return {"ok": False, "value": 0, "message": "This recharge code has already been used"}
    if status == "invalid":
        return {"ok": False, "value": 0, "message": "Invalid recharge code"}
    return {
        "ok": True,
        "value": value,
        "message": f"Top-up successful! +{value} pts (¥{value/100:.2f})",
    }
