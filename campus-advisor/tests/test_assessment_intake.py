import unittest
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from time import sleep
from unittest.mock import patch

from fastapi.testclient import TestClient

from app import app
from app.assessment_intake import handle_assessment_intake, input_spec


PROFILE = {
    "school": "成都理工大学", "college": "计算机与网络安全学院",
    "grade": "SOPHOMORE", "rank": 15, "cohortSize": 100, "cet6Score": 520,
    "researchExperiences": [], "competitionExperiences": [], "targetCities": ["南京"],
    "targetMajors": ["计算机科学与技术"], "targetUniversities": [], "dailyStudyHours": 3,
    "riskPreference": "BALANCED",
}
EVIDENCE = {
    "id": "E1", "sourceDocumentId": "S1", "programId": "real:program:nju:081200",
    "evidenceType": "POLICY_TEXT", "excerpt": "南京大学官方招生通知。", "contentHash": "hash", "createdAt": "2026-08-30T00:00:00.000Z",
}
ASSESSMENT = {
    "profile": PROFILE,
    "narrative": None,
    "warnings": [],
    "sourceDocuments": {"S1": {"id": "S1", "title": "南京大学2027年招生通知", "publisher": "学校研究生招生网", "admissionYear": 2027, "sourceUrl": "https://example.edu.cn/notice", "freshness": "CURRENT"}},
    "report": {
        "reportVersion": "assessment-report-v0.2",
        "pathDecision": {"path": "DUAL_TRACK", "reasons": [{"message": "建议双轨准备"}], "riskFlags": []},
        "recommendationScore": {"total": 70}, "postgraduateExamScore": {"total": 75},
        "profileCompleteness": {"score": 80}, "topRisks": [], "missingData": [], "actionPriorities": [],
        "evidenceIndex": {"E1": EVIDENCE},
        "schoolRecommendations": [{"programId": "real:program:nju:081200", "tier": "MATCH", "score": 68, "confidence": 75, "evidenceIds": ["E1"], "reasons": [{"message": "目标专业匹配"}], "riskFlags": []}],
    },
}

DIAGNOSIS = (
    "不知道自己的条件能冲到什么层次",
    "1 个月内",
)

FINAL_DIAGNOSIS = (
    "查过政策或招生信息",
    "努力方向不对",
    "候选院校和专业是否匹配",
    "整理目标院校官方要求",
)


