"""Guided collection of a Haiwen assessment profile without LLM inference."""
import re

from .cdut_catalog import COLLEGE_OPTIONS, majors_for_college

BASE_STEPS = (
    "college",
    "major",
    "grade",
    "ranking",
    "cet6_status",
    "current_blocker",
    "blocker_detail",
    "decision_deadline",
    "research",
    "competition",
    "cities",
    "majors",
    "target_schools",
    "school_strategy",
    "goal_priority",
    "attempted_action",
    "biggest_worry",
    "advisor_help",
    "seven_day_action",
    "study_hours",
)

QUESTIONS = {
    "college": "这是成都理工大学专属测评。请选择你所在的学院；列表中没有时可以自行填写。",
    "major": "接下来请选择你的本科专业；列表中没有时可以自行填写。",
    "grade": "再确认一下你现在的年级。",
    "ranking": "为了了解你的学业位置，请填写专业排名和总人数，例如：15/100。",
    "cohort_size": "你刚才只填写了排名。请补充专业总人数，例如：100。",
    "cet6_status": "再看英语情况：请填写 CET4、CET6 分数；未考的科目留空，四六级都未考可直接选择。",
    "cet6_score": "请填写 CET6 分数；如果暂时记不清，可输入“跳过”。",
    "current_blocker": "基本情况清楚了。你现在最希望解决的真实问题是什么？",
    "blocker_detail": "这个问题具体卡在哪一种情况？请选择最接近的一项。",
    "decision_deadline": "你希望最晚在什么时候把这个问题判断清楚？",
    "research": "判断期限明确后，再看能体现专业能力的经历：你有科研或项目经历吗？",
    "competition": "科研和项目情况清楚了。竞赛方面有获奖经历吗？",
    "competition_level": "你的最高竞赛级别是？",
    "cities": "经历情况清楚了，接下来缩小目标范围。请选择你考虑的城市，可多选。",
    "majors": "在这些城市里，你准备优先考虑哪些专业？可多选。",
    "target_schools": "目前有没有重点关注的院校？可填写 1–3 所；还没有可选择“暂时没有”。",
    "school_strategy": "推荐院校时，你更希望采用哪种取舍方式？",
    "research_detail": "你刚才提到有科研或项目经历。请用一句话描述最能代表你的一项成果（课程项目、科研项目、论文、专利或研究方向均可）。",
    "competition_detail": "你刚才提到有竞赛成果。请填写最有代表性的竞赛名称和奖项，例如：挑战杯省级一等奖。",
    "goal_priority": "目标范围确定后，再确认路径：你更倾向保研、考研，还是两条路都考虑？",
    "attempted_action": "围绕刚才最想解决的问题，你已经做到了哪一步？",
    "biggest_worry": "继续推进时，你最想避免哪种结果？",
    "advisor_help": "如果请老师查看这份情况，你最希望优先核对哪一点？",
    "seven_day_action": "不等最终结果，现在有哪一项事情是你愿意在 7 天内先完成的？",
    "study_hours": "最后确认可执行时间：你每天大约能稳定投入几小时？",
    "target_direction": "你的目标专业范围较宽。请补充一个最优先方向，例如：人工智能、软件工程或网络安全。",
}

