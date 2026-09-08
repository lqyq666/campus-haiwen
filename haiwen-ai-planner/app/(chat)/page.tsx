import Link from "next/link";

const outcomes = [
  "升学路径判断",
  "竞争力诊断",
  "院校建议",
  "主要风险与90天行动",
];

export default function Page() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <p className="font-semibold text-base">
          海文升学规划{" "}
          <span className="font-normal text-muted-foreground">Demo</span>
        </p>
        <Link
          className="text-sm underline-offset-4 hover:underline"
          href="/assessment"
        >
          开始测评
        </Link>
      </header>
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8 sm:pt-24">
        <div className="max-w-3xl">
          <p className="mb-5 font-medium text-primary text-sm">
            Powered by AI · 升学规划辅助
          </p>
          <h1 className="text-balance font-semibold text-4xl tracking-[-0.035em] sm:text-6xl">
            AI考研保研规划师
          </h1>
          <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
            3分钟判断：你更适合考研、保研，还是双轨准备。
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-6 font-medium text-primary-foreground transition-opacity hover:opacity-90"
              href="/assessment"
            >
              开始免费测评
            </Link>
            <a
              className="inline-flex h-12 items-center justify-center rounded-lg border px-6 font-medium transition-colors hover:bg-muted"
              href="#what-you-get"
            >
              测完能得到什么
            </a>
          </div>
        </div>
      </section>
      <section className="border-y bg-muted/35" id="what-you-get">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-[0.8fr_1.2fr] sm:px-8">
          <div>
            <h2 className="font-semibold text-2xl">先看清方向，再开始准备</h2>
            <p className="mt-3 text-muted-foreground">
              用你的真实学习情况和目标，整理下一步最值得投入的事情。
            </p>
          </div>
          <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {outcomes.map((item) => (
              <li className="flex items-center gap-3 font-medium" key={item}>
                <span className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground text-xs">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <p className="max-w-3xl text-sm text-muted-foreground">
          院校建议基于公开官方招生与推免资料。政策可能变化，最终以学校最新官方通知为准。
        </p>
      </section>
    </main>
  );
}
