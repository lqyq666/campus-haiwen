# Sources: 成都理工大学学院与本科专业

## Official sources

- 成都理工大学教务处，《成都理工大学本科专业目录表》，2026-05-26：
  https://aao.cdut.edu.cn/info/1236/7048.htm
  - 列出 87 个本科专业、专业代码、学制和学位门类。
- 成都理工大学国际教育学院，《成都理工大学2026年普通高等学校联合招收华侨港澳台学生招生简章》，2026：
  https://cie.cdut.edu.cn/info/1114/1994.htm
  - 提供 19 个学院与招生专业的对应表。
- 成都理工大学，《成都理工大学瞄准国家战略前沿，8个“硬核”新专业落地》，2026-05-06：
  https://www.cdut.edu.cn/info/1414/22837.htm
  - 确认量子信息科学、机器人工程、智能感知工程、智能地球探测、碳储科学与工程、应急技术与管理、纪检监察、数字经济纳入 2026 本科招生计划。
- 成都理工大学计算机与网络安全学院，《前沿技术引领，多元平台支撑，计算机与网络安全学院（示范性软件学院）重磅来袭！》，2025-05-16：
  https://cist.cdut.edu.cn/info/1135/7341.htm
  - 确认计算机科学与技术、软件工程、网络空间安全、人工智能、物联网工程、数字媒体技术等本科专业。
- 成都理工大学物理学院，《学院介绍》：
  https://cop.cdut.edu.cn/xygklj/xyjs.htm
  - 确认应用物理学、量子信息科学、智能科学与技术归属物理学院。

## Local code evidence

- `D:/保研考研智能体/haiwen-ai-planner/domain/student/schema.ts`
  - Haiwen 已支持 CET4/CET6 分数与状态字段，分数范围均为 0–710。
- `C:/Users/LQY/Desktop/campus-advisor/app/assessment_intake.py`
  - Campus 当前使用确定性状态机，适合通过 `input_spec` 增加展示元数据而不改变 Haiwen 业务事实边界。