INPUT_SPECS = {
    "college": {"type": "choice_or_text", "options": list(COLLEGE_OPTIONS), "custom_label": "其他学院（自行填写）"},
    "grade": {"type": "choice", "options": ["大一", "大二", "大三", "大四", "已毕业"]},
    "ranking": {"type": "rank", "options": []},
    "cet6_status": {"type": "english_scores", "options": ["四六级都未考"]},
    "current_blocker": {"type": "choice", "options": ["不知道走保研还是考研", "排名不够有把握", "英语拖后腿", "科研竞赛太少", "不会选学校", "时间安排混乱"]},
    "decision_deadline": {"type": "choice", "options": ["1 周内", "1 个月内", "本学期内", "下个关键节点前", "暂时不着急"]},
    "research": {"type": "choice", "options": ["有科研或项目经历", "暂无科研或项目经历"]},
    "competition": {"type": "choice", "options": ["有竞赛奖项", "暂无竞赛奖项"]},
    "competition_level": {"type": "choice", "options": ["校级", "省级", "国家级", "国际级"]},
    "goal_priority": {"type": "choice", "options": ["主要考虑保研", "主要考虑考研", "两边都考虑", "暂时不知道"]},
    "school_strategy": {"type": "choice", "options": ["梯度搭配", "偏冲刺", "偏稳妥"]},
    "attempted_action": {"type": "choice", "options": ["刚开始了解，还没行动", "查过政策或招生信息", "列过院校或专业名单", "制定过计划但没坚持", "已经在准备，想确认方向"]},
    "biggest_worry": {"type": "choice", "options": ["错过关键时间节点", "目标定得过高或过低", "努力方向不对", "条件达不到院校要求", "准备很多但没有结果"]},
    "advisor_help": {"type": "choice", "options": ["当前条件是否支持保研或考研", "候选院校和专业是否匹配", "目前最需要补充的关键信息", "目标是否存在明显硬门槛", "对官方政策的理解是否准确"]},
    "seven_day_action": {"type": "choice", "options": ["核对本校保研资格与排名口径", "整理目标院校官方要求", "完成一次英语水平摸底", "梳理一项代表项目或竞赛", "排出下周可执行时间表"]},
    "cities": {"type": "multi_choice", "options": ["成都", "重庆", "北京", "上海", "南京", "杭州", "广州", "深圳", "武汉", "西安"], "custom_label": "其他城市（可补充）"},
    "target_schools": {"type": "choice_or_text", "options": ["暂时没有"], "custom_label": "填写关注院校"},
    "research_detail": {"type": "choice_or_text", "options": ["课程项目（暂无具体成果）", "科研项目（正在参与）", "论文或专利", "正在参与，暂未产出"], "custom_label": "填写具体成果"},
    "competition_detail": {"type": "choice_or_text", "options": ["数学建模竞赛", "挑战杯", "中国国际大学生创新大赛", "蓝桥杯"], "custom_label": "填写其他竞赛及奖项"},
    "study_hours": {"type": "choice_or_text", "options": ["1 小时", "2 小时", "3 小时", "4 小时", "5 小时", "6 小时"], "custom_label": "填写其他时长"},
    "cohort_size": {"type": "number", "options": []},
}

MAX_FOLLOWUP_ROUNDS = 8
FOLLOW_UP_RULES = (
    {"step": "cohort_size", "when": "COHORT_SIZE_MISSING"},
    {"step": "target_direction", "when": "TARGET_TOO_BROAD"},
)

GRADE_MAP = {
    "大一": "FRESHMAN",
    "大二": "SOPHOMORE",
    "大三": "JUNIOR",
    "大四": "SENIOR",
    "已毕业": "GRADUATED",
}

BLOCKER_DETAIL_OPTIONS = {
    "不知道走保研还是考研": ["不清楚自己是否还有保研机会", "担心双轨准备顾不过来", "不了解两条路径的时间节点", "不知道哪条路径更适合当前条件"],
    "排名不够有把握": ["不知道本校保研排名口径", "排名在边缘且波动较大", "不清楚目标院校能接受什么排名", "不知道该保排名还是补经历"],
    "英语拖后腿": ["还没有通过四级", "六级成绩不理想", "担心考研英语基础不足", "不清楚目标院校英语硬门槛"],
    "科研竞赛太少": ["不知道该优先做科研还是竞赛", "有经历但没有可展示成果", "找不到合适的项目或老师", "担心经历与目标专业不相关"],
    "不会选学校": ["不知道自己的条件能冲到什么层次", "专业方向太多，不知道怎么选", "城市、学校层次和专业实力难取舍", "担心冲刺失败，又不想目标太保守", "看不懂招生条件和往年要求"],
    "时间安排混乱": ["任务很多，不知道先做什么", "制定过计划但执行不下去", "课程与准备时间冲突", "不知道不同阶段该完成什么"],
}


