import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type View = "objective" | "case" | "bank" | "progress";

const TABS: { key: View; label: string }[] = [
  { key: "objective", label: "By objective" },
  { key: "case", label: "By case" },
  { key: "bank", label: "By question bank" },
  { key: "progress", label: "Progress" },
];

type Week = { week: string; answers: number | string; new_questions: number | string };

const DAY = 24 * 60 * 60 * 1000;

// Fill in weeks with no activity so the chart has no gaps; show the latest 16.
function fillWeeks(rows: Week[]) {
  const by = new Map(rows.map((r) => [r.week, Number(r.answers)]));
  if (!rows.length) return [];
  const first = new Date(rows[0].week + "T00:00:00Z").getTime();
  const now = new Date();
  const monday =
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
    ((now.getUTCDay() + 6) % 7) * DAY;
  const out: { week: string; answers: number }[] = [];
  for (let t = first; t <= monday; t += 7 * DAY) {
    const key = new Date(t).toISOString().slice(0, 10);
    out.push({ week: key, answers: by.get(key) ?? 0 });
  }
  return out.slice(-16);
}

function WeeklyChart({ weeks }: { weeks: { week: string; answers: number }[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.answers));
  const W = 640;
  const H = 160;
  const pad = 22;
  const slot = (W - pad * 2) / weeks.length;
  const label = (iso: string) =>
    new Date(iso + "T00:00:00Z").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full" role="img" aria-label="Questions answered per week">
      {weeks.map((w, i) => {
        const h = (w.answers / max) * (H - 24);
        const x = pad + i * slot + slot * 0.15;
        return (
          <g key={w.week}>
            <rect
              x={x}
              y={H - h}
              width={slot * 0.7}
              height={h}
              rx={2}
              className="fill-indigo-500"
            />
            {w.answers > 0 && (
              <text
                x={x + slot * 0.35}
                y={H - h - 4}
                textAnchor="middle"
                className="fill-gray-500 text-[10px]"
              >
                {w.answers}
              </text>
            )}
          </g>
        );
      })}
      <line x1={pad} x2={W - pad} y1={H} y2={H} className="stroke-gray-300 dark:stroke-gray-700" />
      <text x={pad} y={H + 16} className="fill-gray-500 text-[10px]">
        {label(weeks[0].week)}
      </text>
      <text x={W - pad} y={H + 16} textAnchor="end" className="fill-gray-500 text-[10px]">
        {label(weeks[weeks.length - 1].week)}
      </text>
    </svg>
  );
}

type Row = {
  answered: number | string;
  correct: number | string;
  pct: number | string | null;
};

function toPct(r: Row) {
  return r.pct === null ? 0 : Number(r.pct);
}

// rows from the v_perf_* views carry two sets of numbers: every answer across all
// attempts, and only the latest answer to each question
type Metric = Row & {
  latest_answered: number | string;
  latest_correct: number | string;
  latest_pct: number | string | null;
};

const MIN_ANSWERS = 5;

function pick(r: Metric, latest: boolean): Row {
  return latest
    ? { answered: r.latest_answered, correct: r.latest_correct, pct: r.latest_pct }
    : { answered: r.answered, correct: r.correct, pct: r.pct };
}

// weakest first, but rows with very few answers go last so one miss isn't a "0%"
function weakestFirst<T extends Metric>(rows: T[], latest: boolean, name: (r: T) => string) {
  const key = (r: T) => {
    const m = pick(r, latest);
    return { few: Number(m.answered) < MIN_ANSWERS ? 1 : 0, pct: toPct(m) };
  };
  return [...rows].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    return x.few - y.few || x.pct - y.pct || name(a).localeCompare(name(b));
  });
}

