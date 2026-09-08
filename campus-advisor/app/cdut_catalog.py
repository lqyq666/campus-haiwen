"""Official CDUT college-major options used only to simplify Campus intake.

Sources checked 2026-08-31:
- https://aao.cdut.edu.cn/info/1236/7048.htm
- https://cie.cdut.edu.cn/info/1114/1994.htm
- https://www.cdut.edu.cn/info/1414/22837.htm
"""

COLLEGE_MAJOR_OPTIONS: dict[str, tuple[str, ...]] = {
    "地球与行星科学学院": (
        "地质学", "地球化学", "资源勘查工程（固体矿产）", "测绘工程", "行星科学",
    ),
    "能源学院（页岩气现代产业学院）": (
        "石油工程", "资源勘查工程（石油地质）", "碳储科学与工程", "新能源科学与工程", "油气储运工程",
    ),
    "环境与土木工程学院": (
        "土木工程", "地下水科学与工程", "工程力学", "地质工程", "城市地下空间工程", "工程管理", "应急技术与管理",
    ),
    "地球物理学院": (
        "地球物理学", "勘查技术与工程", "空间科学与技术", "智能地球探测",
    ),
    "核技术与自动化工程学院": (
        "测控技术与仪器", "核工程与核技术", "辐射防护与核安全", "电气工程及其自动化", "核化工与核燃料工程", "智能感知工程",
    ),
    "材料与化学化工学院（锂资源与锂电产业学院）": (
        "应用化学", "材料科学与工程", "化学工程与工艺", "新能源材料与器件", "化学",
    ),
    "管理科学学院": (
        "工商管理", "电子商务", "大数据管理与应用", "人力资源管理", "物流管理",
    ),
    "马克思主义学院": ("思想政治教育",),
    "文法学院（纪检监察学院）": ("法学", "社会学", "纪检监察"),
    "外国语学院": ("英语", "日语", "翻译", "商务英语"),
    "商学院": ("市场营销", "经济学", "会计学", "投资学", "财务管理", "数字经济"),
    "传播科学与艺术学院": (
        "广播电视编导", "表演", "播音与主持艺术", "视觉传达设计", "广播电视学", "广告学",
    ),
    "体育学院": ("社会体育指导与管理", "休闲体育"),
    "计算机与网络安全学院（示范性软件学院）": (
        "计算机科学与技术", "软件工程", "网络空间安全", "人工智能", "物联网工程", "数字媒体技术",
    ),
    "地理与规划学院": (
        "遥感科学与技术", "地理信息科学", "建筑学", "人文地理与城乡规划", "风景园林", "旅游管理",
    ),
    "生态环境学院": ("环境工程", "环境生态工程", "环境科学与工程"),
    "数学科学学院": ("数学与应用数学", "应用统计学", "信息与计算科学"),
    "物理学院": ("应用物理学", "量子信息科学", "智能科学与技术"),
    "机电工程学院": ("信息工程", "通信工程", "机械工程", "机器人工程", "电子信息工程", "工业设计"),
    "国际教育学院（成都理工大学牛津布鲁克斯学院）": (
        "工商管理（中英）", "会计学（中英）", "计算机科学与技术（中英）", "软件工程（中英）",
    ),
}

COLLEGE_OPTIONS = tuple(COLLEGE_MAJOR_OPTIONS.keys())


def majors_for_college(college: str) -> list[str]:
    """Return official options while tolerating historical short college names."""
    normalized = college.strip().replace(" ", "")
    for official_name, majors in COLLEGE_MAJOR_OPTIONS.items():
        official_normalized = official_name.replace(" ", "")
        short_name = official_normalized.split("（", 1)[0]
        if normalized in {official_normalized, short_name} or normalized.startswith(short_name):
            return list(majors)
    return []
