"""Business logic: session memory, conversation CRUD, profiles, categories, direction detection"""
import hmac
import secrets
import uuid
from datetime import datetime

from .config import (
    CONVERSATIONS_FILE, PROFILES_FILE,
    DIRECTION_KEYWORDS, TITLE_PREFIXES, COST_PER_1K_TOKENS, FREE_TRIAL_AMOUNT,
    MEMORY_LLM_MODEL,
    PROGRESS_STAGES, PROGRESS_THRESHOLDS, ANNOUNCEMENTS_FILE,
)
from .db import locked_read_json, locked_write_json
from . import database as db_sql

# ── Session Memory (SQLite-backed, shared across workers) ──

def get_session(session_id: str) -> dict:
    data = db_sql.read_session_memory(session_id)
    if data is None:
        data = {"direction": "", "history": [], "conv_id": ""}
        db_sql.upsert_session_memory(session_id, data)
    return data


def save_session(session_id: str, data: dict):
    """Save session memory back to SQLite (shared across workers)."""
    db_sql.upsert_session_memory(session_id, data)


# ── Conversation CRUD ──

def load_conversations() -> dict:
    return locked_read_json(CONVERSATIONS_FILE)

def get_user_conversations(session_id: str) -> list:
    convs = db_sql.read_conversations_for_session(session_id)
    result = []
    for c in convs:
        msgs = c.get("messages", [])
        result.append({
            "id": c["id"],
            "title": c.get("title", "新对话"),
            "mode": c.get("mode", ""),
            "created_at": c.get("created_at", ""),
            "updated_at": c.get("updated_at", ""),
            "message_count": len(msgs),
            "summary": c.get("summary", ""),
            "preview": msgs[-1].get("content", "")[:50] if msgs else "",
        })
    return result

def create_conversation(session_id: str, mode: str = "", title: str = "New Chat") -> str:
    conv_id = f"conv_{datetime.now().strftime('%Y%m%d%H%M%S')}_{len(get_user_conversations(session_id))}"
    conv_data = {
        "id": conv_id, "title": title, "mode": mode,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "messages": [], "summary": "",
    }
    db_sql.upsert_conversation(session_id, conv_data)
    sess = get_session(session_id)
    sess["conv_id"] = conv_id
    sess["direction"] = mode
    sess["history"] = []
    save_session(session_id, sess)
    track_visit(session_id)
    return conv_id

def save_message_to_conversation(session_id: str, conv_id: str, role: str, content: str):
    conv = db_sql.read_conversation(session_id, conv_id)
    if conv is None:
        conv = {
            "id": conv_id, "title": "New Chat", "mode": "",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "messages": [], "summary": "",
        }
    conv["messages"].append({"role": role, "content": content, "time": datetime.now().isoformat()})
    conv["updated_at"] = datetime.now().isoformat()
    if role == "user" and conv["title"] == "New Chat":
        conv["title"] = summarize_title(content)
    if not conv.get("summary") and len(conv.get("messages", [])) >= 2:
        summary = generate_conversation_summary(conv["messages"])
        if summary:
            conv["summary"] = summary
    db_sql.upsert_conversation(session_id, conv)
    update_progress(session_id)

def get_conversation(session_id: str, conv_id: str) -> dict | None:
    return db_sql.read_conversation(session_id, conv_id)

def delete_conversation(session_id: str, conv_id: str) -> bool:
    conv = db_sql.read_conversation(session_id, conv_id)
    if conv is None:
        return False
    sess = get_session(session_id)
    if sess.get("conv_id") == conv_id:
        sess["conv_id"] = ""
        sess["direction"] = ""
        sess["history"] = []
        save_session(session_id, sess)
    db_sql.delete_conversation_row(session_id, conv_id)
    return True

def rename_conversation(session_id: str, conv_id: str, title: str) -> bool:
    conv = db_sql.read_conversation(session_id, conv_id)
    if conv is None:
        return False
    conv["title"] = title.strip()
    conv["updated_at"] = datetime.now().isoformat()
    db_sql.upsert_conversation(session_id, conv)
    return True


# ── Title Summarization ──

def summarize_title(text: str) -> str:
    t = text.strip()
    for p in TITLE_PREFIXES:
        if t.startswith(p):
            t = t[len(p):]
            break
    if t.isdigit():
        return f"Inquiry #{t}"
    if len(t) <= 28:
        return t
    for sep in "，。,.;；：:！!？?":
        idx = t.find(sep)
        if 8 <= idx <= 26:
            return t[:idx]
    return t[:26] + "…"


