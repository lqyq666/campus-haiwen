"use client";

import type { ChangeEvent, FormEvent, MouseEvent, ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { StudentProfile } from "@/domain/student/schema";

type CalibrationCase = {
  caseCode: string;
  createdAt: string;
  id: string;
  sourceType: string;
  status: string;
  studentProfileSnapshot: StudentProfile;
};
type Dashboard = {
  actionRecall: number;
  caseCount: number;
  examScoreRangeAgreement: number;
  interExpertAgreement: number;
  pathAgreement: number;
  recommendationScoreRangeAgreement: number;
  reviewerCount: number;
  riskPrecision: number;
  riskRecall: number;
  schoolTierAgreement: number;
  topDisagreementTypes: Array<{ count: number; type: string }>;
};
type Review = { id: string; lockedAt: string };
type Reveal = {
  disagreements: Array<{ severity: string; type: string }>;
  systemPrediction: {
    examScore: number;
    path: string;
    recommendationScore: number;
    risks: string[];
    schoolTiers: Array<{ programId: string; tier: string }>;
  };
};

const control =
  "h-10 w-full rounded-lg border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textarea = `${control} h-auto min-h-24 py-2`;

export default function CalibrationPage() {
  const [adminKey, setAdminKey] = useState("");
  const [reviewerCode, setReviewerCode] = useState("");
  const [roleType, setRoleType] = useState("PLANNING_EXPERT");
  const [experienceLevel, setExperienceLevel] = useState("SENIOR");
  const [cases, setCases] = useState<CalibrationCase[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard>();
  const [selected, setSelected] = useState<CalibrationCase>();
  const [review, setReview] = useState<Review>();
  const [reveal, setReveal] = useState<Reveal>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const request = async (path: string, init?: RequestInit) => {
    const response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Calibration-Admin-Key": adminKey,
        ...init?.headers,
      },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? "访问密钥无效或未配置。"
          : "请求未完成，请检查输入后重试。"
      );
    }
    return payload;
  };

  async function connect(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const [casePayload, metricPayload] = await Promise.all([
        request("/api/calibration/cases"),
        request("/api/calibration/dashboard"),
      ]);
      setCases(casePayload.cases as CalibrationCase[]);
      setDashboard(metricPayload as Dashboard);
      sessionStorage.setItem("haiwen-calibration-key", adminKey);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "连接失败。");
    } finally {
      setBusy(false);
    }
  }

  async function openCase(item: CalibrationCase) {
    if (!(reviewerCode.trim() && experienceLevel.trim())) {
      setError("请先填写评审人代号和经验级别。");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await request(
        `/api/calibration/cases/${encodeURIComponent(item.id)}/open`,
        {
          body: JSON.stringify({ experienceLevel, reviewerCode, roleType }),
          method: "POST",
        }
      );
      setSelected(item);
      setReview(undefined);
      setReveal(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法打开案例。");
    } finally {
      setBusy(false);
    }
  }

  function changeAdminKey(event: ChangeEvent<HTMLInputElement>) {
    setAdminKey(event.target.value);
  }

  function changeReviewerCode(event: ChangeEvent<HTMLInputElement>) {
    setReviewerCode(event.target.value);
  }

  function changeRoleType(event: ChangeEvent<HTMLSelectElement>) {
    setRoleType(event.target.value);
  }

  function changeExperienceLevel(event: ChangeEvent<HTMLInputElement>) {
    setExperienceLevel(event.target.value);
  }

  async function selectCase(event: MouseEvent<HTMLButtonElement>) {
    const item = cases.find(
      (candidate) => candidate.id === event.currentTarget.value
    );
    if (item) {
      await openCase(item);
    }
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const data = new FormData(event.currentTarget);
      const schoolTiers = parseSchoolTiers(
        String(data.get("schoolTiers") ?? "[]")
      );
      const payload = await request("/api/calibration/reviews", {
        body: JSON.stringify({
          caseId: selected.id,
          judgment: {
            decisionChangeConditions: String(
              data.get("decisionChangeConditions") ?? ""
            ),
            examScoreRange: scoreRange(data, "examMin", "examMax"),
            missingInformation: list(data, "missingInformation"),
            notes: String(data.get("notes") ?? "") || undefined,
            path: data.get("path"),
            recommendationScoreRange: scoreRange(
              data,
              "recommendationMin",
              "recommendationMax"
            ),
            schoolTiers,
            topActions: list(data, "topActions"),
            topRisks: list(data, "topRisks"),
          },
          reviewerCode,
        }),
        method: "POST",
      });
      setReview(payload.review as Review);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "提交失败。");
    } finally {
      setBusy(false);
    }
  }

  async function revealPrediction() {
    if (!review) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      setReveal(
        (await request(`/api/calibration/reviews/${review.id}/reveal`, {
          body: JSON.stringify({ reviewerCode }),
          method: "POST",
        })) as Reveal
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "对比暂时不可用。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-muted/30 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="border-b pb-6">
          <p className="font-medium text-muted-foreground text-sm">
            Haiwen internal
          </p>
          <h1 className="mt-1 text-balance font-semibold text-2xl">
            专家盲评与校准工作台
          </h1>
          <p className="mt-2 max-w-3xl text-pretty text-muted-foreground text-sm">
            先独立判断，再查看系统结果。这里校准的是工程模型，不是考核专家；分数请填写合理区间。
          </p>
        </header>

        <form
          className="mt-6 flex flex-wrap items-end gap-3 border-b pb-6"
          onSubmit={connect}
        >
          <Field
            className="min-w-64 flex-1"
            htmlFor="admin-key"
            label="内部访问密钥"
          >
            <input
              autoComplete="off"
              className={control}
              id="admin-key"
              onChange={changeAdminKey}
              required
              type="password"
              value={adminKey}
            />
          </Field>
          <Field
            className="min-w-48"
            htmlFor="reviewer-code"
            label="评审人代号（无需姓名）"
          >
            <input
              className={control}
              id="reviewer-code"
              onChange={changeReviewerCode}
              placeholder="例如 expert-07"
              required
              value={reviewerCode}
            />
          </Field>
          <Field className="min-w-44" htmlFor="reviewer-role" label="角色">
            <select
              className={control}
              id="reviewer-role"
              onChange={changeRoleType}
              value={roleType}
            >
              <option value="PLANNING_EXPERT">规划专家</option>
              <option value="CONSULTANT">咨询顾问</option>
              <option value="SALES_OR_OPERATIONS">销售/运营</option>
            </select>
          </Field>
          <Field
            className="min-w-36"
            htmlFor="experience-level"
            label="经验级别"
          >
            <input
              className={control}
              id="experience-level"
              onChange={changeExperienceLevel}
              required
              value={experienceLevel}
            />
          </Field>
          <Button disabled={busy} size="lg" type="submit">
            {busy ? "连接中" : "进入工作台"}
          </Button>
        </form>
        {error ? (
          <p
            className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-sm"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {dashboard ? <Metrics dashboard={dashboard} /> : null}
        {cases.length ? (
          <div className="mt-8 grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside
              aria-label="待评案例"
              className="lg:sticky lg:top-6 lg:self-start"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <h2 className="font-semibold">案例队列</h2>
                <span className="text-muted-foreground text-sm">
                  {cases.length} 例
                </span>
              </div>
              <div className="divide-y">
                {cases.map((item) => (
                  <button
                    className={`w-full px-1 py-3 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected?.id === item.id ? "font-medium text-foreground" : "text-muted-foreground"}`}
                    key={item.id}
                    onClick={selectCase}
                    type="button"
                    value={item.id}
                  >
                    <span className="block text-foreground">
                      {item.caseCode}
                    </span>
                    <span className="mt-1 block">
                      {item.sourceType} · {item.status}
                    </span>
                  </button>
                ))}
              </div>
            </aside>
            <section>
              {selected ? (
                <ReviewWorkspace
                  busy={busy}
                  onReveal={revealPrediction}
                  onSubmit={submitReview}
                  reveal={reveal}
                  review={review}
                  selected={selected}
                />
              ) : (
                <EmptyState />
              )}
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function Metrics({ dashboard }: { dashboard: Dashboard }) {
  const values = [
    ["案例", dashboard.caseCount.toString()],
    ["评审人", dashboard.reviewerCount.toString()],
    ["路径一致", percent(dashboard.pathAgreement)],
    ["保研分区间", percent(dashboard.recommendationScoreRangeAgreement)],
    ["考研分区间", percent(dashboard.examScoreRangeAgreement)],
    ["风险召回", percent(dashboard.riskRecall)],
    ["风险精确", percent(dashboard.riskPrecision)],
    ["院校层级", percent(dashboard.schoolTierAgreement)],
    ["行动召回", percent(dashboard.actionRecall)],
    ["专家间一致", percent(dashboard.interExpertAgreement)],
  ];
  return (
    <section aria-label="校准指标" className="mt-6 overflow-x-auto border-y">
      <dl className="flex min-w-max divide-x">
        {values.map(([label, value]) => (
          <div className="min-w-32 px-4 py-4 first:pl-0" key={label}>
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="mt-1 font-semibold text-lg tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t py-3 text-muted-foreground text-xs">
        主要分歧：
        {dashboard.topDisagreementTypes
          .map((item) => `${item.type} ${item.count}`)
          .join("、") || "暂无"}
      </p>
    </section>
  );
}

function ReviewWorkspace({
  busy,
  onReveal,
  onSubmit,
  reveal,
  review,
  selected,
}: {
  busy: boolean;
  onReveal: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  reveal?: Reveal;
  review?: Review;
  selected: CalibrationCase;
}) {
  const profile = selected.studentProfileSnapshot;
  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-semibold text-xl">{selected.caseCode}</h2>
        <p className="mt-2 text-muted-foreground text-sm">
          盲评材料仅包含匿名画像。提交前系统预测不会发送到浏览器。
        </p>
        <dl className="mt-5 grid gap-x-8 gap-y-3 border-y py-5 sm:grid-cols-2">
          <Fact label="年级" value={profile.grade} />
          <Fact
            label="排名 / 总人数"
            value={
              profile.rank && profile.cohortSize
                ? `${profile.rank} / ${profile.cohortSize}`
                : undefined
            }
          />
          <Fact
            label="CET4 / CET6"
            value={`${profile.cet4Score ?? profile.cet4Status} / ${profile.cet6Score ?? profile.cet6Status}`}
          />
          <Fact label="目标城市" value={profile.targetCities.join("、")} />
          <Fact label="目标专业" value={profile.targetMajors.join("、")} />
          <Fact
            label="科研 / 竞赛"
            value={`${profile.researchExperiences.length} / ${profile.competitionExperiences.length}`}
          />
        </dl>
      </section>
      {review ? (
        <section className="rounded-xl bg-muted p-5">
          <h3 className="font-semibold">专家答案已锁定</h3>
          <p className="mt-1 text-muted-foreground text-sm">
            提交时间：{review.lockedAt}
          </p>
          {reveal ? (
            <PredictionComparison reveal={reveal} />
          ) : (
            <Button
              className="mt-4"
              disabled={busy}
              onClick={onReveal}
              type="button"
            >
              查看系统预测与分歧
            </Button>
          )}
        </section>
      ) : (
        <ReviewForm busy={busy} onSubmit={onSubmit} />
      )}
    </div>
  );
}

function ReviewForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field htmlFor="review-path" label="路径判断">
          <select className={control} id="review-path" name="path">
            <option value="RECOMMENDATION">保研为主</option>
            <option value="POSTGRAD_EXAM">考研为主</option>
            <option value="DUAL_TRACK">双轨</option>
            <option value="INSUFFICIENT_DATA">信息不足</option>
          </select>
        </Field>
        <RangeFields
          label="保研竞争力区间"
          maxName="recommendationMax"
          minName="recommendationMin"
        />
        <RangeFields
          label="考研准备度区间"
          maxName="examMax"
          minName="examMin"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="top-risks" label="主要风险（逗号或换行分隔）">
          <textarea className={textarea} id="top-risks" name="topRisks" />
        </Field>
        <Field htmlFor="top-actions" label="优先行动（逗号或换行分隔）">
          <textarea className={textarea} id="top-actions" name="topActions" />
        </Field>
        <Field htmlFor="missing-information" label="缺少的信息">
          <textarea
            className={textarea}
            id="missing-information"
            name="missingInformation"
          />
        </Field>
        <Field
          hint='JSON 数组，例如 [{"programId":"...","tier":"MATCH"}]'
          htmlFor="school-tiers"
          label="院校层级判断"
        >
          <textarea
            className={textarea}
            defaultValue="[]"
            id="school-tiers"
            name="schoolTiers"
          />
        </Field>
      </div>
      <Field
        htmlFor="decision-change-conditions"
        label="哪些信息发生变化，会让你改变当前判断？"
      >
        <textarea
          className={textarea}
          id="decision-change-conditions"
          name="decisionChangeConditions"
          required
        />
      </Field>
      <Field
        htmlFor="review-notes"
        label="补充说明（不会进入匿名导出）"
        optional
      >
        <textarea className={textarea} id="review-notes" name="notes" />
      </Field>
      <Button disabled={busy} size="lg" type="submit">
        {busy ? "提交中" : "提交并锁定专家判断"}
      </Button>
    </form>
  );
}

function PredictionComparison({ reveal }: { reveal: Reveal }) {
  return (
    <div className="mt-5 border-t pt-5">
      <h4 className="font-medium">系统预测（提交后揭示）</h4>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <Fact label="路径" value={reveal.systemPrediction.path} />
        <Fact
          label="保研分"
          value={String(reveal.systemPrediction.recommendationScore)}
        />
        <Fact
          label="考研分"
          value={String(reveal.systemPrediction.examScore)}
        />
      </div>
      <p className="mt-4 text-sm">
        记录到 {reveal.disagreements.length} 项分歧：
        {reveal.disagreements
          .map((item) => `${item.type}（${item.severity}）`)
          .join("、") || "无"}
      </p>
    </div>
  );
}
function EmptyState() {
  return (
    <div className="border-y py-16 text-center">
      <h2 className="font-semibold">选择一个案例开始盲评</h2>
      <p className="mt-2 text-muted-foreground text-sm">
        系统答案将在你提交并锁定判断后出现。
      </p>
    </div>
  );
}
function Field({
  children,
  className = "",
  hint,
  htmlFor,
  label,
  optional = false,
}: {
  children: ReactNode;
  className?: string;
  hint?: string;
  htmlFor: string;
  label: string;
  optional?: boolean;
}) {
  return (
    <label className={`block ${className}`} htmlFor={htmlFor}>
      <span className="mb-1.5 block font-medium text-sm">
        {label}
        {optional ? (
          <span className="ml-1 font-normal text-muted-foreground">选填</span>
        ) : null}
      </span>
      {children}
      {hint ? (
        <span className="mt-1 block text-muted-foreground text-xs">{hint}</span>
      ) : null}
    </label>
  );
}
function RangeFields({
  label,
  maxName,
  minName,
}: {
  label: string;
  maxName: string;
  minName: string;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 font-medium text-sm">{label}</legend>
      <div className="flex items-center gap-2">
        <input
          aria-label={`${label}下限`}
          className={control}
          max="100"
          min="0"
          name={minName}
          placeholder="下限"
          required
          type="number"
        />
        <span aria-hidden>—</span>
        <input
          aria-label={`${label}上限`}
          className={control}
          max="100"
          min="0"
          name={maxName}
          placeholder="上限"
          required
          type="number"
        />
      </div>
    </fieldset>
  );
}
function Fact({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 text-sm">{value || "未提供"}</dd>
    </div>
  );
}
function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}
function list(data: FormData, name: string) {
  return String(data.get(name) ?? "")
    .split(/[，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
function scoreRange(data: FormData, minName: string, maxName: string) {
  return { max: Number(data.get(maxName)), min: Number(data.get(minName)) };
}
function parseSchoolTiers(value: string) {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error("院校层级必须是 JSON 数组。");
  }
  return parsed;
}
