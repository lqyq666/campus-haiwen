# Campus Advisor 当前项目导出

## 产品职责

Campus Advisor 是 Haiwen AI Planner 的学生渠道/BFF，不是第二套升学决策系统。

```text
学生对话问诊 → Campus 结构化画像 → Haiwen Assessment
→ 路径、评分、院校匹配、官方 Evidence、Roadmap
→ Campus 分层展示 → 联系同意 → Haiwen Lead/CRM/Feishu
```

Campus 负责会话、确定性问诊、前端呈现和留资表单；Haiwen 是评分、路径、学校事实、证据、路线图、Lead Score 和 Feishu 的唯一事实源。

## 活跃结构

```text
qna.html + static/js/pages/qna.js
  ↓  /api/session/init, /api/assessment/intake, /api/assessment/lead
app/routes.py
  ↓
app/assessment_intake.py       # 确定性基础题和条件追问
app/assessment_store.py        # 匿名 SQLite session / 非 PII 历史
app/haiwen_client.py           # 集中式 server-side HTTP adapter
  ↓
Haiwen :3011 /api/assessment + /api/leads
```

### 已实现功能

- 基础问诊：年级、排名、英语、科研、竞赛、城市、专业、风险偏好。
- 条件追问：科研/竞赛成果、英语提升目标、路径偏好和学习投入。
- `input_spec` 快捷控件：年级、科研、竞赛、路径、风险偏好和双数字排名输入。
- Haiwen 报告分层展示：路径、两项竞争力诊断、风险、学校 tier、官方依据和行动重点。
- 每个学校证据只来自 Haiwen 的 `evidenceIndex + sourceDocuments`，以 HTTPS 新窗口链接打开官方来源。
- CURRENT 与历史官方资料分别呈现；历史资料不会伪装为当前年度政策。
- 联系方式表单仅在报告之后出现；至少一种联系方式、明确联系同意、可申请老师复核。
- Lead 使用 Campus `session_id` 作为 Haiwen `assessmentId`，重复点击保持 Haiwen 侧幂等；Campus 不展示 Lead Score/HOT/URGENT。
- 联系方式不写入 Campus SQLite 或对话历史。

## 数据和安全

- 浏览器把匿名 `session_id` 和 token 保存在 localStorage；每次读取历史或提交 Lead 都需要 `X-Session-Token`。
- Campus SQLite 保存 intake state、已完成的非 PII profile/report、泛化历史状态和 Haiwen lead id。
- PII 只从浏览器经 Campus server 临时转发给 Haiwen `/api/leads`。
- 前端报告用 DOM `textContent` 组装；官方链接限定 HTTPS、`target=_blank` 和 `rel=noopener noreferrer`，不使用 Markdown/CDN 渲染器。

## 本地 RAG 和旧功能

`app/knowledge_base.py`、`data/knowledge/admissions_sources.json`、`data/chroma_db/` 被保留为 legacy/supplementary 数据，但 active assessment runtime 不会初始化或查询 Chroma。Campus 不再为 Haiwen recommendation 另行检索或追加 citation。

`admin.html`、`dashboard.html`、`index.html`、旧 agent/chat/auth/payment 模块仍在仓库中但未被 active FastAPI runtime 注册；旧页面和 `/api/chat` 保持 404。

## 运行

```powershell
# 先启动 Haiwen :3011
# 再启动 Campus :8002
.\.venv-test\Scripts\python.exe server.py
```

访问 `http://127.0.0.1:8002/qna.html`。

## 已知部署限制

- Campus 使用 SQLite，`WEB_CONCURRENCY=1`。
- 完整测评与 Lead 依赖 Haiwen :3011；Haiwen 不可用时 Campus 页面和问诊可打开，但最终提交会提供可重试的友好错误。
- 当前 Campus 不再依赖 Chroma、LangGraph、LangChain 或公网 Markdown CDN。
