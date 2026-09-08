"""LangGraph node implementations for Campus Advisor agent workflow."""

import json
import logging

from ..knowledge_base import search as kb_search
from ..llm import SYSTEM_PROMPT
from ..session import (
    get_menu_text,
    get_profile,
    get_session,
    normalize_message,
    save_message_to_conversation,
)
from ..tools import TOOL_SPECS, execute_tool

logger = logging.getLogger(__name__)

DIRECTION_KEYWORDS_MAP = {
    "grad": "Graduate Admissions",
    "admission": "Graduate Admissions",
    "course": "Course Selection",
    "competition": "Competitions",
    "intern": "Internships",
    "thesis": "Thesis Guidance",
    "learning": "General Learning",
    "skill": "General Learning",
    "保研": "Graduate Admissions",
    "选课": "Course Selection",
    "竞赛": "Competitions",
    "实习": "Internships",
    "论文": "Thesis Guidance",
}


def classify_intent(state: dict) -> dict:
    """Classify user intent: determine category, whether RAG/tools are needed."""
    msg = state["user_message"].lower()
    direction = ""
    for kw, label in DIRECTION_KEYWORDS_MAP.items():
        if kw in msg:
            direction = label
            break

    # Determine if RAG is valuable
    rag_keywords = ["requirement", "process", "how to", "guide", "what is", "explain", "strategy", "tip", "timeline", "format"]
    requires_rag = any(kw in msg for kw in rag_keywords)

    # Determine if tools might be needed
    tool_keywords = ["balance", "point", "credit", "gpa", "calculate", "profile", "my info", "who am i"]
    requires_tools = any(kw in msg for kw in tool_keywords)

    return {
        "intent": direction,
        "requires_rag": requires_rag,
        "requires_tools": requires_tools,
    }


def retrieve_knowledge(state: dict) -> dict:
    """Search knowledge base and inject relevant context."""
    if not state.get("requires_rag"):
        return {"retrieved_chunks": [], "messages": state.get("messages", [])}

    try:
        hits = kb_search(state["user_message"], k=3)
        if hits:
            ctx = "\n\n[Relevant Knowledge]\n" + "\n---\n".join(
                f"{h['content']}" for h in hits
            ) + "\n[/Relevant Knowledge]\nUse the above knowledge if relevant to the user's question."
            logger.info("Agent RAG: %d hits for '%s'", len(hits), state["user_message"][:50])
            return {"retrieved_chunks": hits}
    except Exception as e:
        logger.warning("Agent RAG failed: %s", e)

    return {"retrieved_chunks": []}


def execute_tools_node(state: dict) -> dict:
    """Execute any pending tool calls from the LLM."""
    pending = state.get("tool_calls_pending", [])
    if not pending:
        return {"tool_calls_pending": []}

    results = []
    for tc in pending:
        func_name = tc.get("function", {}).get("name", "")
        try:
            func_args = json.loads(tc.get("function", {}).get("arguments", "{}"))
        except json.JSONDecodeError:
            func_args = {}
        result = execute_tool(func_name, func_args, state["session_id"])
        results.append({"tool_call_id": tc.get("id"), "name": func_name, "result": result})
        logger.info("Agent tool: %s → %s...", func_name, result[:60])

    return {"tool_calls_pending": []}


def build_messages(state: dict) -> dict:
    """Build the LLM message list from current state context."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # RAG context
    chunks = state.get("retrieved_chunks", [])
    if chunks:
        ctx = "\n\n[Relevant Knowledge]\n" + "\n---\n".join(
            f"{h['content']}" for h in chunks
        ) + "\n[/Relevant Knowledge]"
        messages.append({"role": "system", "content": ctx})

    # User profile (including extended memory fields)
    profile = state.get("profile", {})
    MEMORY_FIELDS = ("school", "major", "grade", "goal", "skills", "experience", "interests", "achievements")
    fields = {k: profile.get(k) for k in MEMORY_FIELDS if profile.get(k)}
    if fields:
        info = "【User Info】" + " | ".join(f"{k}: {v}" for k, v in fields.items())
        messages.append({"role": "system", "content": info})

    # Direction / intent
    intent = state.get("intent", "")
    if intent:
        messages.append({"role": "system", "content": f"User's current consultation category: {intent}."})

    # Conversation history
    session_data = state.get("session_data", {})
    history = session_data.get("history", [])
    for h in history[-6:]:
        messages.append({"role": "user", "content": h["user"]})
        messages.append({"role": "assistant", "content": h["assistant"]})

    # User message
    user_msg = normalize_message(state["session_id"], state["user_message"].strip()) if state.get("user_message") else f"Show menu.\n{get_menu_text(state['session_id'])}"
    messages.append({"role": "user", "content": user_msg})

    return {"messages": messages}


def save_history(state: dict) -> dict:
    """Save the conversation to persistent storage."""
    conv_id = state.get("conv_id", "")
    session_id = state["session_id"]
    response_text = state.get("response_text", "")
    user_msg = state.get("user_message", "")

    if conv_id and user_msg and response_text:
        try:
            save_message_to_conversation(session_id, conv_id, "user", user_msg)
            save_message_to_conversation(session_id, conv_id, "assistant", response_text)
        except Exception as e:
            logger.error("Save failed: %s", e)

    # Update in-memory session
    sess = get_session(session_id)
    if user_msg and response_text:
        sess["history"].append({"user": user_msg, "assistant": response_text})
        sess["conv_id"] = conv_id

    return {}
