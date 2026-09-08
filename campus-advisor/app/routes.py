"""Campus channel endpoints; Haiwen remains the decision and CRM source of truth."""
import os
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from .assessment_intake import (
    _format_report,
    FOLLOW_UP_RULES,
    assemble_student_profile,
    handle_assessment_intake,
    input_spec,
)
from .assessment_store import (
    append_history,
    create_session,
    get_completed_assessment,
    get_history,
    get_intake,
    save_completed_assessment,
    save_intake,
    save_lead_submission,
    session_guard,
    validate_session,
)
from .haiwen_client import HaiwenClientError, create_or_update_lead, run_assessment, track_event
from .rate_limit import limiter

router = APIRouter()


class AssessmentIntakeRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2_000)
    session_id: str = Field(min_length=3, max_length=128)


class LeadContactRequest(BaseModel):
    email: str = Field(default="", max_length=254)
    name: str = Field(default="", max_length=64)
    phone: str = Field(default="", max_length=32)
    qq: str = Field(default="", max_length=32)
    wechat: str = Field(default="", max_length=32)


class LeadRequest(BaseModel):
    consent: bool = False
    contact: LeadContactRequest
    request_consultation: bool = False
    session_id: str = Field(min_length=3, max_length=128)


class AnalyticsEventRequest(BaseModel):
    event_id: str = Field(min_length=1, max_length=128)
    event_type: str = Field(min_length=1, max_length=64)
    metadata: dict[str, Any] = Field(default_factory=dict)
    program_id: str | None = Field(default=None, max_length=128)
    session_id: str = Field(min_length=3, max_length=128)


BROWSER_EVENT_TYPES = {
    "REPORT_VIEWED",
    "SCORE_EXPLANATION_OPENED",
    "PROGRAM_OPENED",
    "EVIDENCE_OPENED",
    "REVIEW_CTA_CLICKED",
    "CONTACT_FORM_STARTED",
}
SENSITIVE_EVENT_METADATA_KEYS = {"contact", "email", "name", "phone", "qq", "wechat"}


def _cohort_tag() -> str:
    return os.environ.get("CAMPUS_COHORT_TAG", "pilot_001_cdut")


def _track(session_id: str, event_id: str, event_type: str, **optional: Any) -> bool:
    event = {
        "cohortTag": _cohort_tag(),
        "eventId": event_id,
        "eventType": event_type,
        "occurredAt": datetime.now(timezone.utc).isoformat(),
        "sessionId": session_id,
        **{key: value for key, value in optional.items() if value is not None},
    }
    return track_event(event)


def _require_session(session_id: str, token: str) -> None:
    if not validate_session(session_id, token):
        raise HTTPException(status_code=401, detail="Invalid assessment session")


def _limit(request: Request, scope: str, limit: int, window_seconds: int, session_id: str = "") -> None:
    client = request.client.host if request.client else "unknown"
    key = f"{scope}:{client}:{session_id}"
    allowed, retry_after = limiter.allow(key, limit, window_seconds)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="请求过于频繁，请稍后重试。",
            headers={"Retry-After": str(retry_after)},
        )


def _contact_payload(request: LeadRequest) -> dict[str, Any]:
    contact = request.contact.model_dump()
    contact = {key: value.strip() for key, value in contact.items()}
    if not contact["wechat"]:
        raise HTTPException(status_code=400, detail="请填写微信号后再提交")
    return {
        "consentToContact": request.consent,
        "email": contact["email"],
        "name": contact["name"],
        "phone": contact["phone"],
        "qq": contact["qq"],
        "wechat": contact["wechat"],
    }


@router.post("/api/session/init", summary="Create an assessment session")
def api_init_session(request: Request):
    # Campus Wi-Fi commonly places many students behind one public IP.
    _limit(request, "session-init", 300, 3600)
    session = create_session()
    _track(session["session_id"], f'{session["session_id"]}:SESSION_CREATED', "SESSION_CREATED")
    return session


@router.post("/api/assessment/intake", summary="Advance guided assessment collection")
def api_assessment_intake(payload: AssessmentIntakeRequest, request: Request, x_session_token: str = Header("")):
    _require_session(payload.session_id, x_session_token)
    _limit(request, "assessment-intake", 90, 600, payload.session_id)
    with session_guard(payload.session_id):
        return _advance_assessment_intake(payload)


