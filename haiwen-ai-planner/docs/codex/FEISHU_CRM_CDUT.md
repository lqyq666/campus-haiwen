# Feishu CRM — CDUT Lite

Haiwen PostgreSQL remains the source of truth. Feishu is the only advisor-facing CRM for `pilot_001_cdut`. A lead is projected only after the student supplies at least one contact method and explicitly grants contact consent.

## Required environment

Set these values only in the runtime environment; never commit real credentials:

```text
FEISHU_ENABLED=true
FEISHU_APP_ID=...
FEISHU_APP_SECRET=...
FEISHU_BITABLE_APP_TOKEN=...
FEISHU_LEADS_TABLE_ID=...
FEISHU_EVENTS_TABLE_ID=...
```

The Feishu app must be authorized to read and write records in both tables.

The production-compatible Base uses text fields for `手机号`, `专业排名`, `专业总人数` and `排名百分比`. This avoids Feishu phone-region validation and keeps profile projection compatible with the mapper's string values.

## Lead table fields

Create compatible columns for the field names emitted by `integrations/feishu/lead-mapper.ts`. The CDUT advisor view should expose at least:

```text
线索编号
测评编号
创建时间
姓名
手机号
微信
邮箱
本科学校
学院
本科专业
年级
专业排名
专业总人数
排名百分比
专业排名概览
英语四级
英语六级
科研经历
竞赛经历
学生升学倾向
推荐路径
主要风险
目标城市
目标专业
冲刺院校
匹配院校
稳妥院校
30 天行动重点
线索等级
联系优先级
建议沟通主题
顾问摘要
允许顾问联系
同步状态
销售状态
负责顾问
跟进记录
```

`销售状态` is a Feishu single-select field with these operator-maintained values:

```text
新线索
待联系
已联系
已预约
已成交
暂不考虑
无效
```

`负责顾问` and `跟进记录` are also maintained in Feishu. Haiwen sets their defaults only when creating a record and deliberately omits all three manual fields on later updates.

## Event table fields

The advisor-facing event table uses Chinese labels:

```text
事件编号
事件唯一键
线索编号
事件类型
发生时间
事件详情
```

Haiwen keeps internal event codes stable for scoring and idempotency, but projects the human-facing `事件类型` value in Chinese. Run `pnpm crm:audit-fields` for a read-only schema audit. Run `pnpm crm:migrate-event-fields` for a dry run and add `-- --apply` only during the coordinated application/schema deployment.

## Reliability and retry

The write order is PostgreSQL Lead first, then best-effort Feishu projection. A Feishu failure records `FAILED` in `lead_external_sync` and does not fail lead capture. Transient HTTP 429/5xx and timeouts receive one bounded client retry. Lead ID and Event Key searches make repeated submissions idempotent.

Retry failed projections after correcting credentials, permissions or table fields:

```powershell
pnpm crm:retry-failed
pnpm crm:retry-failed -- --limit=20
```

The command exits non-zero if any attempted lead remains unsynced and prints counts only; it never prints credentials or contact data.

## Live acceptance

CDUT live acceptance completed on 2026-08-30 with the reused Feishu app `鼎江智绩数据集成` and the dedicated Base `Haiwen CDUT CRM`:

```text
Campus → Haiwen Lead → PostgreSQL → Feishu Base record
```

Verified in the real Base:

1. one consented Lead creates one record with contact, CDUT profile, Path, scores, risks, actions and advisor summary;
2. repeating the same Campus submission does not create another Lead or Base record;
3. manually changing `销售状态`, `负责顾问` and `跟进记录`, then resyncing, preserves those values;
4. an invalid token leaves the PostgreSQL Lead intact and a failed sync retry later reaches `SYNCED`.

Evidence from the live run:

- one consented Campus submission produced one PostgreSQL Lead and one Feishu Lead record with all 24 required profile/report field checks present;
- the Base record reached `CRM Sync Status=SYNCED`, with three unique projected events (`ASSESSMENT_COMPLETED`, `CONTACT_SUBMITTED`, `REQUESTED_CONSULTATION`);
- repeated Campus submissions retained the same Base Record ID and did not add Lead or event duplicates;
- after an operator set `销售状态=已联系`, `负责顾问=LIVE-QA` and a follow-up note, another sync preserved all three values;
- a process-scoped invalid app secret produced `FEISHU_AUTH_FAILED` while retaining the PostgreSQL Lead; restoring the valid environment and running `pnpm crm:retry-failed -- --limit=20` moved the same projection to `SYNCED` without creating another Base record.

The timeout and HTTP 500 branches remain deterministic integration-test evidence rather than forced failures against the real Feishu tenant. Both preserve the PostgreSQL Lead and failed-sync state by design.
