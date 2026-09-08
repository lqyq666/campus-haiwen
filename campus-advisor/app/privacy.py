"""PII masking for application logs and diagnostic text."""
import logging
import re
from typing import Any

PHONE_PATTERN = re.compile(r"(?<!\d)1\d{10}(?!\d)")
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
SENSITIVE_KEYS = {"contact", "email", "name", "phone", "qq", "wechat"}


def mask_sensitive_text(value: str) -> str:
    value = PHONE_PATTERN.sub("1**********", value)
    return EMAIL_PATTERN.sub("***@***", value)


def redact_structured(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: "[REDACTED]" if str(key).lower() in SENSITIVE_KEYS else redact_structured(item)
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return type(value)(redact_structured(item) for item in value)
    return mask_sensitive_text(value) if isinstance(value, str) else value


class SensitiveDataFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = mask_sensitive_text(str(record.msg))
        record.args = redact_structured(record.args)
        return True


def install_sensitive_logging_filter() -> None:
    root = logging.getLogger()
    for handler in root.handlers:
        if not any(isinstance(item, SensitiveDataFilter) for item in handler.filters):
            handler.addFilter(SensitiveDataFilter())
