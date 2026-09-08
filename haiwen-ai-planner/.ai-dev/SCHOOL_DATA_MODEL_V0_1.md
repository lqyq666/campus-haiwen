# School Data Model v0.1

## 实体关系

```mermaid
University --> Department
Department --> Program
Program --> AdmissionPolicy
Program --> RecommendationPolicy
SourceDocument --> Evidence
Program --> Evidence
```

- University、Department、Program 是稳定实体。
- AdmissionPolicy 与 RecommendationPolicy 是按 `programId + admissionYear` 保存的年度事实。
- 考研与推免政策分表，未知字段保持空值或 `UNKNOWN`，不从名称推断。

## Policy 年份规则

- `admissionYear` 是政策一等字段，数据库约束为 2000–2100。
- 新年度必须 INSERT 新版本，禁止把 2025 policy 更新成 2026。
- Candidate Search 只返回查询年份的政策和 Evidence，不用旧年份补当前事实。

## SourceDocument、Evidence 与 Provenance

- Policy 通过 `sourceDocumentId` 追溯 SourceDocument。
- Evidence 保存来源原文中的具体 excerpt，并关联 SourceDocument 与 Program。
- Evidence ID 使用稳定 citation key（fixture 为 `EV-000001` 格式）。
- `verifyEvidenceSpan` 只做确定性原文包含验证，允许安全 whitespace normalization，不使用 LLM 或 fuzzy matcher。

## Hash 与去重

- 文本先折叠空白并 trim，再由 Node.js SHA-256 生成 content hash。
- SourceDocument 使用 `canonicalUrl/sourceUrl + contentHash` 去重。
- Evidence 写入前验证 excerpt hash 和 SourceDocument.rawText。

## Candidate Search

- 支持 targetCities、targetMajors、targetUniversities、admissionYear、admissionType。
- 空数组表示不施加该筛选条件，同时通过 missingCriteria 告知上层缺失条件。
- 当前只返回候选，不输出冲刺、稳妥、保底判断。
- Evidence Search 是 repository 后面的确定性文本包含检索，未来可替换为 PostgreSQL FTS。

## 测试数据策略

- M3 包含 3 所 synthetic 大学、4 个学院、12 个 Program 和少量年度政策/证据。
- 所有来源均使用 `.invalid` URL，sourceType/sourceTrust 为 `TEST_FIXTURE`，publisher 为 `HAIWEN_SYNTHETIC_FIXTURE`。
- **M3 fixtures 不代表正式海文院校数据库，不得作为真实招生事实展示或传播。**

## 当前局限

- 不采集外部网页，不包含全国院校数据。
- 不实现 embedding、向量搜索、reranker、LLM 抽取或最终院校匹配。
- rawText 暂存 PostgreSQL；大规模文档存储与真实数据导入留待后续里程碑。
