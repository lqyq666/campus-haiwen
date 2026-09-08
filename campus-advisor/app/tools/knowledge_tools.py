"""Knowledge base search tool — accessible to the LLM via function calling."""

from ..knowledge_base import search as _search

spec_search_kb = {
    "type": "function",
    "function": {
        "name": "search_knowledge_base",
        "description": "Search the university knowledge base for relevant information about graduate admissions, course selection, competitions, internships, thesis writing, and learning strategies.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query — a natural language question or keywords",
                },
            },
            "required": ["query"],
        },
    },
}


def handle_search_kb(query: str = "", **kwargs) -> str:
    if not query:
        return "No query provided."
    results = _search(query, k=3)
    if not results:
        return "No relevant information found in the knowledge base."
    parts = []
    for i, r in enumerate(results, 1):
        parts.append(f"[{i}] {r['content'][:300]}")
    return "\n\n".join(parts)
