"""Profile-related tools — accessible to the LLM via function calling.

Session ID is injected server-side; the LLM never sees it.
"""

from ..session import get_profile, get_balance as _get_balance

spec_get_profile = {
    "type": "function",
    "function": {
        "name": "get_user_profile",
        "description": "Get the user's profile information including school, major, grade, goal, skills, experience, interests, and achievements. Use this to personalize your answers.",
        "parameters": {
            "type": "object",
            "properties": {},
        },
    },
}


def handle_get_profile(session_id: str | None = None, **kwargs) -> str:
    if not session_id:
        return "No profile available."
    prof = get_profile(session_id)
    parts = []
    for key in ("school", "major", "grade", "goal", "skills", "experience", "interests", "achievements"):
        val = prof.get(key)
        if val:
            parts.append(f"{key}: {val}")
    if not parts:
        return "User has not set any profile information yet."
    return " | ".join(parts)


spec_get_balance = {
    "type": "function",
    "function": {
        "name": "check_balance",
        "description": "Check the user's current balance in points and estimated remaining messages.",
        "parameters": {
            "type": "object",
            "properties": {},
        },
    },
}


def handle_get_balance(session_id: str | None = None, **kwargs) -> str:
    if not session_id:
        return "Balance: unknown"
    bal = _get_balance(session_id)
    msgs = max(0, bal // 12)
    return f"Balance: {bal} points (≈{msgs} replies remaining)"
