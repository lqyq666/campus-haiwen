import unittest
from unittest.mock import Mock, patch

import httpx

from app.haiwen_client import _post, create_or_update_lead, run_assessment, track_event


class HaiwenClientContractTests(unittest.TestCase):
    @patch("app.haiwen_client._post")
    def test_requests_and_validates_assessment_v02(self, post):
        post.return_value = {
            "profile": {},
            "report": {"reportVersion": "assessment-report-v0.2"},
        }
        run_assessment({"grade": "SOPHOMORE"}, 2028)
        self.assertEqual(post.call_args.args[1]["assessmentVersion"], "assessment-v0.2")

    @patch("app.haiwen_client._post")
    def test_event_delivery_accepts_idempotent_duplicate(self, post):
        post.return_value = {"status": "DUPLICATE"}
        self.assertTrue(track_event({"eventId": "event-1"}))
        self.assertEqual(post.call_args.args[1]["schemaVersion"], "analytics-event-v0.2")

    @patch("app.haiwen_client._post")
    def test_lead_submission_uses_a_short_single_attempt(self, post):
        post.return_value = {"leadId": "lead-1"}

        create_or_update_lead(
            assessment_id="assessment-1",
            contact={},
            profile={},
            report={},
            request_consultation=True,
            advisor_context={"currentConcern": "不会选学校"},
        )

        self.assertFalse(post.call_args.kwargs["retryable"])
        self.assertEqual(post.call_args.kwargs["timeout_seconds"], 10)
        self.assertEqual(post.call_args.args[1]["advisorContext"], {"currentConcern": "不会选学校"})

    @patch("app.haiwen_client.httpx.post")
    def test_retryable_post_retries_one_transport_failure(self, post):
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {"status": "INGESTED"}
        post.side_effect = [httpx.ConnectError("offline"), response]
        self.assertEqual(_post("https://example.invalid", {"eventId": "e1"}, retryable=True), {"status": "INGESTED"})
        self.assertEqual(post.call_count, 2)

    @patch("app.haiwen_client.httpx.post")
    def test_non_retryable_post_does_not_repeat_transport_failure(self, post):
        post.side_effect = httpx.ConnectError("offline")
        with self.assertRaisesRegex(RuntimeError, "temporarily unavailable"):
            _post("https://example.invalid", {})
        self.assertEqual(post.call_count, 1)