# ── Direction Detection ──

def detect_direction(msg: str) -> str:
    raw = msg.strip()
    lower = raw.lower()
    # Check if message starts with common query prefixes and contains a keyword
    for prefix in ["I want to learn about", "I'd like to know about", "Tell me about",
                   "我想了解", "请问"]:
        if raw.startswith(prefix):
            for kw, dir_name in DIRECTION_KEYWORDS.items():
                if kw.lower() in lower:
                    return dir_name
    if len(raw) <= 6:
        for kw in sorted(DIRECTION_KEYWORDS, key=len, reverse=True):
            if raw == kw or raw == f"{kw}类" or lower == kw.lower():
                return DIRECTION_KEYWORDS[kw]
    # Case-insensitive matching for English keywords
    for kw, dir_name in DIRECTION_KEYWORDS.items():
        if kw.lower() in lower:
            return dir_name
    return ""

def normalize_message(session_id: str, msg: str) -> str:
    msg = msg.strip()
    lower = msg.lower()
    # Custom category creation keywords (Chinese + English)
    if any(kw in lower for kw in ["自定义方向", "创建方向", "新建方向", "添加方向", "定制方向", "新增方向",
                                   "custom category", "create category", "new category", "add category",
                                   "custom direction", "new direction"]):
        return "__CREATE_CATEGORY__"
    if len(msg) <= 6:
        for w in ["保研", "选课", "竞赛", "实习", "通用学习", "论文指导", "论文",
                   "admissions", "course", "competition", "internship", "thesis", "learning"]:
            if msg == w or msg == f"我想了解{w}" or msg == f"{w}类":
                return f"我想了解{w}类"
    # English short-form matching
    lower = msg.lower()
    english_shortcuts = {
        "admissions": "Graduate Admissions", "grad": "Graduate Admissions",
        "course": "Course Selection", "competition": "Competitions", "contest": "Competitions",
        "internship": "Internships", "intern": "Internships",
        "learning": "General Learning", "thesis": "Thesis Guidance",
    }
    if lower in english_shortcuts:
        return english_shortcuts[lower]
    return msg


# ── Profile ──

def load_profiles() -> dict:
    return locked_read_json(PROFILES_FILE)

def save_profile(session_id: str, profile: dict):
    """Save profile using single-row SQLite upsert."""
    profile["updated_at"] = datetime.now().isoformat()
    db_sql.upsert_profile(session_id, profile)

def get_profile(session_id: str) -> dict:
    prof = db_sql.read_profile(session_id)
    if prof is None:
        prof = {}
    for key in ("balance", "skills", "experience", "interests", "achievements"):
        if key not in prof:
            prof[key] = "" if key != "balance" else 0
    return prof

def ensure_free_trial(session_id: str):
    """Grant free trial balance on first visit (once only)"""
    prof = db_sql.read_profile(session_id)
    if prof is None:
        prof = {}
    if not prof.get("free_trial_granted"):
        prof["balance"] = prof.get("balance", 0) + FREE_TRIAL_AMOUNT
        prof["free_trial_granted"] = True
        prof["updated_at"] = datetime.now().isoformat()
        db_sql.upsert_profile(session_id, prof)

