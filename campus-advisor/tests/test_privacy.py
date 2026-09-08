import logging
import unittest

from app.privacy import SensitiveDataFilter, mask_sensitive_text, redact_structured


class PrivacyTests(unittest.TestCase):
    def test_masks_phone_email_and_structured_contact_fields(self):
        self.assertEqual(mask_sensitive_text("13800138000 test@example.com"), "1********** ***@***")
        self.assertEqual(redact_structured({"phone": "13800138000", "safe": "ok"}), {"phone": "[REDACTED]", "safe": "ok"})
        self.assertEqual(redact_structured({"qq": "123456789"}), {"qq": "[REDACTED]"})

    def test_logging_filter_masks_message_and_arguments(self):
        record = logging.LogRecord("test", logging.INFO, "", 1, "phone 13800138000 %s", ("test@example.com",), None)
        SensitiveDataFilter().filter(record)
        self.assertNotIn("13800138000", record.msg)
        self.assertEqual(record.args[0], "***@***")
