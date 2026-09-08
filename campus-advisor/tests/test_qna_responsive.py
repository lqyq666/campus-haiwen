import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


class QnaResponsiveContractTests(unittest.TestCase):
    def test_assessment_html_is_not_cached_across_ui_releases(self):
        from fastapi.testclient import TestClient
        from app import app

        with TestClient(app) as client:
            response = client.get("/qna.html")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["Cache-Control"], "no-cache, no-store, must-revalidate")

    def test_mobile_viewport_tracks_browser_chrome_and_safe_areas(self):
        html = (ROOT / "qna.html").read_text(encoding="utf-8")
        script = (ROOT / "static/js/pages/qna.js").read_text(encoding="utf-8")
        styles = (ROOT / "static/css/pages/qna.css").read_text(encoding="utf-8")

        self.assertIn("viewport-fit=cover", html)
        self.assertIn("window.visualViewport", script)
        self.assertIn("--app-height", styles)
        self.assertIn("safe-area-inset-bottom", styles)
        self.assertRegex(script, re.compile(r"renderInputSpec\(data\.input_spec\);\s*messages\.scrollTop = messages\.scrollHeight;"))

    def test_mobile_choices_scroll_and_touch_targets_are_at_least_44px(self):
        styles = (ROOT / "static/css/pages/qna.css").read_text(encoding="utf-8")

        self.assertRegex(styles, re.compile(r"\.quick-actions\s*\{[^}]*overflow-y:\s*auto", re.S))
        for selector in (
            r"\.quick-button",
            r"\.report-restart",
        ):
            self.assertRegex(
                styles,
                re.compile(rf"{selector}\s*\{{[^}}]*min-height:\s*44px", re.S),
            )

    def test_contact_form_is_visible_without_review_disclosure(self):
        script = (ROOT / "static/js/pages/qna.js").read_text(encoding="utf-8")

        self.assertIn("element('section', '', 'lead-card')", script)
        self.assertIn("element('header', '', 'lead-summary')", script)
        self.assertIn("element('button', '提交并申请人工复核', 'lead-submit')", script)
        self.assertIn("请老师结合本次测评进一步核对", script)
        self.assertIn("微信号必填；姓名、手机号和 QQ 可以选填", script)
        self.assertIn("Boolean(fd.get('wechat'))", script)
        self.assertIn("不会显示在测评报告或对话记录中", script)
        self.assertNotIn("element('details', '', 'lead-card')", script)
        self.assertNotIn("appendText(leadSummary, 'b', '申请复核')", script)

    def test_contact_form_precedes_the_overall_report(self):
        script = (ROOT / "static/js/pages/qna.js").read_text(encoding="utf-8")
        styles = (ROOT / "static/css/pages/qna.css").read_text(encoding="utf-8")

        overall = script.index("element('section', '', 'overall-report')")
        contact = script.index("reportElement.appendChild(renderLeadForm())")
        append_overall = script.index("reportElement.appendChild(overall)")

        self.assertLess(contact, append_overall)
        self.assertNotIn("'保研竞争力'", script)
        self.assertNotIn("'考研准备度'", script)
        self.assertNotIn("renderScoreCard", script)
        self.assertIn("'当前优势'", script)
        self.assertIn("'核心问题'", script)
        self.assertIn("personalNarrative(assessment)", script)
        self.assertIn("专业老师可以帮助你减少试错", script)
        self.assertNotIn("'报告依据'", script)
        self.assertNotIn("'提升重点'", script)
        self.assertNotIn("'院校参考'", script)
        self.assertNotIn("'先做一件事'", script)
        self.assertIn("仍需要专业老师", script)
        self.assertIn("lead-contact-grid", script)
        self.assertRegex(styles, re.compile(r"\.lead-contact-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2", re.S))
        self.assertNotIn("element('section', '', 'report-section report-schools')", script)
        self.assertNotIn("element('section', '', 'report-section report-plan')", script)
        self.assertNotIn("匹配 ' + Math.round(match.score)", script)


if __name__ == "__main__":
    unittest.main()
