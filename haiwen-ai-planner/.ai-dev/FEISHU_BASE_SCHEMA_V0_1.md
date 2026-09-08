# Feishu Base Schema v0.1

Create exactly two tables manually.

| Table | Field | Type | Required | Source |
| --- | --- | --- | --- | --- |
| 线索 | Lead ID | Text | Yes | `Lead.id` |
| 线索 | Assessment ID, 姓名, 手机号, 微信, 邮箱 | Text | No | Lead/contact |
| 线索 | 允许顾问联系 | Checkbox | Yes | Contact consent |
| 线索 | 创建时间, 更新时间 | Date/time | Yes | Lead timestamps |
| 线索 | 目标城市, 目标院校, 目标专业, 推荐路径, 主要风险, 行动优先级, 冲刺院校, 匹配院校, 稳妥院校, 建议沟通主题 | Text | No | Handoff context |
| 线索 | Lead Score, Fit Score, Intent Score | Number | Yes | Lead score |
| 线索 | Qualification, Priority, Lead Status | Single select or Text | Yes | Lead score/status |
| 线索 | Handoff Snapshot | Long text | No | JSON debug snapshot |
| 线索事件 | Event ID, Event Key, Lead ID, Event Type, Occurred At, Metadata | Text | Yes except Metadata | Lead event |

`Lead ID` and `Event Key` must remain available for idempotent recovery. Field names are the defaults in `FEISHU_LEAD_FIELD_MAP` and `FEISHU_EVENT_FIELD_MAP`; update the centralized map if a Base uses different names.