class AssessmentIntakeTests(unittest.TestCase):
    def test_ranking_and_english_answers_advance_without_automatic_commentary(self):
        state, _, _ = handle_assessment_intake("开始升学测评", None)
        for answer in ("计算机与网络安全学院", "软件工程", "大二"):
            state, _, _ = handle_assessment_intake(answer, state)
        state, reply, _ = handle_assessment_intake("15/100", state)
        self.assertEqual(reply, "再看英语情况：请填写 CET4、CET6 分数；未考的科目留空，四六级都未考可直接选择。")
        state, reply, _ = handle_assessment_intake("CET6 486", state)
        self.assertEqual(reply, "基本情况清楚了。你现在最希望解决的真实问题是什么？")

    def test_core_problem_drives_a_specific_diagnostic_branch(self):
        state, _, _ = handle_assessment_intake("开始升学测评", None)
        for answer in ("计算机与网络安全学院", "软件工程", "大二", "15/100", "四六级都未考", "不会选学校"):
            state, _, _ = handle_assessment_intake(answer, state)

        self.assertEqual(state["step"], "blocker_detail")
        self.assertIn("不知道自己的条件能冲到什么层次", input_spec(state)["options"])
        state, reply, _ = handle_assessment_intake("不知道自己的条件能冲到什么层次", state)
        self.assertEqual(state["step"], "decision_deadline")
        self.assertIn("最晚在什么时候", reply)

    def test_major_options_follow_selected_college_and_keep_custom_fallback(self):
        state, _, _ = handle_assessment_intake("开始升学测评", None)
        state, _, _ = handle_assessment_intake("计算机与网络安全学院（示范性软件学院）", state)

        spec = input_spec(state)

        self.assertEqual(spec["type"], "choice_or_text")
        self.assertIn("计算机科学与技术", spec["options"])
        self.assertIn("软件工程", spec["options"])
        self.assertEqual(spec["custom_label"], "其他专业（自行填写）")

    def test_direct_cet4_cet6_scores_advance_in_one_step(self):
        state, _, _ = handle_assessment_intake("开始升学测评", None)
        for answer in ("计算机与网络安全学院", "软件工程", "大二", "15/100"):
            state, _, _ = handle_assessment_intake(answer, state)

        self.assertEqual(input_spec(state)["type"], "english_scores")
        state, _, _ = handle_assessment_intake("CET4 520；CET6 480", state)

        self.assertEqual(state["step"], "current_blocker")
        self.assertEqual(state["profile"]["cet4Score"], 520)
        self.assertEqual(state["profile"]["cet4Status"], "PASSED")
        self.assertEqual(state["profile"]["cet6Score"], 480)
        self.assertEqual(state["profile"]["cet6Status"], "PASSED")

    def test_direct_english_scores_reject_extra_digits(self):
        state, _, _ = handle_assessment_intake("开始升学测评", None)
        for answer in ("计算机与网络安全学院", "软件工程", "大二", "15/100"):
            state, _, _ = handle_assessment_intake(answer, state)

        state, reply, _ = handle_assessment_intake("CET4 1000", state)

        self.assertEqual(state["step"], "cet6_status")
        self.assertIn("0 到 710", reply)

    def test_target_city_and_major_specs_prefer_multi_select(self):
        state, _, _ = handle_assessment_intake("开始升学测评", None)
        for answer in ("计算机与网络安全学院", "软件工程", "大二", "15/100", "四六级都未考", "不会选学校", *DIAGNOSIS, "没有", "没有"):
            state, _, _ = handle_assessment_intake(answer, state)

        self.assertEqual(state["step"], "cities")
        self.assertEqual(input_spec(state)["type"], "multi_choice")
        state, _, _ = handle_assessment_intake("成都、南京", state)
        self.assertEqual(input_spec(state)["type"], "multi_choice")
        self.assertIn("软件工程", input_spec(state)["options"])

    def test_conditional_followups_and_structured_specs(self):
        state, _, _ = handle_assessment_intake("开始升学测评", None)
        self.assertEqual(state["step"], "college")
        self.assertEqual(state["profile"]["school"], "成都理工大学")
        self.assertTrue(any(option.startswith("计算机与网络安全学院") for option in input_spec(state)["options"]))
        state, _, _ = handle_assessment_intake("计算机与网络安全学院", state)
        state, _, _ = handle_assessment_intake("计算机科学与技术", state)
        self.assertEqual(input_spec(state)["type"], "choice")
        state, _, _ = handle_assessment_intake("大二", state)
        self.assertEqual(input_spec(state)["type"], "rank")
        for answer in ("15/100", "未参加", "科研竞赛太少", "不知道该优先做科研还是竞赛", "1 个月内", "有科研经历"):
            state, reply, _ = handle_assessment_intake(answer, state)
        self.assertEqual(state["step"], "research_detail")
        self.assertIn("项目", reply)

        state, reply, _ = handle_assessment_intake("参与实验室知识图谱项目，负责数据清洗和评测", state)
        self.assertEqual(state["step"], "competition")
        self.assertIn("竞赛方面", reply)

    def test_competition_detail_is_disclosed_before_target_questions(self):
        state, _, _ = handle_assessment_intake("开始升学测评", None)
        for answer in ("计算机与网络安全学院", "软件工程", "大二", "15/100", "未参加", "科研竞赛太少", "不知道该优先做科研还是竞赛", "1 个月内", "没有", "有竞赛奖项"):
            state, _, _ = handle_assessment_intake(answer, state)
        self.assertEqual(state["step"], "competition_level")
        state, _, _ = handle_assessment_intake("国家级", state)
        self.assertEqual(state["step"], "competition_detail")
        state, reply, _ = handle_assessment_intake("挑战杯国家级二等奖，负责核心算法", state)
        self.assertEqual(state["step"], "cities")
        self.assertIn("目标范围", reply)

    def test_cet6_score_is_only_requested_after_attendance(self):
        state, _, _ = handle_assessment_intake("开始升学测评", None)
        for answer in ("计算机与网络安全学院", "计算机科学与技术", "大二", "15/100", "已通过"):
            state, reply, _ = handle_assessment_intake(answer, state)
        self.assertEqual(state["step"], "cet6_score")
        self.assertIn("分数", reply)
        state, _, _ = handle_assessment_intake("520", state)
        self.assertEqual(state["profile"]["cet6Status"], "PASSED")
        self.assertEqual(state["profile"]["cet6Score"], 520)
        self.assertEqual(state["step"], "current_blocker")
        state, reply, _ = handle_assessment_intake("英语拖后腿", state)
        self.assertEqual(state["step"], "blocker_detail")
        self.assertIn("硬门槛", reply)

    def test_competition_level_requests_representative_detail(self):
        state, _, _ = handle_assessment_intake("开始升学测评", None)
        for answer in ("计算机与网络安全学院", "软件工程", "大二", "15/100", "未参加", "不会选学校", *DIAGNOSIS, "没有", "有竞赛奖项"):
            state, _, _ = handle_assessment_intake(answer, state)
        self.assertEqual(state["step"], "competition_level")
        state, _, _ = handle_assessment_intake("国家级", state)
        self.assertEqual(state["step"], "competition_detail")

    def test_competition_answers_do_not_trigger_a_contradictory_evaluation(self):
        state, _, _ = handle_assessment_intake("开始升学测评", None)
        for answer in ("计算机与网络安全学院", "软件工程", "大二", "15/100", "未参加", "科研竞赛太少", "不知道该优先做科研还是竞赛", "1 个月内", "没有"):
            state, _, _ = handle_assessment_intake(answer, state)
        state, reply, _ = handle_assessment_intake("有竞赛奖项", state)
        self.assertEqual(reply, "你的最高竞赛级别是？")
        self.assertNotIn("暂未形成", reply)
        state, _, _ = handle_assessment_intake("国家级", state)
        state, reply, _ = handle_assessment_intake("挑战杯", state)
        self.assertEqual(reply, "经历情况清楚了，接下来缩小目标范围。请选择你考虑的城市，可多选。")

    def test_cet6_status_and_score_must_be_consistent(self):
        state, _, _ = handle_assessment_intake("开始升学测评", None)
        for answer in ("计算机与网络安全学院", "软件工程", "大二", "15/100", "已通过"):
            state, _, _ = handle_assessment_intake(answer, state)
        state, reply, _ = handle_assessment_intake("400", state)
        self.assertEqual(state["step"], "cet6_score")
        self.assertIn("状态", reply)

    def test_cet6_score_rejects_out_of_range_or_extra_digits(self):
        state, _, _ = handle_assessment_intake("开始升学测评", None)
        for answer in ("计算机与网络安全学院", "软件工程", "大二", "15/100", "已通过"):
            state, _, _ = handle_assessment_intake(answer, state)
        for answer in ("711", "751", "1000", "-1"):
            state, reply, _ = handle_assessment_intake(answer, state)
            self.assertEqual(state["step"], "cet6_score")
            self.assertIn("0 到 710", reply)
        state, _, _ = handle_assessment_intake("520", state)
        self.assertEqual(state["step"], "current_blocker")

    def test_invalid_ranking_does_not_advance(self):
        state, _, _ = handle_assessment_intake("开始升学测评", None)
        state, _, _ = handle_assessment_intake("计算机与网络安全学院", state)
        state, _, _ = handle_assessment_intake("计算机", state)
        state, _, _ = handle_assessment_intake("大二", state)
        state, reply, done = handle_assessment_intake("100/15", state)
        self.assertFalse(done)
        self.assertEqual(state["step"], "ranking")
        self.assertIn("排名", reply)

    def test_missing_cohort_size_gets_one_bounded_followup(self):
        state, _, _ = handle_assessment_intake("开始升学测评", None)
        answers = ("计算机与网络安全学院", "计算机科学与技术", "大二", "15", "已通过", "520", "不知道走保研还是考研", "不知道哪条路径更适合当前条件", "1 个月内", "没有", "没有", "南京", "软件工程", "暂时没有", "梯度搭配", "保研", *FINAL_DIAGNOSIS, "3")
        for answer in answers:
            state, _, _ = handle_assessment_intake(answer, state)
        self.assertEqual(state["step"], "cohort_size")
        state, _, _ = handle_assessment_intake("100", state)
        self.assertEqual(state["profile"]["cohortSize"], 100)

    def test_school_preferences_are_forwarded_for_haiwen_matching(self):
        state, _, _ = handle_assessment_intake("开始升学测评", None)
        answers = ("计算机与网络安全学院", "软件工程", "大二", "15/100", "未参加", "不会选学校", *DIAGNOSIS, "没有", "没有", "南京、上海", "软件工程", "南京大学、东南大学")
        for answer in answers:
            state, _, _ = handle_assessment_intake(answer, state)
        self.assertEqual(state["step"], "school_strategy")
        self.assertEqual(state["profile"]["targetUniversities"], ["南京大学", "东南大学"])
        state, _, _ = handle_assessment_intake("偏稳妥", state)
        self.assertEqual(state["profile"]["riskPreference"], "CONSERVATIVE")
        self.assertEqual(state["step"], "goal_priority")

    def test_impossible_daily_study_hours_require_a_new_answer(self):
        state, _, _ = handle_assessment_intake("开始升学测评", None)
        answers = ("计算机与网络安全学院", "软件工程", "大二", "15/100", "未参加", "时间安排混乱", "任务很多，不知道先做什么", "1 个月内", "没有", "没有", "南京", "软件工程", "暂时没有", "梯度搭配", "考研", *FINAL_DIAGNOSIS)
        for answer in answers:
            state, _, _ = handle_assessment_intake(answer, state)
        state, reply, _ = handle_assessment_intake("25", state)
        self.assertEqual(state["step"], "study_hours")
        self.assertIn("0 到 24", reply)

    def test_can_cancel(self):
        state, _, _ = handle_assessment_intake("开始升学测评", None)
        state, reply, done = handle_assessment_intake("退出测评", state)
        self.assertTrue(done)
        self.assertIsNone(state)
        self.assertIn("已退出", reply)

    def test_start_command_always_begins_a_fresh_assessment(self):
        state, _, _ = handle_assessment_intake("开始升学测评", None)
        state, _, _ = handle_assessment_intake("计算机与网络安全学院", state)
        self.assertEqual(state["step"], "major")
        state, reply, done = handle_assessment_intake("开始升学测评", state)
        self.assertFalse(done)
        self.assertEqual(state["step"], "college")
        self.assertEqual(state["profile"], {"school": "成都理工大学"})
        self.assertIn("学院", reply)

    def test_diagnostic_context_is_kept_out_of_scoring_profile(self):
        state, _, _ = handle_assessment_intake("开始升学测评", None)
        for answer in ("计算机与网络安全学院", "软件工程", "大二", "15/100", "未参加"):
            state, _, _ = handle_assessment_intake(answer, state)
        self.assertEqual(state["step"], "current_blocker")
        state, reply, _ = handle_assessment_intake("不知道走保研还是考研", state)
        self.assertIn("不急着二选一", reply)
        self.assertEqual(state["student_context"]["currentConcern"], "不知道走保研还是考研")

        for answer in ("不知道哪条路径更适合当前条件", "1 个月内", "没有", "没有", "南京", "软件工程", "暂时没有", "梯度搭配", "双轨"):
            state, _, _ = handle_assessment_intake(answer, state)
        self.assertEqual(state["step"], "attempted_action")
        for answer in FINAL_DIAGNOSIS:
            state, reply, _ = handle_assessment_intake(answer, state)
        self.assertIn("可执行时间", reply)
        self.assertEqual(state["student_context"]["advisorHelp"], "候选院校和专业是否匹配")
        self.assertEqual(state["student_context"]["sevenDayAction"], "整理目标院校官方要求")
        self.assertNotIn("student_context", state["profile"])


