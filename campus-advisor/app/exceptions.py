"""Unified exception + response helpers"""

class AppException(Exception):
    """Business exception, caught by handler and converted to unified JSON response"""
    def __init__(self, status_code: int = 400, message: str = "Bad request", code: str = "BAD_REQUEST"):
        self.status_code = status_code
        self.message = message
        self.code = code


def ok(data: dict = None, **kwargs) -> dict:
    """Unified success response. kwargs are spread to top-level, ensuring ok: true is present.

    Usage:
        return ok({"session_id": "s_xxx", "token": "xxx"})
        # → {"ok": true, "session_id": "s_xxx", "token": "xxx"}
    """
    result = {"ok": True}
    if data is not None:
        # Spread all keys from data dict to top level
        result.update(data)
    result.update(kwargs)  # explicit keyword args override same-named keys in data
    return result
