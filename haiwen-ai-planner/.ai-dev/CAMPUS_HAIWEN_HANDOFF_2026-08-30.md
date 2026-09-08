# Campus × Haiwen 交接文档

更新时间：2026-08-30

## 当前目标与状态

Campus Advisor 已收敛为 Haiwen 的匿名获客与测评入口；Haiwen 是测评、院校证据、行动优先级、线索和 CRM 的唯一业务事实来源。

当前状态：核心闭环已通过本地测试、端到端 Smoke 和生产构建验证。

## 仓库与提交

| 项目 | 绝对路径 | 当前提交 | 本轮关键提交 |
| --- | --- | --- | --- |
| Haiwen AI Planner | `D:\保研考研智能体\haiwen-ai-planner` | `47ffc355ed6dd764ac86e099185c6e3d1c8dcd7c` | `31fa46a`（Campus API contract）、`47ffc35`（离线构建字体修复） |
| Campus Advisor | `C:\Users\LQY\Desktop\campus-advisor` | `81feefefbeb2f64fae6d1be520b2ca900264d250` | `81feefe`（获客渠道闭环） |

Campus 工作树中可能存在以下用户已有的未跟踪目录，禁止清理、暂存或覆盖：`.codex-spreadsheet-ref/`、`.codex-spreadsheet/`、`output/`、`outputs/`、`tmp/`。

## 运行架构

```text
浏览器（Campus :8002）
  → Campus FastAPI：匿名会话、结构化问答、展示、留资表单
  → Haiwen HTTP API（:3011）
      → AssessmentReport / Evidence / SourceDocument
      → PostgreSQL Lead / LeadEvent / CRM / Feishu projection
```

Campus 不参与以下业务决策：评分、路径选择、院校匹配、证据检索、行动优先级、Lead Score。

Campus 的旧 Chroma/RAG、LangGraph、LangChain 资产保留为 legacy，但 active assessment runtime 不会启动或调用它们。

详细定义：

- Campus active runtime：`C:\Users\LQY\Desktop\campus-advisor\.ai-dev\ACTIVE_RUNTIME.md`
- 目标架构：`C:\Users\LQY\Desktop\campus-advisor\.ai-dev\TARGET_ARCHITECTURE_V1.md`

## 关键实现

### Haiwen

- `app/api/assessment/route.ts`：在 assessment HTTP response 中附加 `sourceDocuments`；它们与 `report.evidenceIndex` 的 `sourceDocumentId` 对应，并携带 freshness。
- `proxy.ts`：允许携带 `x-campus-channel-key` 的 Campus 服务端请求访问 `/api/leads`。生产必须配置 `CAMPUS_CHANNEL_API_KEY`；开发环境仅支持本机默认通道键。
- `app/layout.tsx`：不再通过 `next/font/google` 在构建时下载 Geist 字体，避免本地网络环境导致 build 失败。

### Campus

- `app/haiwen_client.py`：唯一的 Haiwen HTTP adapter，调用 `/api/assessment` 与 `/api/leads`。
- `app/assessment_intake.py`：确定性结构化信息采集；支持年级、排名、CET6、科研、竞赛、目标城市/专业、风险偏好，以及按回答触发的追问。
- `app/routes.py`：测评完成时调用 Haiwen；留资前要求完成测评、有效会话、联系方式和 consent。
- `app/assessment_store.py`：Campus SQLite 仅保存匿名会话、非 PII 测评资料/报告、通用历史消息和 Haiwen lead id；姓名、手机、微信、邮箱不会落入 Campus SQLite 或历史消息。
- `qna.html` 与 `static/js/pages/qna.js`：渲染 typed report、院校层级、证据来源、行动优先级和留资表单；不暴露 Lead Score。

## API 合同

Campus 对外：

- `POST /api/session/init`
- `POST /api/assessment/intake`
- `GET /api/assessment/history`
- `POST /api/assessment/lead`

Campus 调用 Haiwen：

- `POST http://127.0.0.1:3011/api/assessment`
- `POST http://127.0.0.1:3011/api/leads`

生产配置（Campus `.env`，不要提交真实 token）：

```dotenv
HAIWEN_BASE_URL=http://127.0.0.1:3011
HAIWEN_ASSESSMENT_URL=http://127.0.0.1:3011/api/assessment
HAIWEN_LEAD_URL=http://127.0.0.1:3011/api/leads
HAIWEN_CAMPUS_API_KEY=<must-match-Haiwen-CAMPUS_CHANNEL_API_KEY>
```

## 本地启动

先启动 Haiwen，再启动 Campus。

```powershell
# Haiwen
Set-Location 'D:\保研考研智能体\haiwen-ai-planner'
pnpm dev

# Campus（另一个 PowerShell）
Set-Location 'C:\Users\LQY\Desktop\campus-advisor'
.\.venv-test\Scripts\python.exe server.py
```

访问：

- Campus：`http://127.0.0.1:8002/`（会重定向到 `/qna.html`）
- Haiwen：`http://127.0.0.1:3011/assessment`

## 已验证

| 验证项 | 结果 |
| --- | --- |
| Campus 单元/API 测试 | PASS，7 项 |
| Campus active 页面与静态资源 | PASS，根路径 `307 → /qna.html`，活动资源 `200` |
| Campus legacy admin/dashboard | `404`，不会进入旧产品 |
| Haiwen `pnpm typecheck` | PASS |
| Haiwen `pnpm test` | PASS，79 passed / 11 skipped |
| Haiwen `pnpm build` | PASS |
| Haiwen `pnpm check` | PASS |
| 强档画像 E2E | PASS，DUAL_TRACK、3 个院校和官方来源 |
| 双轨画像 E2E | PASS |
| 考研/信息不足画像 E2E | PASS |
| 留资 E2E | PASS，consent、咨询事件、Campus 历史无联系方式 |

Feishu 真实投递未做 Smoke，因为本机未配置可用 Feishu 凭据；这不影响 Haiwen lead 本地写入和事件创建。

## 下一步建议

推荐开启新对话后执行：`real-expert-calibration`。

建议先由真实专家使用现有评审包填写，再根据已回收的专家结论校准评分、路径或匹配规则；不要在没有专家样本时重新设计评分模型。

## 新对话可直接粘贴

```text
继续 haiwen 项目。先阅读：
D:\保研考研智能体\haiwen-ai-planner\.ai-dev\CAMPUS_HAIWEN_HANDOFF_2026-08-30.md

当前 Haiwen HEAD：47ffc355ed6dd764ac86e099185c6e3d1c8dcd7c
当前 Campus HEAD：81feefefbeb2f64fae6d1be520b2ca900264d250

请先审计两个仓库 HEAD 和工作树；不要清理 Campus 中已有的未跟踪 output / tmp / spreadsheet 目录。
下一阶段目标：real-expert-calibration。
```