def is_assessment_start(message: str) -> bool:
    normalized = message.replace(" ", "")
    return normalized in {"开始升学测评", "开始测评", "我要测评", "升学测评"}


def _split_values(value: str) -> list[str]:
    return [item.strip() for item in re.split(r"[,，、]", value) if item.strip()]


def _is_skip(value: str) -> bool:
    return value.strip() in {"跳过", "不知道", "不清楚", "未考", "没有"}


def _start() -> tuple[dict, str]:
    return {
        "step": BASE_STEPS[0],
        "profile": {"school": "成都理工大学"},
        "follow_up_rounds": 0,
        "follow_up_steps": [],
    }, QUESTIONS[BASE_STEPS[0]]


def _follow_up_steps(profile: dict) -> list[str]:
    """Choose only the clarification questions justified by collected answers."""
    return [rule["step"] for rule in FOLLOW_UP_RULES if _rule_matches(rule["when"], profile)]


def _rule_matches(condition: str, profile: dict) -> bool:
    if condition == "ALWAYS":
        return True
    if condition == "HAS_RESEARCH":
        return bool(profile.get("researchExperiences"))
    if condition == "HAS_COMPETITION":
        return bool(profile.get("competitionExperiences"))
    if condition == "ENGLISH_NEEDS_PLAN":
        return profile.get("cet6Status", "UNKNOWN") in {"NOT_TAKEN", "FAILED", "UNKNOWN", "TAKEN_UNKNOWN"}
    if condition == "COHORT_SIZE_MISSING":
        return bool(profile.get("rank")) and not profile.get("cohortSize")
    if condition == "TARGET_TOO_BROAD":
        broad = {"计算机", "工科", "理工科", "商科", "管理", "经济"}
        return any(value in broad for value in profile.get("targetMajors", []))
    return False


def _next(state: dict) -> str:
    current = state["step"]
    if current == "cet6_status" and state.pop("needs_cet6_score", False):
        state["step"] = "cet6_score"
        return QUESTIONS["cet6_score"]
    if current == "cet6_score":
        state["step"] = "current_blocker"
        return QUESTIONS["current_blocker"]
    if current == "research" and state.pop("needs_research_detail", False):
        state["step"] = "research_detail"
        return QUESTIONS["research_detail"]
    if current == "research_detail":
        state["step"] = "competition"
        return QUESTIONS["competition"]
    if current == "competition_level":
        state["step"] = "competition_detail"
        return QUESTIONS["competition_detail"]
    if current == "competition_detail":
        state["step"] = "cities"
        return QUESTIONS["cities"]
    if current in BASE_STEPS:
        if current == "competition" and state.pop("needs_competition_level", False):
            state["step"] = "competition_level"
            return QUESTIONS["competition_level"]
        if current == "competition" and state.pop("needs_competition_detail", False):
            state["step"] = "competition_detail"
            return QUESTIONS["competition_detail"]
        index = BASE_STEPS.index(current) + 1
        if index < len(BASE_STEPS):
            state["step"] = BASE_STEPS[index]
            return QUESTIONS[state["step"]]
        state["follow_up_steps"] = _follow_up_steps(state["profile"])

    follow_up_steps = state["follow_up_steps"]
    if not follow_up_steps or state.get("follow_up_rounds", 0) >= MAX_FOLLOWUP_ROUNDS:
        state["step"] = "submit"
        return "信息已收集完成，正在生成确定性测评结果……"
    state["step"] = follow_up_steps.pop(0)
    state["follow_up_rounds"] = state.get("follow_up_rounds", 0) + 1
    if state["step"] == "goal_priority":
        cities = "、".join(state["profile"].get("targetCities", [])) or "你的目标城市"
        majors = "、".join(state["profile"].get("targetMajors", [])) or "你的目标专业"
        return f"你计划在 {cities} 攻读 {majors}。你现在更倾向：保研、考研，还是两条路都考虑？"
    return QUESTIONS[state["step"]]


