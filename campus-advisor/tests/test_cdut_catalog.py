import unittest

from app.cdut_catalog import COLLEGE_MAJOR_OPTIONS, COLLEGE_OPTIONS, majors_for_college


class CdutCatalogTests(unittest.TestCase):
    def test_catalog_covers_all_official_teaching_colleges_and_majors(self):
        self.assertGreaterEqual(len(COLLEGE_OPTIONS), 20)
        self.assertGreaterEqual(sum(len(majors) for majors in COLLEGE_MAJOR_OPTIONS.values()), 87)
        self.assertIn("马克思主义学院", COLLEGE_OPTIONS)
        self.assertIn("体育学院", COLLEGE_OPTIONS)
        self.assertIn("国际教育学院（成都理工大学牛津布鲁克斯学院）", COLLEGE_OPTIONS)

    def test_historical_short_college_name_resolves_to_current_catalog(self):
        majors = majors_for_college("计算机与网络安全学院")
        self.assertIn("软件工程", majors)
        self.assertIn("数字媒体技术", majors)


if __name__ == "__main__":
    unittest.main()
