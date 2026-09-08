# Campus Advisor · Haiwen 学生入口

Campus Advisor 是万学海文升学测评的渠道层：它收集学生画像、展示 Haiwen 的确定性测评和官方依据，并在报告产生后将经同意的联系方式提交至 Haiwen Lead 系统。

## 运行

先启动 Haiwen AI Planner（端口 `3011`），再启动 Campus：

```powershell
.\.venv-test\Scripts\python.exe server.py
```

打开 `http://127.0.0.1:8002/qna.html`。

| 地址 | 用途 |
| --- | --- |
| `http://127.0.0.1:8002` | Campus 对话问诊与留资入口 |
| `http://127.0.0.1:3011/api/assessment` | Haiwen 决策、院校和官方证据来源 |

配置见 `.env.example`：`HAIWEN_ASSESSMENT_URL` 可覆盖默认 Haiwen assessment 地址；也可通过 `HAIWEN_BASE_URL` 和 `HAIWEN_LEAD_URL` 配置同一服务的 Lead 接口。

## 当前 HTTP 接口

- `POST /api/session/init`
- `POST /api/assessment/intake`
- `GET /api/assessment/history`
- `POST /api/assessment/lead`

Campus 不计算分数、不判断路径、不生成学校匹配，也不使用本地 Chroma RAG 作为测评依据。这些业务事实都来自 Haiwen；Campus 只渲染 Haiwen 返回的 `Evidence → SourceDocument` 引用链。

开发与架构详情见：

- [.ai-dev/ACTIVE_RUNTIME.md](.ai-dev/ACTIVE_RUNTIME.md)
- [.ai-dev/TARGET_ARCHITECTURE_V1.md](.ai-dev/TARGET_ARCHITECTURE_V1.md)
- [PROJECT_EXPORT.md](PROJECT_EXPORT.md)
