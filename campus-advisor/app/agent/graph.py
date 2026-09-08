"""LangGraph state graph definition for Campus Advisor agent workflow."""

import logging

from langgraph.graph import END, StateGraph

from ..llm import call_llm
from ..session import get_profile, get_session
from .nodes import (
    build_messages,
    classify_intent,
    retrieve_knowledge,
    save_history,
)
from .state import AgentState

logger = logging.getLogger(__name__)


def _route_after_intent(state: dict) -> str:
    """Route to RAG, tools, or direct to generation based on intent."""
    if state.get("requires_rag"):
        return "retrieve"
    if state.get("requires_tools"):
        return "build_msgs"  # tools are called by the LLM in generation
    return "build_msgs"


def _route_after_retrieve(state: dict) -> str:
    """After retrieval, go to build messages."""
    return "build_msgs"


def _route_after_generate(state: dict) -> str:
    """After generation, save history and end."""
    return "save"


def build_agent() -> StateGraph:
    """Build and return the compiled LangGraph agent."""

    workflow = StateGraph(AgentState)

    # Nodes
    workflow.add_node("classify", classify_intent)
    workflow.add_node("retrieve", retrieve_knowledge)
    workflow.add_node("build_msgs", build_messages)
    workflow.add_node("generate", _generate_response)
    workflow.add_node("save", save_history)

    # Edges
    workflow.set_entry_point("classify")

    workflow.add_conditional_edges(
        "classify",
        _route_after_intent,
        {"retrieve": "retrieve", "build_msgs": "build_msgs"},
    )
    workflow.add_conditional_edges(
        "retrieve",
        _route_after_retrieve,
        {"build_msgs": "build_msgs"},
    )
    workflow.add_edge("build_msgs", "generate")
    workflow.add_conditional_edges(
        "generate",
        _route_after_generate,
        {"save": "save"},
    )
    workflow.add_edge("save", END)

    return workflow.compile()


def _generate_response(state: dict) -> dict:
    """Generate LLM response with tool calling support."""
    messages = state.get("messages", [])
    session_id = state["session_id"]

    if not messages:
        return {"response_text": "I'm not sure how to help with that."}

    try:
        text = call_llm(messages)
        return {"response_text": text}
    except Exception as e:
        logger.error("Agent generation failed: %s", e)
        return {"response_text": "Sorry, I encountered an error processing your request."}


# Singleton graph instance
_agent = None


def get_agent():
    """Get or create the compiled agent graph."""
    global _agent
    if _agent is None:
        _agent = build_agent()
        logger.info("LangGraph agent built and compiled.")
    return _agent


def run_agent(
    session_id: str,
    user_message: str,
    conv_id: str = "",
) -> str:
    """Run the agent workflow synchronously. Returns response text."""
    profile = get_profile(session_id)
    session_data = get_session(session_id)

    initial_state: AgentState = {
        "session_id": session_id,
        "user_message": user_message,
        "profile": profile,
        "session_data": session_data,
        "conv_id": conv_id,
        "intent": "",
        "requires_rag": False,
        "requires_tools": False,
        "tool_calls_pending": [],
        "retrieved_chunks": [],
        "messages": [],
        "response_text": "",
    }

    agent = get_agent()
    result = agent.invoke(initial_state)
    return result.get("response_text", "")
