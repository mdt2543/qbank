import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type View = "objective" | "case" | "bank";

const TABS: { key: View; label: string }[] = [
  { key: "objective", label: "By objective" },
  { key: "case", label: "By case" },
  { key: "bank", label: "By question bank" },
];

type Row = {
  answered: number | string;
  correct: number | string;
  pct: number | string | null;
};

function toPct(r: Row) {
  return r.pct === null ? 0 : Number(r.pct);
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
    </span>
  );
}

export default async function Performance({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: v } = await searchParams;
  const view: View = v === "case" || v === "bank" ? v : "objective";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // objective rows are always loaded: they also give the overall total
  const { data: rows } = await supabase.from("v_my_topic_performance").select("*");

  const answered = rows?.reduce((n, r) => n + Number(r.answered), 0) ?? 0;
  const correct = rows?.reduce((n, r) => n + Number(r.correct), 0) ?? 0;

  const { data: cases } =
    view === "case" ? await supabase.from("v_my_case_performance").select("*") : { data: null };
  const { data: caseObjs } =
    view === "case"
      ? await supabase.from("v_my_case_objective_performance").select("*")
      : { data: null };
  const { data: banks } =
    view === "bank" ? await supabase.from("v_my_bank_performance").select("*") : { data: null };

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
                href={t.key === "objective" ? "/performance" : `/performance?view=${t.key}`}
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

          <div className="mt-6 space-y-2">
            {view === "objective" &&
              rows?.map((r) => (
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
                    <Score r={r} />
                  </div>
                  <Bar pct={toPct(r)} />
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
                        <Score r={c} />
                      </div>
                      <Bar pct={toPct(c)} />
                    </summary>
                    <div className="space-y-3 border-t border-gray-200 px-4 py-3 dark:border-gray-800">
                      {caseObjs
                        ?.filter((o) => o.case_number === c.case_number)
                        .map((o) => (
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
                              <Score r={o} />
                            </div>
                            <Bar pct={toPct(o)} />
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
                        {b.answered} of {b.total} questions attempted
                      </p>
                    </div>
                    <Score r={b} />
                  </div>
                  <Bar pct={toPct(b)} />
                </div>
              ))}
          </div>
        </>
      )}
    </main>
  );
}
