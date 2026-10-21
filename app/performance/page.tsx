import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type View = "case" | "bank" | "progress";

const TABS: { key: View; label: string }[] = [
  { key: "case", label: "By case" },
  { key: "bank", label: "By question bank" },
  { key: "progress", label: "Progress" },
];


type AttemptRow = {
  id: string;
  submitted_at: string;
  score_correct: number | null;
  score_total: number | null;
  qbanks: { slug: string; title: string };
};

// banks with at least two submitted attempts, each attempt oldest first
function groupAttempts(rows: AttemptRow[]) {
  const by = new Map<
    string,
    {
      slug: string;
      title: string;
      attempts: { id: string; submitted_at: string; correct: number; total: number; pct: number }[];
    }
  >();
  for (const r of rows) {
    const total = r.score_total ?? 0;
    if (!total) continue;
    const correct = r.score_correct ?? 0;
    const b = by.get(r.qbanks.slug) ?? { slug: r.qbanks.slug, title: r.qbanks.title, attempts: [] };
    b.attempts.push({
      id: r.id,
      submitted_at: r.submitted_at,
      correct,
      total,
      pct: Math.round((1000 * correct) / total) / 10,
    });
    by.set(r.qbanks.slug, b);
  }
  return [...by.values()]
    .filter((b) => b.attempts.length >= 2)
    .sort((a, b) =>
      b.attempts[b.attempts.length - 1].submitted_at.localeCompare(a.attempts[a.attempts.length - 1].submitted_at)
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

function sumMetrics(rows: Metric[]): Metric {
  const n = (f: (r: Metric) => number | string) => rows.reduce((s, r) => s + Number(f(r)), 0);
  const answered = n((r) => r.answered);
  const correct = n((r) => r.correct);
  const latestAnswered = n((r) => r.latest_answered);
  const latestCorrect = n((r) => r.latest_correct);
  const p = (c: number, a: number) => (a ? Math.round((1000 * c) / a) / 10 : null);
  return {
    answered,
    correct,
    pct: p(correct, answered),
    latest_answered: latestAnswered,
    latest_correct: latestCorrect,
    latest_pct: p(latestCorrect, latestAnswered),
  };
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
  const { view: v } = await searchParams;
  const view: View = v === "bank" || v === "progress" ? v : "case";
  const latest = true; // performance always shows mastery: the newest answer to each question
  const href = (key: View) => (key === "case" ? "/performance" : `/performance?view=${key}`);

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
  // sessions inside each case; if this view isn't installed yet, the plain list is shown
  const { data: caseSessionObjs } =
    view === "case"
      ? await supabase.from("v_perf_case_session_objective").select("*")
      : { data: null };
  const { data: banks } =
    view === "bank" ? await supabase.from("v_perf_bank").select("*") : { data: null };

  // submitted attempts per bank, for the Progress tab (deleted attempts no longer exist)
  const { data: attemptRows } =
    view === "progress"
      ? await supabase
          .from("attempts")
          .select("id, submitted_at, score_correct, score_total, qbanks!inner(slug, title)")
          .not("submitted_at", "is", null)
          .order("submitted_at", { ascending: true })
      : { data: null };
  const progressBanks = groupAttempts((attemptRows ?? []) as unknown as AttemptRow[]);

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
                href={href(t.key)}
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

          <p className={`mt-4 text-xs text-gray-500 dark:text-gray-400 ${view === "progress" ? "hidden" : ""}`}>
            Scores reflect your most recent answer to each question, so they show your current mastery.
            Skipped questions are not counted.
          </p>

          <div className="mt-6 space-y-2">
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
                      {caseSessionObjs ? (
                        (() => {
                          type CaseSessionObj = Metric & {
                            case_number: number;
                            session: string;
                            topic: string;
                            description: string | null;
                          };
                          const mine = (caseSessionObjs as CaseSessionObj[]).filter((o) => o.case_number === c.case_number);
                          const sections = new Map<string, CaseSessionObj[]>();
                          for (const o of mine) {
                            const list = sections.get(o.session) ?? [];
                            list.push(o);
                            sections.set(o.session, list);
                          }
                          return [...sections.entries()]
                            .sort(
                              (a, b) =>
                                Number(a[0] === "Other objectives") - Number(b[0] === "Other objectives") ||
                                a[0].localeCompare(b[0])
                            )
                            .map(([session, objs]) => {
                              const total = sumMetrics(objs);
                              return (
                                <details
                                  key={session}
                                  className="group/sec rounded-lg border border-gray-200 dark:border-gray-800"
                                >
                                  <summary className="cursor-pointer list-none p-3">
                                    <div className="flex items-baseline justify-between gap-4">
                                      <span className="text-sm font-medium">
                                        <span className="mr-2 inline-block text-gray-400 transition-transform group-open/sec:rotate-90">
                                          ▸
                                        </span>
                                        {session}
                                      </span>
                                      <Score r={pick(total, latest)} />
                                    </div>
                                    <Bar pct={toPct(pick(total, latest))} />
                                  </summary>
                                  <div className="space-y-3 border-t border-gray-200 px-3 py-3 dark:border-gray-800">
                                    {weakestFirst(objs, latest, (o) => o.topic).map((o) => (
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
                              );
                            });
                        })()
                      ) : (
                        weakestFirst(
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
                        ))
                      )}
                    </div>
                  </details>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No answered questions are linked to a case yet.
                </p>
              ))}

            {view === "progress" &&
              (progressBanks.length ? (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Each question bank you have completed more than once, attempt by attempt.
                    Deleted attempts are not counted.
                  </p>
                  {progressBanks.map((b) => {
                    const first = b.attempts[0].pct;
                    const last = b.attempts[b.attempts.length - 1].pct;
                    const delta = Math.round((last - first) * 10) / 10;
                    return (
                      <div
                        key={b.slug}
                        className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
                      >
                        <div className="flex items-baseline justify-between gap-4">
                          <Link href={`/qbank/${b.slug}`} className="text-sm font-medium hover:underline">
                            {b.title}
                          </Link>
                          <span className="shrink-0 text-sm tabular-nums">
                            {first}% → {last}%{" "}
                            <span
                              className={
                                delta > 0 ? "text-green-600" : delta < 0 ? "text-red-500" : "text-gray-500"
                              }
                            >
                              ({delta > 0 ? "+" : ""}
                              {delta})
                            </span>
                          </span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {b.attempts.map((a, i) => (
                            <div key={a.id}>
                              <div className="flex items-baseline justify-between gap-4 text-xs text-gray-500 dark:text-gray-400">
                                <span>
                                  Attempt {i + 1} ·{" "}
                                  {new Date(a.submitted_at).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </span>
                                <span className="tabular-nums">
                                  {a.correct}/{a.total} · {a.pct}%
                                </span>
                              </div>
                              <Bar pct={a.pct} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Progress data will appear here for question banks that have been attempted and
                  submitted at least twice. Deleted attempts are not counted toward progress.
                </p>
              ))}

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
