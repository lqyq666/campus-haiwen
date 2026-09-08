"""Agent state schema for LangGraph workflow."""

from typing import Any
from typing_extensions import TypedDict


class AgentState(TypedDict):
    """State passed between LangGraph nodes."""

    # Input
    session_id: str
    user_message: str

    # Profile & session context
    profile: dict
    session_data: dict

    # Conversation ID
    conv_id: str

    # Pipeline state
    intent: str  # "grad_admissions" | "course_selection" | "competitions" | etc.
    requires_rag: bool
    requires_tools: bool
    tool_calls_pending: list[dict]

    # Retrieved context
    retrieved_chunks: list[dict[str, Any]]

    # Messages fed to LLM
    messages: list[dict]

    # Final response
    response_text: str
