"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import type { SourceDocument } from "@/domain/evidence/models";
import type { ProgramCandidateSearchResult } from "@/domain/school/repository";

type SearchResponse = ProgramCandidateSearchResult & {
  sourceDocuments: Record<string, SourceDocument>;
};

const inputClass = "h-10 rounded-lg border bg-background px-3 text-sm";

export default function SchoolsPage() {
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams({ year: String(data.get("year")) });
    for (const key of ["city", "major"] as const) {
      const value = data.get(key)?.toString().trim();
      if (value) {
        params.set(key, value);
      }
    }
    try {
      const response = await fetch(`/api/schools?${params.toString()}`);
      if (!response.ok) {
        throw new Error("查询参数无效");
      }
      setResult((await response.json()) as SearchResponse);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "查询失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-muted/30 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header>
          <p className="font-medium text-muted-foreground text-sm">
            M3 synthetic data debugger
          </p>
          <h1 className="mt-1 font-semibold text-2xl">院校事实与证据查询</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            当前结果全部来自 TEST_FIXTURE，不代表正式海文院校数据库。
          </p>
        </header>
        <form
          className="mt-6 grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-[120px_1fr_1fr_auto]"
          onSubmit={search}
        >
          <select
            aria-label="招生年份"
            className={inputClass}
            defaultValue="2026"
            name="year"
          >
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
          <input
            aria-label="目标城市"
            className={inputClass}
            name="city"
            placeholder="城市，例如：上海"
          />
          <input
            aria-label="目标专业"
            className={inputClass}
            name="major"
            placeholder="专业，例如：计算机"
          />
          <button
            className="h-10 rounded-lg bg-primary px-5 font-medium text-primary-foreground text-sm"
            disabled={loading}
            type="submit"
          >
            {loading ? "查询中" : "搜索"}
          </button>
        </form>
        {error ? (
          <p className="mt-4 text-destructive text-sm">{error}</p>
        ) : null}
        {result ? (
          <section className="mt-6 space-y-4">
            <p className="text-muted-foreground text-sm">
              找到 {result.candidates.length} 个候选；缺少条件：
              {result.missingCriteria.join("、") || "无"}
            </p>
            {result.candidates.map((candidate) => (
              <article
                className="rounded-2xl border bg-card p-5 shadow-sm"
                key={candidate.program.id}
              >
                <p className="text-muted-foreground text-sm">
                  {candidate.university.city}
                </p>
                <h2 className="mt-1 font-semibold text-lg">
                  {candidate.university.name} · {candidate.department.name}
                </h2>
                <p className="mt-1">{candidate.program.name}</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="font-medium text-sm">年度政策</h3>
                    <p className="mt-2 text-muted-foreground text-sm">
                      {candidate.admissionPolicy
                        ? candidate.admissionPolicy.examSubjects
                            .map((subject) => subject.name)
                            .join("、")
                        : "无当年统考政策"}
                    </p>
                    {candidate.recommendationPolicies.map((policy) => (
                      <p
                        className="mt-2 text-muted-foreground text-sm"
                        key={policy.id}
                      >
                        {policy.stage}：
                        {policy.englishRequirement ?? "未提供英语门槛"}
                      </p>
                    ))}
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">Evidence</h3>
                    {candidate.evidence.length ? (
                      <ul className="mt-2 space-y-3">
                        {candidate.evidence.map((item) => {
                          const source =
                            result.sourceDocuments[item.sourceDocumentId];
                          return (
                            <li className="text-sm" key={item.id}>
                              <span className="font-mono text-xs">
                                [{item.id}]
                              </span>{" "}
                              {item.excerpt}
                              <p className="mt-1 text-muted-foreground text-xs">
                                {source?.title} · {source?.sourceTrust} ·{" "}
                                {source?.sourceUrl}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="mt-2 text-muted-foreground text-sm">
                        暂无证据片段
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <p className="mt-8 text-muted-foreground text-sm">
            选择年份并输入可选筛选条件开始查询。
          </p>
        )}
      </div>
    </main>
  );
}