def input_spec(state: dict | None) -> dict:
    """Presentation metadata only; all progression remains in the deterministic state machine."""
    if not state or state.get("step") == "submit":
        return {"type": "text", "options": []}
    step = state["step"]
    profile = state.get("profile", {})
    if step == "blocker_detail":
        concern = state.get("student_context", {}).get("currentConcern", "")
        return {"type": "choice", "options": BLOCKER_DETAIL_OPTIONS.get(concern, [])}
    if step == "major":
        return {
            "type": "choice_or_text",
            "options": majors_for_college(profile.get("college", "")),
            "custom_label": "其他专业（自行填写）",
        }
    if step in {"majors", "target_direction"}:
        options = [profile.get("major", ""), *majors_for_college(profile.get("college", ""))]
        options = list(dict.fromkeys(option for option in options if option))
        return {
            "type": "multi_choice" if step == "majors" else "choice_or_text",
            "options": options,
            "custom_label": "其他目标专业（可补充）",
        }
    return INPUT_SPECS.get(step, {"type": "text", "options": []})


def _parse_current_answer(state: dict, answer: str) -> str | None:
    step = state["step"]
    profile = state["profile"]
    value = answer.strip()
    if step in {"college", "major"}:
        if not value:
            return "请填写当前学院或本科专业。"
        profile[step] = value
    elif step == "grade":
        if value not in GRADE_MAP:
            return "请回答：大一、大二、大三、大四或已毕业。"
        profile["grade"] = GRADE_MAP[value]
    elif step == "ranking":
        match = re.fullmatch(r"(\d+)(?:\s*[/／]\s*(\d+))?", value)
        if not match or int(match.group(1)) < 1:
            return "请按“排名/总人数”填写，例如：15/100；暂时只知道排名也可填写 15。"
        profile["rank"] = int(match.group(1))
        if match.group(2):
            if int(match.group(1)) > int(match.group(2)):
                return "排名不能大于专业总人数，请核对后重新填写。"
            profile["cohortSize"] = int(match.group(2))
    elif step == "cohort_size":
        if not value.isdigit() or int(value) < profile.get("rank", 1):
            return "总人数必须是不小于当前排名的正整数。"
        profile["cohortSize"] = int(value)
    elif step == "cet6_status":
        if value in {"四六级都未考", "未考四六级"}:
            profile["cet4Status"] = "NOT_TAKEN"
            profile["cet6Status"] = "NOT_TAKEN"
        elif re.search(r"(?:CET|[四六]级)\s*[46]?\s*[:：]?\s*\d", value, re.IGNORECASE):
            scores = re.findall(r"(CET4|四级|CET6|六级)\s*[:：]?\s*(\d{1,3})(?!\d)\s*分?", value, re.IGNORECASE)
            if not scores:
                return "四六级分数应在 0 到 710 之间，请重新填写。"
            profile["cet4Status"] = "NOT_TAKEN"
            profile["cet6Status"] = "NOT_TAKEN"
            for test_name, raw_score in scores:
                score = int(raw_score)
                if not 0 <= score <= 710:
                    return "四六级分数应在 0 到 710 之间，请重新填写。"
                test = "cet4" if test_name.upper() == "CET4" or test_name == "四级" else "cet6"
                profile[f"{test}Score"] = score
                profile[f"{test}Status"] = "PASSED" if score >= 425 else "FAILED"
        elif value == "未参加":
            profile["cet6Status"] = "NOT_TAKEN"
        elif value in {"未知", "不确定"}:
            profile["cet6Status"] = "UNKNOWN"
        elif value in {"未通过", "已通过"}:
            profile["cet6Status"] = "FAILED" if value == "未通过" else "PASSED"
            state["needs_cet6_score"] = True
        else:
            return "请选择：未参加、未通过、已通过或未知。"
    elif step == "cet6_score":
        if not _is_skip(value):
            match = re.fullmatch(r"(?:CET6|六级)?\s*(\d{1,3})\s*分?", value, re.IGNORECASE)
            if not match:
                return "CET6 分数应在 0 到 710 之间，请重新填写；暂时记不清可输入“跳过”。"
            score = int(match.group(1))
            if not 0 <= score <= 710:
                return "CET6 分数应在 0 到 710 之间，请重新填写。"
            if profile.get("cet6Status") == "PASSED" and score < 425:
                return "分数与“已通过”状态不一致，请核对 CET6 状态或分数。"
            if profile.get("cet6Status") == "FAILED" and score >= 425:
                return "分数与“未通过”状态不一致，请核对 CET6 状态或分数。"
            profile["cet6Score"] = score
    elif step == "current_blocker":
        options = INPUT_SPECS["current_blocker"]["options"]
        if value not in options:
            return "请选择最接近的一项。"
        state.setdefault("student_context", {})["currentConcern"] = value
    elif step == "blocker_detail":
        options = BLOCKER_DETAIL_OPTIONS.get(state.get("student_context", {}).get("currentConcern", ""), [])
        if value not in options:
            return "请选择最接近的一项。"
        state.setdefault("student_context", {})["specificBlocker"] = value
    elif step == "decision_deadline":
        options = INPUT_SPECS["decision_deadline"]["options"]
        if value not in options:
            return "请选择最接近的决策时间。"
        state.setdefault("student_context", {})["decisionDeadline"] = value
    elif step == "research":
        if value in {"有", "是", "有的", "有科研经历", "有项目经历", "有科研或项目经历"}:
            profile["researchExperiences"] = [{"title": "待补充的科研经历", "role": "PARTICIPANT", "isRepresentative": True}]
            state["needs_research_detail"] = True
        elif value in {"没有", "无", "否", "跳过", "暂无科研经历", "暂无项目经历", "暂无科研或项目经历"}:
            profile["researchExperiences"] = []
        else:
            return "请回答“有”或“没有”。"
    elif step == "competition":
        if value == "有竞赛奖项":
            state["needs_competition_level"] = True
        elif value in {"国家级", "国赛"}:
            profile["competitionExperiences"] = [{"name": "竞赛经历", "award": "已获奖", "level": "NATIONAL"}]
            state["needs_competition_detail"] = True
        elif value in {"省级", "省赛"}:
            profile["competitionExperiences"] = [{"name": "竞赛经历", "award": "已获奖", "level": "PROVINCIAL"}]
            state["needs_competition_detail"] = True
        elif value in {"没有", "无", "否", "跳过", "暂无竞赛奖项"}:
            profile["competitionExperiences"] = []
        else:
            return "请回答“国家级”“省级”或“没有”。"
    elif step == "competition_level":
        levels = {"校级": "UNIVERSITY", "省级": "PROVINCIAL", "国家级": "NATIONAL", "国际级": "INTERNATIONAL"}
        if value not in levels:
            return "请选择：校级、省级、国家级或国际级。"
        profile["competitionExperiences"] = [{"name": "竞赛经历", "award": "已获奖", "level": levels[value]}]
    elif step in {"cities", "majors"}:
        values = _split_values(value)
        if not values:
            return "请至少填写一项；多个项目可用顿号、逗号分隔。"
        profile["targetCities" if step == "cities" else "targetMajors"] = values
    elif step == "target_schools":
        if value in {"暂时没有", "暂无", "没有", "不确定", "跳过"}:
            profile["targetUniversities"] = []
        else:
            values = _split_values(value)
            if not values:
                return "请填写 1–3 所关注院校；还没有可回答“暂时没有”。"
            if len(values) > 3:
                return "请先填写最关注的 1–3 所院校，多个院校用顿号或逗号分隔。"
            profile["targetUniversities"] = values
    elif step == "school_strategy":
        strategies = {"梯度搭配": "BALANCED", "偏冲刺": "AGGRESSIVE", "偏稳妥": "CONSERVATIVE"}
        if value not in strategies:
            return "请选择：梯度搭配、偏冲刺或偏稳妥。"
        profile["riskPreference"] = strategies[value]
    elif step == "research_detail":
        if not value:
            return "请用一句话描述一项科研成果；如果暂时没有可输入“暂无具体成果”。"
        profile["researchDetail"] = value
        profile["researchExperiences"][0].update({"title": value, "description": value, "outputDescription": value})
    elif step == "competition_detail":
        if not value:
            return "请填写竞赛名称和奖项；如果暂时不便说明可输入“暂无具体说明”。"
        profile["competitionDetail"] = value
        profile["competitionExperiences"][0]["name"] = value
    elif step == "goal_priority":
        normalized = value.replace(" ", "")
        if normalized in {"保研", "推荐免试", "主要考虑保研"}:
            profile["pathPreference"] = "RECOMMENDATION"
        elif normalized in {"考研", "研究生考试", "主要考虑考研"}:
            profile["pathPreference"] = "POSTGRAD_EXAM"
        elif normalized in {"两条路都考虑", "两边都考虑", "双线", "双轨", "保研和考研", "都考虑"}:
            profile["pathPreference"] = "DUAL_TRACK"
        elif normalized in {"还不确定", "暂时不知道"}:
            profile["pathPreference"] = "UNDECIDED"
        else:
            return "请回答：保研、考研，或两条路都考虑。"
    elif step in {"attempted_action", "biggest_worry", "advisor_help", "seven_day_action"}:
        options = INPUT_SPECS[step]["options"]
        if value not in options:
            return "请选择最接近的一项。"
        context_keys = {
            "attempted_action": "attemptedAction",
            "biggest_worry": "biggestWorry",
            "advisor_help": "advisorHelp",
            "seven_day_action": "sevenDayAction",
        }
        state.setdefault("student_context", {})[context_keys[step]] = value
    elif step == "study_hours":
        match = re.fullmatch(r"(?:每天)?\s*(\d+(?:\.\d+)?)\s*(?:小时|h)?", value, re.IGNORECASE)
        if not match:
            return "请输入 0 到 24 之间的小时数，例如：3.5。"
        hours = float(match.group(1))
        if not 0 <= hours <= 24:
            return "每天可投入时间应在 0 到 24 小时之间，请重新填写。"
        profile["dailyStudyHours"] = hours
        profile["weeklyAvailableHours"] = hours * 7
    elif step == "target_direction":
        if not value:
            return "请补充一个最优先的目标方向。"
        profile["targetMajors"] = [value]
    return None


