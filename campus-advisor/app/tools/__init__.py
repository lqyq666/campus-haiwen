"""Tool registry and execution — LLM-callable functions for Campus Advisor.

Each tool has a name, description, parameter schema (OpenAI function-calling format),
and a corresponding Python handler.
"""

from typing import Any

from .profile_tools import (
    handle_get_profile,
    handle_get_balance,
    spec_get_profile,
    spec_get_balance,
)
from .knowledge_tools import (
    handle_search_kb,
    spec_search_kb,
)
from .calc_tools import (
    handle_calculate_gpa,
    spec_calculate_gpa,
)

# ── Tool registry ──

TOOL_SPECS = [spec_get_profile, spec_get_balance, spec_search_kb, spec_calculate_gpa]

TOOL_HANDLERS: dict[str, callable] = {
    "get_user_profile": handle_get_profile,
    "check_balance": handle_get_balance,
    "search_knowledge_base": handle_search_kb,
    "calculate_gpa": handle_calculate_gpa,
}


def execute_tool(name: str, args: dict[str, Any], session_id: str | None = None) -> str:
    """Execute a tool by name with given args. Returns a string result."""
    handler = TOOL_HANDLERS.get(name)
    if not handler:
        return f"Error: unknown tool '{name}'"
    try:
        result = handler(**args, session_id=session_id) if session_id else handler(**args)
        return str(result)
    except Exception as e:
        return f"Error executing {name}: {e}"