function Bar({ pct }: { pct: number }) {
  return (
    <div className="mt-2 h-1.5 w-full rounded bg-gray-200 dark:bg-gray-800">
      <div
        className={`h-1.5 rounded ${
          pct >= 75 ? "bg-green-600" : pct >= 50 ? "bg-amber-500" : "bg-red-500"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Score({ r }: { r: Row }) {
  return (
    <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">
      {r.correct}/{r.answered} · {toPct(r)}%
      {Number(r.answered) < MIN_ANSWERS && (
        <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">few answers</span>
      )}
    </span>
  );
}

export default async function Performance({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; mode?: string }>;
}) {
  const { view: v, mode } = await searchParams;
  const view: View = v === "case" || v === "bank" || v === "progress" ? v : "objective";
  const latest = mode === "latest";
  const href = (key: View, wantLatest: boolean) => {
    const qs = new URLSearchParams();
    if (key !== "objective") qs.set("view", key);
    if (wantLatest && key !== "progress") qs.set("mode", "latest");
    const str = qs.toString();
    return str ? `/performance?${str}` : "/performance";
  };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // objective rows are always loaded: they also give the overall total
  const { data: rows } = await supabase.from("v_perf_objective").select("*");

  const answered = rows?.reduce((n, r) => n + Number(pick(r, latest).answered), 0) ?? 0;
  const correct = rows?.reduce((n, r) => n + Number(pick(r, latest).correct), 0) ?? 0;

  const { data: cases } =
    view === "case" ? await supabase.from("v_perf_case").select("*") : { data: null };
  const { data: caseObjs } =
    view === "case"
      ? await supabase.from("v_perf_case_objective").select("*")
      : { data: null };
  const { data: banks } =
    view === "bank" ? await supabase.from("v_perf_bank").select("*") : { data: null };

  const { data: totals } =
    view === "progress"
      ? await supabase.from("v_my_totals").select("*").maybeSingle()
      : { data: null };
  const { data: weekly } =
    view === "progress"
      ? await supabase.from("v_my_weekly_activity").select("*")
      : { data: null };
  const { data: progress } =
    view === "progress"
      ? await supabase.from("v_my_case_progress").select("*")
      : { data: null };
  const weeks = fillWeeks((weekly ?? []) as Week[]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-gray-500 hover:underline dark:text-gray-400">
        ← All banks
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Performance</h1>

      {answered === 0 ? (
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          Answer some questions and your results will appear here.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {correct} of {answered} correct overall ({Math.round((correct / answered) * 100)}%)
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={href(t.key, latest)}
                className={`rounded-full border px-4 py-1.5 text-sm ${
                  view === t.key
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-gray-300 dark:border-gray-700"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>

          {view !== "progress" && (
            <>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                {[
                  { wantLatest: false, label: "All attempts" },
                  { wantLatest: true, label: "Latest attempt only" },
                ].map((m) => (
                  <Link
                    key={m.label}
                    href={href(view, m.wantLatest)}
                    className={`rounded-full border px-3 py-1 ${
                      latest === m.wantLatest
                        ? "border-indigo-500 bg-indigo-50 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100"
                        : "border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-400"
                    }`}
                  >
                    {m.label}
                  </Link>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {latest
                  ? "Counts only your most recent answer to each question."
                  : "Counts every answer you've given across all attempts. Skipped questions aren't counted."}
              </p>
            </>
          )}

          <div className="mt-6 space-y-2">
            {view === "objective" &&
              weakestFirst(rows ?? [], latest, (r) => r.topic ?? "").map((r) => (
                <div
                  key={r.topic ?? "none"}
                  className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <div>
                      <span className="text-sm font-medium">{r.topic ?? "Uncategorized"}</span>
                      {r.description && (
                        <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                          {r.description}
                        </p>
                      )}
                    </div>
                    <Score r={pick(r, latest)} />
                  </div>
                  <Bar pct={toPct(pick(r, latest))} />
                </div>
              ))}

            {view === "case" &&
              (cases?.length ? (
                cases.map((c) => (
                  <details
                    key={c.case_number}
                    className="group rounded-lg border border-gray-200 dark:border-gray-800"
                  >
                    <summary className="cursor-pointer list-none p-4">
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-sm font-medium">
                          <span className="mr-2 inline-block text-gray-400 transition-transform group-open:rotate-90">
                            ▸
                          </span>
                          Case {c.case_number}
                          {c.title && (
                            <span className="font-normal text-gray-500 dark:text-gray-400">
                              {" "}
                              · {c.title}
                            </span>
                          )}
                        </span>
                        <Score r={pick(c, latest)} />
                      </div>
                      <Bar pct={toPct(pick(c, latest))} />
                    </summary>
                    <div className="space-y-3 border-t border-gray-200 px-4 py-3 dark:border-gray-800">
                      {weakestFirst(
                        (caseObjs ?? []).filter((o) => o.case_number === c.case_number),
                        latest,
                        (o) => o.topic
                      ).map((o) => (
                          <div key={o.topic}>
                            <div className="flex items-baseline justify-between gap-4">
                              <div>
                                <span className="text-sm font-medium">{o.topic}</span>
                                {o.description && (
                                  <p className="mt-0.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                                    {o.description}
                                  </p>
                                )}
                              </div>
                              <Score r={pick(o, latest)} />
                            </div>
                            <Bar pct={toPct(pick(o, latest))} />
                          </div>
                        ))}
                    </div>
                  </details>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No answered questions are linked to a case yet.
                </p>
              ))}

            {view === "progress" && (
              <div className="space-y-8">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Unique questions answered", value: totals?.questions ?? 0 },
                    { label: "Total answers", value: totals?.answers ?? 0 },
                    {
                      label: "Answered this week",
                      value: weeks.length ? weeks[weeks.length - 1].answers : 0,
                    },
                  ].map((c) => (
                    <div
                      key={c.label}
                      className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
                    >
                      <p className="text-2xl font-semibold tabular-nums">{c.value}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
                    </div>
                  ))}
                </div>

                {weeks.length > 0 && (
                  <div>
                    <h2 className="text-sm font-medium">Questions answered per week</h2>
                    <div className="mt-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                      <WeeklyChart weeks={weeks} />
                    </div>
                  </div>
                )}

                <div>
                  <h2 className="text-sm font-medium">Improvement by case</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Your first answer to each question compared with your most recent one.
                  </p>
                  <div className="mt-3 space-y-2">
                    {progress?.length ? (
                      progress.map((c) => {
                        const first = Number(c.first_pct ?? 0);
                        const latest = Number(c.latest_pct ?? 0);
                        const delta = Math.round((latest - first) * 10) / 10;
                        return (
                          <div
                            key={c.case_number}
                            className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
                          >
                            <div className="flex items-baseline justify-between gap-4">
                              <div>
                                <span className="text-sm font-medium">
                                  Case {c.case_number}
                                  {c.title && (
                                    <span className="font-normal text-gray-500 dark:text-gray-400">
                                      {" "}
                                      · {c.title}
                                    </span>
                                  )}
                                </span>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  {c.questions} questions · {c.retaken} retaken
                                </p>
                              </div>
                              <span className="shrink-0 text-sm tabular-nums">
                                {first}% → {latest}%{" "}
                                <span
                                  className={
                                    delta > 0
                                      ? "text-green-600"
                                      : delta < 0
                                      ? "text-red-500"
                                      : "text-gray-500"
                                  }
                                >
                                  ({delta > 0 ? "+" : ""}
                                  {delta})
                                </span>
                              </span>
                            </div>
                            <div className="mt-3 space-y-1.5">
                              <div className="h-1.5 w-full rounded bg-gray-200 dark:bg-gray-800">
                                <div
                                  className="h-1.5 rounded bg-gray-400"
                                  style={{ width: `${first}%` }}
                                />
                              </div>
                              <div className="h-1.5 w-full rounded bg-gray-200 dark:bg-gray-800">
                                <div
                                  className="h-1.5 rounded bg-indigo-500"
                                  style={{ width: `${latest}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No answered questions are linked to a case yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {view === "bank" &&
              banks?.map((b) => (
                <div
                  key={b.slug}
                  className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <div>
                      <Link
                        href={`/qbank/${b.slug}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {b.bank}
                      </Link>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {b.questions} of {b.total} questions attempted
                      </p>
                    </div>
                    <Score r={pick(b, latest)} />
                  </div>
                  <Bar pct={toPct(pick(b, latest))} />
                </div>
              ))}
          </div>
        </>
      )}
    </main>
  );
}
