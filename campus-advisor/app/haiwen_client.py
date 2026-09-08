"""Server-side adapter for the Haiwen decision and lead APIs."""
import os
from typing import Any

import httpx


class HaiwenClientError(RuntimeError):
    """A safe, user-facing failure from the upstream Haiwen service."""


def _base_url() -> str:
    return os.environ.get("HAIWEN_BASE_URL", "http://127.0.0.1:3011").rstrip("/")


def _assessment_url() -> str:
    return os.environ.get("HAIWEN_ASSESSMENT_URL", f"{_base_url()}/api/assessment")


def _lead_url() -> str:
    return os.environ.get("HAIWEN_LEAD_URL", f"{_base_url()}/api/leads")


def _event_url() -> str:
    return os.environ.get("HAIWEN_EVENT_URL", f"{_base_url()}/api/events")


def _headers() -> dict[str, str]:
    token = os.environ.get("HAIWEN_CAMPUS_API_KEY", "campus-local-channel-v1-2026")
    return {"X-Campus-Channel-Key": token} if token else {}


def _post(
    url: str,
    payload: dict[str, Any],
    *,
    retryable: bool = False,
    timeout_seconds: float = 30,
) -> dict[str, Any]:
    attempts = 2 if retryable else 1
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            response = httpx.post(
                url,
                json=payload,
                headers=_headers(),
                timeout=timeout_seconds,
                trust_env=False,
            )
            response.raise_for_status()
            data = response.json()
            break
        except httpx.HTTPStatusError as error:
            last_error = error
            if error.response.status_code < 500 or attempt + 1 >= attempts:
                raise HaiwenClientError("Haiwen service is temporarily unavailable") from error
        except (httpx.TransportError, ValueError, TypeError) as error:
            last_error = error
            if attempt + 1 >= attempts:
                raise HaiwenClientError("Haiwen service is temporarily unavailable") from error
    else:
        raise HaiwenClientError("Haiwen service is temporarily unavailable") from last_error
    if not isinstance(data, dict):
        raise HaiwenClientError("Haiwen returned an invalid response")
    return data


def run_assessment(profile: dict[str, Any], admission_year: int = 2027) -> dict[str, Any]:
    data = _post(_assessment_url(), {
        "admissionYear": admission_year,
        "assessmentVersion": "assessment-v0.2",
        "profile": profile,
    })
    if not isinstance(data.get("report"), dict) or not isinstance(data.get("profile"), dict):
        raise HaiwenClientError("Haiwen assessment response is incomplete")
    if data["report"].get("reportVersion") != "assessment-report-v0.2":
        raise HaiwenClientError("Haiwen assessment contract version mismatch")
    return data


def create_or_update_lead(
    *, assessment_id: str, contact: dict[str, Any], profile: dict[str, Any], report: dict[str, Any],
    request_consultation: bool, advisor_context: dict[str, Any] | None = None,
    session_id: str | None = None, cohort_tag: str | None = None,
) -> dict[str, Any]:
    data = _post(_lead_url(), {
        "assessmentId": assessment_id,
        "contact": contact,
        "profile": profile,
        "report": report,
        "advisorContext": advisor_context or {},
        "requestConsultation": request_consultation,
        "sessionId": session_id,
        "cohortTag": cohort_tag,
    }, retryable=False, timeout_seconds=10)
    if not isinstance(data.get("leadId"), str):
        raise HaiwenClientError("Haiwen lead response is incomplete")
    return data


def track_event(event: dict[str, Any]) -> bool:
    """Best-effort idempotent analytics delivery; never blocks the student flow."""
    try:
        data = _post(
            _event_url(),
            {"schemaVersion": "analytics-event-v0.2", **event},
            retryable=True,
        )
    except HaiwenClientError:
        return False
    return data.get("status") in {"INGESTED", "DUPLICATE"}