def estimate_tokens(text: str) -> int:
    """Estimate token count for text.
    Chinese ~1.5-2 chars/token, English ~3-4 chars/token.
    Conservative estimate: len//2 + 1.
    """
    if not text:
        return 1
    return max(1, len(text) // 2 + 1)

def calc_cost(text: str) -> int:
    """Calculate cost for a text segment (in pts)"""
    tokens = estimate_tokens(text)
    return max(1, tokens * COST_PER_1K_TOKENS // 1000)

def deduct_cost(session_id: str, text: str) -> tuple[bool, int, int]:
    """Deduct based on text length. Returns (success, cost_pts, estimated_tokens)"""
    cost = calc_cost(text)
    tokens = estimate_tokens(text)
    ok = db_sql.deduct_balance_sql(session_id, cost)
    return ok, cost, tokens

def add_balance(session_id: str, amount: int):
    """Add balance (in pts)"""
    db_sql.add_balance_sql(session_id, amount)

def get_balance(session_id: str) -> int:
    return db_sql.get_balance_sql(session_id)


# ── Custom Categories ──

def load_custom_categories(session_id: str) -> dict:
    return db_sql.read_custom_categories_for_session(session_id)

def save_custom_category(session_id: str, category: str, description: str):
    db_sql.upsert_custom_category(session_id, category, description, datetime.now().isoformat())

# ── Server Session Management ──

def init_session() -> dict:
    """Create server session, returns {session_id, token}"""
    session_id = "s_" + uuid.uuid4().hex[:12]
    token = secrets.token_urlsafe(32)
    db_sql.upsert_session_token(session_id, token, datetime.now().isoformat())
    ensure_free_trial(session_id)
    return {"session_id": session_id, "token": token}

def validate_session(session_id: str, token: str) -> bool:
    """Validate whether token matches session_id"""
    if not session_id or not token:
        return False
    stored_token = db_sql.get_session_token(session_id)
    return stored_token is not None and hmac.compare_digest(stored_token, token)


def resume_session(session_id: str) -> dict:
    """Rotate the token for an existing account session without losing its data."""
    if not session_id:
        return init_session()
    token = secrets.token_urlsafe(32)
    db_sql.upsert_session_token(session_id, token, datetime.now().isoformat())
    ensure_free_trial(session_id)
    return {"session_id": session_id, "token": token}


def get_menu_text(session_id: str) -> str:
    base = """你想了解什么？
1. 考研保研 — 目标拆解、硬性要求、时间线
2. 选课指导 — 给分风格、学分价值、排课建议
3. 竞赛规划 — 价值评估、组队策略、备赛指南
4. 实习攻略 — 时间窗口、简历准备、投递渠道
5. 学习加速 — 新技能、新领域、快速入门
6. 论文指导 — 选题、文献、大纲、初稿、润色、答辩"""
    cats = load_custom_categories(session_id)
    idx = 7
    for name, info in cats.items():
        base += f"\n{idx}. {name} — {info['description']}"
        idx += 1
    base += f"\n{idx}. 其他问题 — 随便问"
    return base


def get_state(profile: dict) -> str:
    """Simplified state: always 'chatting' (user fills info via profile modal on their own)"""
    return "chatting"

def prepare_messages(session_id: str, message: str, profile: dict, session: dict):
    """Build LLM message list + quick reply. User info is filled voluntarily; not extracted during conversation."""
    from .llm import SYSTEM_PROMPT
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Inject user info — all fields the user has filled
    MEMORY_FIELDS = ("school", "major", "grade", "goal", "skills", "experience", "interests", "achievements")
    fields_filled = {k: profile.get(k) for k in MEMORY_FIELDS if profile.get(k)}
    if fields_filled:
        info = "【User Info】" + " | ".join(f"{k}: {v}" for k, v in fields_filled.items())
    else:
        info = ""
    if session.get("direction"):
        d = session["direction"]
        info += f"\nUser's current consultation category: {d}. Please answer strictly following this category's framework." if info else f"User's current consultation category: {d}. Please answer strictly following this category's framework."
        frame_map = {
            "Graduate Admissions": "Goal Breakdown → Hard Requirements Checklist → Timeline → Differentiation Strategy → Information Gap Alerts",
            "Course Selection": "Grading Style → Credit Value → Schedule Conflict Analysis",
            "Competitions": "Value Assessment → Time Investment Evaluation → Team Building Strategy → Preparation Guide",
            "Internships": "Timeline Window Analysis → Resume Preparation → Channel Selection → Industry-Specific Advice",
            "General Learning": "Ask what field user wants to learn → Domain landscape map → Learning path planning",
            "Thesis Guidance": "Topic Selection (AI brainstorming → Literature verification → Confirmation) → Literature Review (Search → Read → Find research gap) → Build Outline (Find similar papers → Generate outline → Confirmation) → Write First Draft (Discuss chapter by chapter → Organize language → Confirm revisions) → Polish (Academic polish → Eliminate AI-isms → Style consistency check) → Self-Check (Verify citations → Plagiarism/AI check → Format check) → Defense Prep (Mock Q&A → Practice weak areas)",
        }
        if d in frame_map:
            info += f"\nAnswer framework: {frame_map[d]}"
    if info:
        messages.append({"role": "system", "content": info})

    # Inject conversation history
    history = session.get("history", [])
    for h in history[-8:]:
        messages.append({"role": "user", "content": h["user"]})
        messages.append({"role": "assistant", "content": h["assistant"]})

    # Process user message
    user_msg = normalize_message(session_id, message.strip())

    # Direction detection
    direction = detect_direction(user_msg)
    if direction:
        if session.get("direction") != direction:
            session["direction"] = direction
            session["history"] = []
            save_session(session_id, session)

    # Custom category command
    if user_msg == "__CREATE_CATEGORY__":
        return messages, "__ASK_CATEGORY_DETAILS__", "create_category"

    # Show menu when no message
    if not user_msg:
        user_msg = f"Show menu.\n{get_menu_text(session_id)}"

    messages.append({"role": "user", "content": user_msg})
    return messages, None, "chatting"


# ── Memory Extraction (auto-learn from conversations) ──

MEMORY_PROMPT = """Extract personal information about the user from this conversation exchange.
Return ONLY a JSON object with any of these keys (empty string if nothing found):
{"skills": "", "experience": "", "interests": "", "achievements": ""}

Examples:
- User mentions "I'm good at Python and Java" → skills: "Python, Java"
- User says "I did an internship at Tencent" → experience: "Internship at Tencent"
- User says "I'm interested in AI" → interests: "AI, artificial intelligence"
- User says "I won first place in a robotics competition" → achievements: "First place in robotics competition"

Rules:
- Only extract explicitly stated information. Do not infer or guess.
- Be concise — max 200 chars per field.
- If nothing relevant is found for a field, keep it as empty string.
- If ALL fields are empty, return {"skills":"","experience":"","interests":"","achievements":""}"""


def extract_memory_from_conversation(user_msg: str, assistant_reply: str) -> dict:
    """Use a lightweight LLM call to extract personal info from the conversation turn."""
    from .llm import call_llm

    chat = [
        {"role": "system", "content": MEMORY_PROMPT},
        {"role": "user", "content": f"User: {user_msg}\nAssistant: {assistant_reply}"},
    ]
    try:
        text = call_llm(chat, max_tokens=300, temperature=0.1, model=MEMORY_LLM_MODEL)
        # Parse JSON from response
        import json
        import re
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            data = json.loads(match.group())
            return {k: data.get(k, "") for k in ("skills", "experience", "interests", "achievements")}
    except Exception:
        pass
    return {"skills": "", "experience": "", "interests": "", "achievements": ""}


# ── Progress Tracking ──

def get_progress_stage(session_id: str) -> str:
    """Determine user's progress stage based on activity."""
    profile = db_sql.read_profile(session_id)
    if profile is None:
        return "new"
    cached = profile.get("progress_stage", "")
    if cached:
        return cached
    return "new"


def update_progress(session_id: str):
    """Update progress stage based on conversation activity."""
    profile = db_sql.read_profile(session_id)
    if profile is None:
        profile = {}
    convs = get_user_conversations(session_id)
    conv_count = len(convs)
    msg_count = sum(c.get("message_count", 0) for c in convs)
    visits = profile.get("visit_count", 0)

    stage = "new"
    if conv_count > PROGRESS_THRESHOLDS["conv_count_regular"] or msg_count > 10 or visits >= PROGRESS_THRESHOLDS["return_visits_regular"]:
        stage = "regular"
    elif conv_count > PROGRESS_THRESHOLDS["conv_count_engaged"] or msg_count >= PROGRESS_THRESHOLDS["msg_count_engaged"]:
        stage = "engaged"
    elif conv_count > PROGRESS_THRESHOLDS["conv_count_exploring"] or msg_count > 0:
        stage = "exploring"

    if profile.get("progress_stage") != stage:
        profile["progress_stage"] = stage
        profile["updated_at"] = datetime.now().isoformat()
        db_sql.upsert_profile(session_id, profile)


def get_progress_info(session_id: str) -> dict:
    """Return progress info for frontend display."""
    update_progress(session_id)
    profile = db_sql.read_profile(session_id)
    if profile is None:
        profile = {}
    stage = profile.get("progress_stage", "new")
    convs = get_user_conversations(session_id)
    msg_count = sum(c.get("message_count", 0) for c in convs)

    stage_labels = {
        "new": {"label": "新手探索", "desc": "开始你的第一次咨询", "icon": "🌱"},
        "exploring": {"label": "探索中", "desc": "探索中，试试不同方向", "icon": "🔍"},
        "engaged": {"label": "深度咨询", "desc": "深度咨询中，收获满满", "icon": "📚"},
        "regular": {"label": "常客", "desc": "老朋友了，继续加油", "icon": "⭐"},
    }
    info = stage_labels.get(stage, stage_labels["new"])
    return {
        "stage": stage,
        "label": info["label"],
        "desc": info["desc"],
        "icon": info["icon"],
        "conversations": len(convs),
        "messages": msg_count,
    }


# ── Conversation Summary ──

def generate_conversation_summary(messages: list[dict]) -> str:
    """Generate a short summary from conversation messages."""
    if not messages:
        return ""
    # Use first user message as basis for summary
    for m in messages:
        if m["role"] == "user":
            text = m["content"].strip()
            if len(text) <= 30:
                return text
            for sep in "，。,.;；：:！!？?":
                idx = text.find(sep)
                if 8 <= idx <= 26:
                    return text[:idx]
            return text[:26] + "…"
    return ""


def update_conversation_summary(session_id: str, conv_id: str):
    """Auto-generate and store summary for a conversation."""
    conv = db_sql.read_conversation(session_id, conv_id)
    if not conv or conv.get("summary"):
        return
    summary = generate_conversation_summary(conv.get("messages", []))
    if summary:
        conv["summary"] = summary
        db_sql.upsert_conversation(session_id, conv)


# ── Export Conversation ──

def export_conversation_text(session_id: str, conv_id: str) -> str:
    """Export conversation as formatted text."""
    conv = get_conversation(session_id, conv_id)
    if not conv:
        return "Conversation not found."
    lines = [
        f"Title: {conv.get('title', 'Untitled')}",
        f"Category: {conv.get('mode', 'General')}",
        f"Created: {conv.get('created_at', '')}",
        f"Updated: {conv.get('updated_at', '')}",
        "",
        "─" * 40,
        "",
    ]
    for m in conv.get("messages", []):
        role = "You" if m["role"] == "user" else "Campus Advisor"
        lines.append(f"[{role}]")
        lines.append(m["content"])
        lines.append("")
    return "\n".join(lines)


# ── Admin Announcements ──

def load_announcements() -> list[dict]:
    return locked_read_json(ANNOUNCEMENTS_FILE)


def save_announcements(data: list[dict]):
    locked_write_json(ANNOUNCEMENTS_FILE, data)


def create_announcement(title: str, content: str, target: str = "all") -> dict:
    """Create a new announcement. target: 'all' or specific session_id."""
    ann = {
        "id": f"ann_{uuid.uuid4().hex[:8]}",
        "title": title,
        "content": content,
        "target": target,
        "created_at": datetime.now().isoformat(),
        "active": True,
    }
    announcements = load_announcements()
    announcements.append(ann)
    save_announcements(announcements)
    return ann


def get_active_announcements(session_id: str) -> list[dict]:
    """Get active announcements for a user (not dismissed)."""
    profile = load_profiles().get(session_id, {})
    dismissed = set(profile.get("dismissed_announcements", []))
    announcements = load_announcements()
    result = []
    for ann in announcements:
        if not ann.get("active", True):
            continue
        if ann["id"] in dismissed:
            continue
        if ann["target"] == "all" or ann["target"] == session_id:
            result.append({
                "id": ann["id"],
                "title": ann["title"],
                "content": ann["content"],
                "created_at": ann["created_at"],
            })
    return result


def dismiss_announcement(session_id: str, ann_id: str):
    """Mark an announcement as dismissed for a user."""
    profile = db_sql.read_profile(session_id)
    if profile is None:
        profile = {}
    dismissed = set(profile.get("dismissed_announcements", []))
    dismissed.add(ann_id)
    profile["dismissed_announcements"] = list(dismissed)
    profile["updated_at"] = datetime.now().isoformat()
    db_sql.upsert_profile(session_id, profile)


def track_visit(session_id: str):
    """Increment visit count for a user."""
    profile = db_sql.read_profile(session_id)
    if profile is None:
        profile = {}
    profile["visit_count"] = profile.get("visit_count", 0) + 1
    profile["last_visit"] = datetime.now().isoformat()
    db_sql.upsert_profile(session_id, profile)
    update_progress(session_id)


# ── Memory Extraction (auto-learn from conversations) ──

def merge_memory(session_id: str, new_info: dict):
    """Merge extracted info into profile, only updating fields that have new content."""
    profile = db_sql.read_profile(session_id)
    if profile is None:
        profile = {}
    changed = False
    for key in ("skills", "experience", "interests", "achievements"):
        existing = profile.get(key, "")
        new_val = new_info.get(key, "").strip()
        if new_val:
            # Append if not already present
            existing_list = [s.strip() for s in existing.split(",") if s.strip()]
            new_items = [s.strip() for s in new_val.split(",") if s.strip()]
            merged_items = []
            for item in existing_list + new_items:
                if item and item not in merged_items:
                    merged_items.append(item)
            merged = ", ".join(merged_items)
            if merged != existing:
                profile[key] = merged
                changed = True
    if changed:
        profile["updated_at"] = datetime.now().isoformat()
        db_sql.upsert_profile(session_id, profile)
