"use client";

import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { useCallback, useState } from "react";
import type {
  AssessmentReport,
  SchoolMatchTier,
} from "@/domain/recommendation/models";
import type { GeneratedReportNarrative } from "@/domain/report/models";
import type { StudentProfile } from "@/domain/student/schema";
import { studentProfileSchema } from "@/domain/student/schema";

const input =
  "h-11 w-full rounded-lg border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const steps = [
  "基本信息",
  "学业情况",
  "英语情况",
  "科研与竞赛",
  "升学目标",
  "学习投入",
  "确认",
];
type Result = {
  narrative: GeneratedReportNarrative | null;
  profile: StudentProfile;
  report: AssessmentReport;
  warnings: string[];
};

export default function AssessmentPage() {
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const previousStep = () => setCurrent((value) => value - 1);
  const nextStep = () => setCurrent((value) => value + 1);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const data = new FormData(event.currentTarget);
    const parsed = studentProfileSchema.safeParse({
      cet4Score: numeric(data, "cet4"),
      cet6Score: numeric(data, "cet6"),
      cohortSize: numeric(data, "cohort"),
      competitionExperiences:
        text(data, "competition") && text(data, "competition") !== "NONE"
          ? [
              {
                award: "已获奖",
                level: text(data, "competition"),
                name: "竞赛经历",
              },
            ]
          : [],
      dailyStudyHours: numeric(data, "hours"),
      gpa: numeric(data, "gpa"),
      grade: text(data, "grade"),
      internships:
        data.get("internship") === "yes"
          ? [
              {
                organization: "实习单位",
                relevance: "MEDIUM",
                role: "实习生",
              },
            ]
          : [],
      papers:
        data.get("paper") === "yes"
          ? [
              {
                authorship: "OTHER",
                status: "SUBMITTED",
                title: "论文或投稿",
              },
            ]
          : [],
      rank: numeric(data, "rank"),
      researchExperiences:
        data.get("research") === "yes"
          ? [{ output: "已参与项目", role: "PARTICIPANT", title: "科研经历" }]
          : [],
      riskPreference: text(data, "risk"),
      targetCities: words(data, "cities"),
      targetMajors: words(data, "targets"),
      targetUniversities: words(data, "schools"),
      undergraduateMajor: text(data, "major"),
      undergraduateUniversity: text(data, "university"),
    });
    if (!parsed.success) {
      setError(
        "请检查已填写的信息：排名不能大于专业总人数，成绩和学习时间需在合理范围内。"
      );
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/assessment", {
        body: JSON.stringify({ admissionYear: 2027, profile: parsed.data }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as Result;
      if (!response.ok) {
        throw new Error("测评暂时未完成，请稍后重试或返回修改信息。");
      }
      setResult(payload);
      setTimeout(
        () =>
          document
            .getElementById("report")
            ?.scrollIntoView({ behavior: "smooth" }),
        0
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "测评暂时不可用，请重新尝试。"
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="min-h-dvh bg-muted/30 pb-16">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link className="font-semibold" href="/">
          AI考研保研规划师
        </Link>
        <span className="text-sm text-muted-foreground">约 3 分钟</span>
      </header>
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        {result ? (
          <Report result={result} />
        ) : (
          <form
            className="rounded-xl border bg-card p-5 shadow-sm sm:p-8"
            onSubmit={submit}
          >
            <div className="flex justify-between text-sm">
              <span className="font-medium">{steps[current]}</span>
              <span className="text-muted-foreground">
                {current + 1} / {steps.length}
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${((current + 1) / steps.length) * 100}%` }}
              />
            </div>
            <div className="mt-8">
              {current === 0 && (
                <Step title="先认识一下你">
                  <Field label="本科院校" optional>
                    <input
                      className={input}
                      name="university"
                      placeholder="例如：南京大学"
                    />
                  </Field>
                  <Field label="本科专业" optional>
                    <input
                      className={input}
                      name="major"
                      placeholder="例如：计算机科学与技术"
                    />
                  </Field>
                  <Field label="你现在处于哪个阶段？">
                    <select
                      className={input}
                      defaultValue="SOPHOMORE"
                      name="grade"
                    >
                      <option value="FRESHMAN">大一</option>
                      <option value="SOPHOMORE">大二</option>
                      <option value="JUNIOR">大三</option>
                      <option value="SENIOR">大四</option>
                      <option value="GRADUATED">已毕业</option>
                    </select>
                  </Field>
                </Step>
              )}
              {current === 1 && (
                <Step title="你的学业情况">
                  <Field label="你的专业排名大约是多少？" optional>
                    <input
                      className={input}
                      min="1"
                      name="rank"
                      placeholder="例如：8；不知道可留空"
                      type="number"
                    />
                  </Field>
                  <Field label="专业总人数" optional>
                    <input
                      className={input}
                      min="1"
                      name="cohort"
                      placeholder="例如：120；不知道可留空"
                      type="number"
                    />
                  </Field>
                  <Field label="GPA" optional>
                    <input
                      className={input}
                      max="5"
                      min="0"
                      name="gpa"
                      placeholder="如知道可填写，例如：3.7"
                      step="0.01"
                      type="number"
                    />
                  </Field>
                </Step>
              )}
              {current === 2 && (
                <Step title="英语情况">
                  <Field label="CET4 成绩" optional>
                    <input
                      className={input}
                      max="710"
                      min="0"
                      name="cet4"
                      placeholder="不知道可留空"
                      type="number"
                    />
                  </Field>
                  <Field label="CET6 成绩" optional>
                    <input
                      className={input}
                      max="710"
                      min="0"
                      name="cet6"
                      placeholder="不知道可留空"
                      type="number"
                    />
                  </Field>
                </Step>
              )}
              {current === 3 && (
                <Step title="科研与竞赛">
                  <YesNo label="是否有科研经历？" name="research" />
                  <Field label="最高竞赛级别" optional>
                    <select
                      className={input}
                      defaultValue="NONE"
                      name="competition"
                    >
                      <option value="NONE">暂无或暂时不知道</option>
                      <option value="UNIVERSITY">校级</option>
                      <option value="PROVINCIAL">省级</option>
                      <option value="NATIONAL">国家级</option>
                      <option value="INTERNATIONAL">国际级</option>
                    </select>
                  </Field>
                  <YesNo label="是否有论文或投稿经历？" name="paper" />
                  <YesNo label="是否有相关实习？" name="internship" />
                </Step>
              )}
              {current === 4 && (
                <Step title="你的升学目标">
                  <Field label="优先考虑的城市" optional>
                    <input
                      className={input}
                      defaultValue="南京"
                      name="cities"
                      placeholder="多个城市用逗号隔开"
                    />
                  </Field>
                  <Field label="心仪学校" optional>
                    <input
                      className={input}
                      name="schools"
                      placeholder="如有，多个学校用逗号隔开"
                    />
                  </Field>
                  <Field label="想读的专业方向">
                    <input
                      className={input}
                      defaultValue="计算机"
                      name="targets"
                    />
                  </Field>
                </Step>
              )}
              {current === 5 && (
                <Step title="学习投入与选择策略">
                  <Field label="每天大约可投入多长时间？" optional>
                    <input
                      className={input}
                      max="24"
                      min="0"
                      name="hours"
                      placeholder="例如：3.5 小时"
                      step="0.5"
                      type="number"
                    />
                  </Field>
                  <Field label="你选学校时更偏向哪种策略？">
                    <select
                      className={input}
                      defaultValue="BALANCED"
                      name="risk"
                    >
                      <option value="CONSERVATIVE">稳一点</option>
                      <option value="BALANCED">平衡</option>
                      <option value="AGGRESSIVE">愿意冲高</option>
                    </select>
                  </Field>
                </Step>
              )}
              {current === 6 && (
                <Step title="确认后生成你的诊断">
                  <p className="text-muted-foreground text-sm">
                    先生成系统诊断、院校匹配与行动重点；AI
                    解读暂不可用时，这些结果仍会展示。
                  </p>
                  <p className="text-muted-foreground text-xs">
                    本结果用于升学规划辅助，不代表任何院校录取承诺。招生政策可能调整，请以招生单位最新官方通知为准。
                  </p>
                </Step>
              )}
            </div>
            {error ? (
              <p
                className="mt-5 rounded-lg bg-destructive/10 p-3 text-destructive text-sm"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <div className="mt-8 flex justify-between gap-3">
              {current > 0 ? (
                <button
                  className="h-11 rounded-lg border px-5"
                  onClick={previousStep}
                  type="button"
                >
                  上一步
                </button>
              ) : (
                <span />
              )}
              {current < steps.length - 1 ? (
                <button
                  className="h-11 rounded-lg bg-primary px-5 font-medium text-primary-foreground"
                  onClick={nextStep}
                  type="button"
                >
                  继续
                </button>
              ) : (
                <button
                  className="h-11 rounded-lg bg-primary px-5 font-medium text-primary-foreground disabled:opacity-60"
                  disabled={loading}
                  type="submit"
                >
                  {loading
                    ? "正在分析你的升学路径与院校依据…"
                    : "生成我的升学诊断"}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

function Report({ result }: { result: Result }) {
  const { report, narrative } = result;
  const risks = [...report.pathDecision.riskFlags, ...report.topRisks].map(
    (risk) => risk.message
  );
  return (
    <div className="space-y-6" id="report">
      <section className="rounded-xl bg-primary p-6 text-primary-foreground">
        <p className="text-sm opacity-75">推荐路径</p>
        <h1 className="mt-1 font-semibold text-3xl">
          {path(report.pathDecision.path)}
        </h1>
        <p className="mt-3 text-sm">
          {report.pathDecision.reasons[0]?.message}
        </p>
      </section>
      <section className="grid grid-cols-2 gap-3">
        <Metric
          label="保研竞争力诊断"
          value={report.recommendationScore.total}
        />
        <Metric
          label="考研准备度诊断"
          value={report.postgraduateExamScore.total}
        />
      </section>
      <section className="grid gap-5 sm:grid-cols-2">
        <List
          empty="补充更多经历后，可获得更完整的优势判断。"
          items={narrative?.strengthAnalysis ?? []}
          title="你的优势"
        />
        <List
          empty="当前没有需要优先提示的风险。"
          items={risks}
          title="你的主要风险"
        />
      </section>
      {narrative ? (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold text-lg">AI 解读</h2>
          <p className="mt-3 text-muted-foreground text-sm">
            {narrative.executiveSummary}
          </p>
        </section>
      ) : (
        <Notice>
          AI 解读暂时不可用；系统诊断、院校匹配与行动建议仍可使用。
        </Notice>
      )}
      <Schools report={report} />
      <Roadmap actions={report.actionPriorities} narrative={narrative} />
      <Contact profile={result.profile} report={report} />
    </div>
  );
}
function Schools({ report }: { report: AssessmentReport }) {
  if (!report.schoolRecommendations.length) {
    return (
      <Notice>
        当前真实数据覆盖范围内暂未找到合适候选。可以调整目标城市/专业，或等待更多院校数据更新。
      </Notice>
    );
  }
  return (
    <section>
      <h2 className="font-semibold text-xl">院校建议</h2>
      <p className="mt-1 text-muted-foreground text-sm">
        这是相对匹配层级，不代表录取承诺。
      </p>
      <div className="mt-4 space-y-3">
        {report.schoolRecommendations.map((item) => (
          <details
            className="rounded-xl border bg-card p-4"
            key={item.programId}
          >
            <summary className="cursor-pointer list-none">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-medium">{programName(item.programId)}</p>
                  <p className="mt-1 text-muted-foreground text-sm">
                    {tier(item.tier)} · 匹配 {Math.round(item.score)} / 100 ·
                    可信度 {Math.round(item.confidence)}%
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
                  查看官方依据
                </span>
              </div>
            </summary>
            <div className="mt-4 border-t pt-4 text-sm">
              <p>{item.reasons[0]?.message}</p>
              {item.riskFlags[0] ? (
                <p className="mt-2 text-muted-foreground">
                  注意：{item.riskFlags[0].message}
                </p>
              ) : null}
              <p className="mt-3 font-medium">
                {item.riskFlags.some(
                  (risk) => risk.code === "HISTORICAL_ADMISSION_DATA_MISSING"
                )
                  ? "最新官方历史数据：2026；2027最终政策请以学校后续通知为准"
                  : "2027 当前官方信息"}
              </p>
              <div className="mt-3 space-y-2">
                {item.evidenceIds
                  .map((id) => report.evidenceIndex[id])
                  .filter(Boolean)
                  .map((evidence) => (
                    <div
                      className="rounded-lg bg-muted/50 p-3 text-xs"
                      key={evidence.id}
                    >
                      <p className="font-medium">官方依据</p>
                      <p className="mt-1 text-muted-foreground">
                        {evidence.excerpt}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
function Roadmap({
  actions,
}: {
  narrative: GeneratedReportNarrative | null;
  actions: AssessmentReport["actionPriorities"];
}) {
  const stages = [
    ["未来30天", "DAYS_0_30"],
    ["未来60天", "DAYS_31_60"],
    ["未来90天", "DAYS_61_90"],
  ] as const;
  return (
    <section>
      <h2 className="font-semibold text-xl">行动路线</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {stages.map(([title, window]) => (
          <div className="rounded-xl border bg-card p-4" key={title}>
            <h3 className="font-medium">{title}</h3>
            <ul className="mt-3 space-y-2 text-muted-foreground text-sm">
              {actions
                .filter((item) => item.timeWindow === window)
                .map((item) => (
                  <li key={item.code}>
                    <span className="font-medium text-foreground">
                      {item.action}
                    </span>
                    <span className="mt-1 block">
                      成功信号：{item.successSignal}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
function Contact({
  profile,
  report,
}: {
  profile: StudentProfile;
  report: AssessmentReport;
}) {
  const [message, setMessage] = useState<string>();
  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const response = await fetch("/api/leads", {
        body: JSON.stringify({
          contact: {
            consentToContact: data.get("consent") === "on",
            email: text(data, "email"),
            name: text(data, "name"),
            phone: text(data, "phone"),
            wechat: text(data, "wechat"),
          },
          profile,
          report,
          requestConsultation: data.get("consultation") === "on",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      setMessage(
        response.ok
          ? data.get("consultation") === "on"
            ? "你的资料已保存。规划老师收到咨询申请后可进行后续联系。"
            : "你的资料已保存。"
          : "请至少填写一种有效联系方式，并检查手机号或邮箱格式。"
      );
    },
    [profile, report]
  );
  return (
    <section className="rounded-xl bg-muted p-5">
      <h2 className="font-semibold text-xl">领取完整升学规划</h2>
      <p className="mt-2 text-muted-foreground text-sm">
        保存测评结果，并可申请规划老师复核。
      </p>
      <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={submit}>
        <input className={input} name="name" placeholder="姓名（可选）" />
        <input className={input} name="phone" placeholder="手机号" />
        <input className={input} name="wechat" placeholder="微信号" />
        <input className={input} name="email" placeholder="邮箱" />
        <label className="flex gap-2 text-sm sm:col-span-2">
          <input name="consent" required type="checkbox" />
          我同意规划老师按以上方式联系我
        </label>
        <label className="flex gap-2 text-sm sm:col-span-2">
          <input name="consultation" type="checkbox" />
          让规划老师帮我复核
        </label>
        <button
          className="h-11 rounded-lg bg-primary font-medium text-primary-foreground sm:col-span-2"
          type="submit"
        >
          提交并保存
        </button>
      </form>
      {message ? (
        <p className="mt-3 text-sm" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
function Step({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="grid gap-5">
      <h1 className="font-semibold text-2xl">{title}</h1>
      {children}
    </div>
  );
}
function Field({
  children,
  label,
  optional,
}: {
  children: ReactNode;
  label: string;
  optional?: boolean;
}) {
  return (
    <div className="grid gap-2 text-sm">
      <span className="font-medium">
        {label}{" "}
        {optional ? (
          <span className="font-normal text-muted-foreground">（选填）</span>
        ) : null}
      </span>
      {children}
    </div>
  );
}
function YesNo({ label, name: fieldName }: { label: string; name: string }) {
  return (
    <Field label={label}>
      <select className={input} defaultValue="no" name={fieldName}>
        <option value="no">暂无 / 暂时不知道</option>
        <option value="yes">有</option>
      </select>
    </Field>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-2 font-semibold text-3xl">
        {Math.round(value)}
        <span className="text-base"> / 100</span>
      </p>
    </div>
  );
}
function List({
  empty,
  items,
  title,
}: {
  empty: string;
  items: string[];
  title: string;
}) {
  return (
    <section>
      <h2 className="font-semibold text-xl">{title}</h2>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-muted-foreground text-sm">
          {items.slice(0, 5).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-muted-foreground text-sm">{empty}</p>
      )}
    </section>
  );
}
function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border bg-card p-4 text-muted-foreground text-sm">
      {children}
    </p>
  );
}
function text(data: FormData, key: string) {
  return data.get(key)?.toString().trim() || undefined;
}
function numeric(data: FormData, key: string) {
  const value = text(data, key);
  return value ? Number(value) : undefined;
}
function words(data: FormData, key: string) {
  const value = text(data, key);
  return value
    ? value
        .split(/[，,]/)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}
function path(value: string) {
  return (
    (
      {
        DUAL_TRACK: "保研 + 考研双轨",
        POSTGRAD_EXAM: "考研为主",
        RECOMMENDATION: "保研为主",
      } as Record<string, string>
    )[value] ?? "综合规划"
  );
}
function tier(value: SchoolMatchTier) {
  return (
    {
      CONSERVATIVE: "相对稳健",
      INSUFFICIENT_DATA: "信息不足",
      MATCH: "重点匹配",
      STRETCH: "冲刺",
    } as Record<SchoolMatchTier, string>
  )[value];
}
function programName(id: string) {
  const [, , school, code] = id.split(":");
  const schools: Record<string, string> = {
    hdu: "杭州电子科技大学",
    nju: "南京大学",
    njust: "南京理工大学",
    nupt: "南京邮电大学",
    seu: "东南大学",
  };
  return `${schools[school] ?? "目标院校"} · ${code ?? "相关专业"}`;
}