class CampusApiTests(unittest.TestCase):
    def setUp(self):
        self.event_patcher = patch("app.routes.track_event", return_value=True)
        self.track_event = self.event_patcher.start()
        self.client = TestClient(app)
        self.session = self.client.post("/api/session/init").json()
        self.headers = {"X-Session-Token": self.session["token"]}

    def tearDown(self):
        self.client.close()
        self.event_patcher.stop()

    def _post(self, message):
        return self.client.post("/api/assessment/intake", headers=self.headers, json={"session_id": self.session["session_id"], "message": message})

    def _complete(self):
        answers = ("开始升学测评", "计算机与网络安全学院", "计算机科学与技术", "大二", "15/100", "已通过", "520", "不会选学校", *DIAGNOSIS, "没有", "没有", "南京", "计算机科学与技术", "南京大学、东南大学", "梯度搭配", "双轨", *FINAL_DIAGNOSIS, "3")
        with patch("app.routes.run_assessment", return_value=ASSESSMENT) as upstream:
            response = None
            for answer in answers:
                response = self._post(answer)
        self.assertTrue(response.json()["done"])
        self.assertEqual(upstream.call_count, 1)
        self.assertEqual(upstream.call_args.args[0]["school"], "成都理工大学")
        self.assertEqual(upstream.call_args.args[0]["college"], "计算机与网络安全学院")
        self.assertNotIn("currentConcern", upstream.call_args.args[0])
        self.assertEqual(response.json()["assessment"]["campusContext"]["currentConcern"], "不会选学校")
        return response

    def test_cdut_pilot_cohort_is_forwarded(self):
        self._complete()
        with patch("app.routes.create_or_update_lead", return_value={"leadId": "lead-cdut", "qualification": "HOT"}) as upstream:
            self.client.post("/api/assessment/lead", headers=self.headers, json={"session_id": self.session["session_id"], "consent": True, "contact": {"wechat": "test-wechat"}})
        self.assertEqual(upstream.call_args.kwargs["cohort_tag"], "pilot_001_cdut")
        self.assertEqual(upstream.call_args.kwargs["advisor_context"], {
            "currentConcern": "不会选学校",
            "specificBlocker": "不知道自己的条件能冲到什么层次",
            "decisionDeadline": "1 个月内",
            "attemptedAction": "查过政策或招生信息",
            "biggestWorry": "努力方向不对",
            "advisorHelp": "候选院校和专业是否匹配",
            "sevenDayAction": "整理目标院校官方要求",
        })

    def test_requires_valid_token_for_history(self):
        response = self.client.get(f"/api/assessment/history?session_id={self.session['session_id']}", headers={"X-Session-Token": "wrong"})
        self.assertEqual(response.status_code, 401)

    def test_rate_limit_returns_retry_after(self):
        with patch("app.routes.limiter.allow", return_value=(False, 17)):
            response = self.client.post("/api/session/init")
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.headers["Retry-After"], "17")

    def test_same_session_intake_requests_are_serialized(self):
        import app.routes as routes

        original = routes.handle_assessment_intake
        active = 0
        maximum_active = 0
        counter_lock = Lock()

        def observed_handle(message, state):
            nonlocal active, maximum_active
            with counter_lock:
                active += 1
                maximum_active = max(maximum_active, active)
            sleep(0.05)
            try:
                return original(message, state)
            finally:
                with counter_lock:
                    active -= 1

        with patch("app.routes.handle_assessment_intake", side_effect=observed_handle):
            with ThreadPoolExecutor(max_workers=2) as pool:
                list(pool.map(self._post, ("开始升学测评", "开始升学测评")))

        self.assertEqual(maximum_active, 1)

    @patch("app.knowledge_base.search", side_effect=AssertionError("legacy Campus RAG must stay inactive"))
    def test_assessment_uses_haiwen_evidence_without_campus_rag(self, legacy_search):
        response = self._complete()
        payload = response.json()
        self.assertEqual(payload["assessment"]["report"]["schoolRecommendations"][0]["evidenceIds"], ["E1"])
        self.assertEqual(payload["assessment"]["sourceDocuments"]["S1"]["title"], "南京大学2027年招生通知")
        legacy_search.assert_not_called()

    def test_lead_requires_completed_assessment_and_consent(self):
        unauthorized = self.client.post("/api/assessment/lead", headers={"X-Session-Token": "wrong"}, json={"session_id": self.session["session_id"], "consent": True, "contact": {"phone": "13800138000"}})
        self.assertEqual(unauthorized.status_code, 401)
        unfinished = self.client.post("/api/assessment/lead", headers=self.headers, json={"session_id": self.session["session_id"], "consent": True, "contact": {"phone": "13800138000"}})
        self.assertEqual(unfinished.status_code, 409)
        self._complete()
        with patch("app.routes.create_or_update_lead", return_value={"leadId": "lead-no-consent", "qualification": "NURTURE"}) as upstream:
            response = self.client.post("/api/assessment/lead", headers=self.headers, json={"session_id": self.session["session_id"], "consent": False, "contact": {"wechat": "test-wechat"}})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(upstream.call_args.kwargs["contact"]["consentToContact"])

    def test_lead_is_forwarded_idempotently_without_pii_history(self):
        self._complete()
        payload = {"session_id": self.session["session_id"], "consent": True, "request_consultation": True, "contact": {"name": "TEST USER", "phone": "13800138000", "wechat": "test-wechat", "qq": "123456789"}}
        with patch("app.routes.create_or_update_lead", return_value={"leadId": "lead-session", "qualification": "HOT"}) as upstream:
            for _ in range(3):
                response = self.client.post("/api/assessment/lead", headers=self.headers, json=payload)
                self.assertEqual(response.status_code, 200)
        self.assertEqual(upstream.call_count, 3)
        self.assertEqual(upstream.call_args.kwargs["contact"]["qq"], "123456789")
        self.assertTrue(all(call.kwargs["assessment_id"] == self.session["session_id"] for call in upstream.call_args_list))
        history = self.client.get(f"/api/assessment/history?session_id={self.session['session_id']}", headers=self.headers).json()["messages"]
        serialized = str(history)
        self.assertNotIn("13800138000", serialized)
        self.assertNotIn("test@example.com", serialized)
        self.assertIn("复核申请", serialized)

    def test_browser_event_is_authenticated_allowlisted_and_pii_free(self):
        self.track_event.reset_mock()
        payload = {"session_id": self.session["session_id"], "event_id": "event-1", "event_type": "EVIDENCE_OPENED", "metadata": {"source": "official"}}
        response = self.client.post("/api/assessment/event", headers=self.headers, json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["delivered"])
        self.assertEqual(self.client.post("/api/assessment/event", headers={"X-Session-Token": "wrong"}, json=payload).status_code, 401)
        self.assertEqual(self.client.post("/api/assessment/event", headers=self.headers, json={**payload, "event_type": "SALE_CONVERTED"}).status_code, 400)
        self.assertEqual(self.client.post("/api/assessment/event", headers=self.headers, json={**payload, "metadata": {"phone": "13800138000"}}).status_code, 400)
