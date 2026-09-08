"""支付系统（XORPay 虎皮椒）"""
import hashlib
import json
import logging
import secrets
from datetime import datetime

import httpx

from .config import (
    XORPAY_PID, XORPAY_KEY, XORPAY_API_URL,
    PAYMENT_NOTIFY_URL, PAYMENT_ENABLED, MOCK_PAYMENT, PAYMENTS_FILE,
)
from .db import locked_read_json, locked_write_json

logger = logging.getLogger(__name__)


def generate_order_id() -> str:
    """生成唯一订单号"""
    return f"ORD{datetime.now().strftime('%y%m%d%H%M%S')}{secrets.token_hex(3).upper()}"


def load_orders() -> dict:
    return locked_read_json(PAYMENTS_FILE)

def save_orders(data: dict):
    locked_write_json(PAYMENTS_FILE, data)


def create_payment(session_id: str, plan_yuan: int) -> dict:
    """创建支付订单。返回 {ok, order_id, pay_url?, message, mock?}"""
    if not PAYMENT_ENABLED:
        return {"ok": False, "message": "Payment feature is not enabled"}

    # ── 模拟支付（本地开发） ──
    if MOCK_PAYMENT:
        order_id = generate_order_id()
        orders = load_orders()
        orders[order_id] = {
            "session_id": session_id,
            "amount_yuan": plan_yuan,
            "status": "paid",
            "created_at": datetime.now().isoformat(),
            "paid_at": datetime.now().isoformat(),
            "trade_no": f"MOCK{secrets.token_hex(4).upper()}",
        }
        save_orders(orders)
        # 立即加余额
        from .session import add_balance
        add_balance(session_id, plan_yuan * 100)
        logger.info(f"Mock payment: +{plan_yuan*100}分 for {session_id}")
        return {
            "ok": True,
            "order_id": order_id,
            "pay_url": "",
            "message": f"Mock payment success! Top-up ¥{plan_yuan}, received {plan_yuan * 100} pts",
            "mock": True,
        }

    # ── 真实 XORPay ──
    order_id = generate_order_id()
    notify_url = PAYMENT_NOTIFY_URL

    # 保存待支付订单
    orders = load_orders()
    orders[order_id] = {
        "session_id": session_id,
        "amount_yuan": plan_yuan,
        "status": "pending",
        "created_at": datetime.now().isoformat(),
        "paid_at": "",
        "trade_no": "",
    }
    save_orders(orders)

    # 计算签名: MD5(order_id + key)
    sign_str = order_id + XORPAY_KEY
    sign = hashlib.md5(sign_str.encode()).hexdigest()

    # 调用 XORPay API
    url = XORPAY_API_URL.format(pid=XORPAY_PID)
    payload = {
        "name": f"Campus Advisor Top-up ¥{plan_yuan}",
        "pay_type": "3",  # 微信+支付宝
        "price": f"{plan_yuan}.00",
        "order_id": order_id,
        "notify_url": notify_url,
        "sign": sign,
    }

    try:
        with httpx.Client(proxy=None, verify=True, timeout=30) as client:
            resp = client.post(url, data=payload)
            data = resp.json()
            if data.get("status") == 0:
                return {
                    "ok": True,
                    "order_id": order_id,
                    "pay_url": data["pay_url"],
                    "message": "Payment order created successfully",
                }
            else:
                logger.error(f"XORPay create failed: {data}")
                return {"ok": False, "message": f"Payment creation failed: {data.get('msg', 'Unknown error')}"}
    except Exception as e:
        logger.error(f"XORPay request error: {e}")
        return {"ok": False, "message": "Payment service connection failed"}


def get_order_status(order_id: str) -> dict:
    """查询订单状态"""
    orders = load_orders()
    order = orders.get(order_id)
    if not order:
        return {"status": "not_found"}
    return {
        "status": order["status"],
        "amount_yuan": order.get("amount_yuan"),
        "paid_at": order.get("paid_at"),
    }


def verify_callback(data: dict) -> tuple[bool, dict]:
    """验证支付回调签名。返回 (ok, order_data)"""
    # 回调参数: order_id, price, pay_type, trade_no, sign
    order_id = data.get("order_id", "")
    price = data.get("price", "")
    pay_type = data.get("pay_type", "")
    trade_no = data.get("trade_no", "")
    sign = data.get("sign", "")

    # 验证签名: MD5(order_id + price + pay_type + trade_no + key)
    sign_str = order_id + price + pay_type + trade_no + XORPAY_KEY
    expected = hashlib.md5(sign_str.encode()).hexdigest()
    if sign != expected:
        logger.warning(f"Callback sign mismatch for {order_id}")
        return False, {}

    orders = load_orders()
    order = orders.get(order_id)
    if not order:
        logger.warning(f"Callback for unknown order {order_id}")
        return False, {}

    if order["status"] == "paid":
        return True, order  # 已经处理过

    # 标记已支付
    order["status"] = "paid"
    order["paid_at"] = datetime.now().isoformat()
    order["trade_no"] = trade_no
    order["pay_type"] = pay_type
    orders[order_id] = order
    save_orders(orders)
    return True, order