def assemble_student_profile(profile: dict) -> dict:
    assessment_fields = {
        key: value
        for key, value in profile.items()
        if key not in {"researchDetail", "competitionDetail"}
    }
    return {
        "competitionExperiences": assessment_fields.get("competitionExperiences", []),
        "researchExperiences": assessment_fields.get("researchExperiences", []),
        "targetUniversities": assessment_fields.get("targetUniversities", []),
        **assessment_fields,
    }


def _progress_feedback(answered_step: str, state: dict) -> str | None:
    """Give restrained, evidence-aware guidance only at meaningful experience transitions."""
    profile = state["profile"]
    student_context = state.get("student_context", {})
    if answered_step == "current_blocker":
        guidance = {
            "不知道走保研还是考研": "先不急着二选一。判断顺序是资格与排名窗口、英语和代表经历、可持续投入时间；关键信息没有齐之前，保留双轨比过早押注更稳妥。",
            "排名不够有把握": "先确认排名口径、总人数和近两学期趋势，再判断是否仍在目标院校的有效窗口。一次名次不是结论，趋势和可补强项同样重要。",
            "英语拖后腿": "英语要先拆成两个问题：是否卡院校硬门槛，以及能否在申请或初试前达到目标。后续计划会优先区分“先过线”还是“继续提分”。",
            "科研竞赛太少": "经历不在于堆数量，而在于能否讲清你的实际贡献、成果和目标专业关联。先做成一项代表成果，通常比同时参加多个低相关项目更有效。",
            "不会选学校": "择校先定专业方向和城市边界，再按冲刺、匹配、稳妥核对官方要求。不要只凭学校名气列一份过长的名单。",
            "时间安排混乱": "计划先锁定每周可持续投入时间，再安排英语、专业课和经历任务。排满日历不等于可执行，稳定完成比短期冲刺更重要。",
        }
        return guidance.get(student_context.get("currentConcern"))
    if answered_step == "research" and not profile.get("researchExperiences"):
        return "暂时没有科研或项目经历不等于没有机会。应结合年级、排名和目标方向，在项目、英语和专业课中确定一个优先项，避免同时铺太多方向。"
    if answered_step == "school_strategy":
        strategy = profile.get("riskPreference")
        strategy_feedback = {
            "AGGRESSIVE": "偏冲刺意味着可以接受更高的不确定性，但仍需要保留至少一档现实目标，并逐项核对硬门槛。",
            "CONSERVATIVE": "偏稳妥不等于只选低目标，而是优先保证条件匹配和准备可控，再保留少量上探空间。",
            "BALANCED": "梯度搭配会同时保留冲刺、匹配和相对稳妥目标，避免把结果押在单一院校上。",
        }.get(strategy)
        cities = "、".join(profile.get("targetCities", [])) or "城市未限定"
        majors = "、".join(profile.get("targetMajors", [])) or "专业未限定"
        return f"当前按“{majors} / {cities}”筛选。{strategy_feedback}" if strategy_feedback else None
    if answered_step == "goal_priority":
        return {
            "RECOMMENDATION": "保研准备先看资格窗口、排名趋势和代表成果，后续行动会优先围绕这三项展开。",
            "POSTGRAD_EXAM": "考研准备先看目标专业、英语与专业课基础，再用可持续投入时间倒排计划。",
            "DUAL_TRACK": "双轨不是把两套任务同时做满。前期先做英语、专业基础和代表成果这些共用底座，再按关键时间点收敛。",
            "UNDECIDED": "暂时不确定很正常。先用排名窗口、目标要求和可投入时间排除明显不合适的路径，再做选择。",
        }.get(profile.get("pathPreference"))
    if answered_step == "biggest_worry":
        worry = student_context.get("biggestWorry")
        return f"这个顾虑会作为方案取舍条件：优先降低“{worry}”的风险，再讨论更高目标。" if worry else None
    return None


def _format_report(report: dict) -> str:
    return "测评已完成，正在为你打开诊断、同专业院校方案和未来 7 天任务。"


def handle_assessment_intake(message: str, state: dict | None) -> tuple[dict | None, str, bool]:
    """Return updated state, response text, and whether the flow has completed."""
    message = message.strip()
    if is_assessment_start(message):
        state, reply = _start()
        return state, reply, False
    if not state:
        return None, "", False
    if message in {"退出测评", "取消测评"}:
        return None, "已退出升学测评。需要时输入“开始升学测评”即可重新开始。", True
    if message in {"重来", "重新开始"}:
        state, reply = _start()
        return state, reply, False
    if state.get("step") == "submit":
        return state, "正在分析你的升学路径、匹配目标院校并核对官方政策…", False
    answered_step = state["step"]
    error = _parse_current_answer(state, message)
    if error:
        return state, error, False
    next_question = _next(state)
    if state["step"] == "submit":
        return state, "正在分析你的升学路径、匹配目标院校并核对官方政策…", False
    feedback = _progress_feedback(answered_step, state)
    reply = f"{feedback}\n\n{next_question}" if feedback else next_question
    return state, reply, False