def _advance_assessment_intake(request: AssessmentIntakeRequest):
    previous_state = get_intake(request.session_id)
    previous_step = previous_state.get("step") if previous_state else None
    answer_index = previous_state.get("answer_count", 0) if previous_state else 0
    state, reply, _ = handle_assessment_intake(request.message, previous_state)
    assessment = None
    done = False
    retry_available = False

    if state and state.get("step") == "submit":
        profile = assemble_student_profile(state["profile"])
        try:
            admission_year = int(os.environ.get("CAMPUS_TARGET_ADMISSION_YEAR", "2027"))
            assessment = run_assessment(profile, profile.get("targetAdmissionYear", admission_year))
        except HaiwenClientError:
            save_intake(request.session_id, state)
            reply = "测评服务暂时不可用，请稍后点击“重新尝试”。"
            retry_available = True
        else:
            assessment = {**assessment, "campusContext": state.get("student_context", {})}
            save_completed_assessment(request.session_id, assessment["profile"], assessment)
            reply = _format_report(assessment["report"])
            done = True
    else:
        if state:
            state["answer_count"] = answer_index + (1 if previous_state else 0)
        save_intake(request.session_id, state)

    if previous_state:
        _track(
            request.session_id,
            f"{request.session_id}:QUESTION_ANSWERED:{answer_index + 1}",
            "QUESTION_ANSWERED",
            metadata={"step": previous_step},
        )
    elif state:
        _track(request.session_id, f"{request.session_id}:ASSESSMENT_STARTED", "ASSESSMENT_STARTED")
    follow_up_steps = {rule["step"] for rule in FOLLOW_UP_RULES}
    if state and state.get("step") in follow_up_steps and state.get("step") != previous_step:
        _track(
            request.session_id,
            f'{request.session_id}:FOLLOWUP_QUESTION_SHOWN:{state["step"]}',
            "FOLLOWUP_QUESTION_SHOWN",
            metadata={"step": state["step"]},
        )
    if done:
        _track(request.session_id, f"{request.session_id}:ASSESSMENT_COMPLETED", "ASSESSMENT_COMPLETED")

    reply = reply or "输入“开始升学测评”即可开始。"
    append_history(request.session_id, "user", request.message)
    append_history(request.session_id, "assistant", reply)
    return {
        "assessment": assessment,
        "done": done,
        "input_spec": input_spec(state) if not done else None,
        "reply": reply,
        "retry_available": retry_available,
    }


@router.post("/api/assessment/lead", summary="Submit a completed assessment lead to Haiwen")
def api_assessment_lead(payload: LeadRequest, request: Request, x_session_token: str = Header("")):
    _require_session(payload.session_id, x_session_token)
    _limit(request, "assessment-lead", 10, 3600, payload.session_id)
    with session_guard(payload.session_id):
        return _submit_assessment_lead(payload)


def _submit_assessment_lead(request: LeadRequest):
    completed = get_completed_assessment(request.session_id)
    if not completed:
        raise HTTPException(status_code=409, detail="请先完成升学测评后再提交")
    profile, assessment = completed
    contact = _contact_payload(request)
    try:
        result = create_or_update_lead(
            assessment_id=request.session_id,
            contact=contact,
            profile=profile,
            report=assessment["report"],
            advisor_context=assessment.get("campusContext", {}),
            request_consultation=request.request_consultation,
            session_id=request.session_id,
            cohort_tag=_cohort_tag(),
        )
    except HaiwenClientError:
        raise HTTPException(status_code=503, detail="资料暂时未提交成功，请稍后重试。") from None
    save_lead_submission(request.session_id, result["leadId"], request.request_consultation)
    message = "已提交规划老师复核申请。" if request.request_consultation else "资料已提交。"
    append_history(request.session_id, "assistant", message)
    return {"submitted": True, "consultation_requested": request.request_consultation}


@router.post("/api/assessment/event", summary="Forward a browser event to Haiwen analytics")
def api_assessment_event(payload: AnalyticsEventRequest, request: Request, x_session_token: str = Header("")):
    _require_session(payload.session_id, x_session_token)
    _limit(request, "assessment-event", 120, 3600, payload.session_id)
    if payload.event_type not in BROWSER_EVENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported analytics event")
    if SENSITIVE_EVENT_METADATA_KEYS.intersection(key.lower() for key in payload.metadata):
        raise HTTPException(status_code=400, detail="Sensitive analytics metadata is not allowed")
    delivered = _track(
        payload.session_id,
        payload.event_id,
        payload.event_type,
        metadata=payload.metadata,
        programId=payload.program_id,
    )
    return {"accepted": True, "delivered": delivered}


@router.get("/api/assessment/history", summary="Read this assessment conversation history")
def api_assessment_history(session_id: str, x_session_token: str = Header("")):
    _require_session(session_id, x_session_token)
    return {"messages": get_history(session_id)}
