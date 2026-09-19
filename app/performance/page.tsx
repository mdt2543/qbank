import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function Performance() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: rows } = await supabase
    .from("v_my_topic_performance")
    .select("*");

  const answered = rows?.reduce((n, r) => n + Number(r.answered), 0) ?? 0;
  const correct = rows?.reduce((n, r) => n + Number(r.correct), 0) ?? 0;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-gray-500 hover:underline dark:text-gray-400">
        ← All banks
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Performance</h1>

      {answered === 0 ? (
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          Answer some questions and your results by objective will appear here.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {correct} of {answered} correct overall ({Math.round((correct / answered) * 100)}%)
          </p>

          <div className="mt-8 space-y-2">
            {rows?.map((r) => {
              const pct = r.pct === null ? 0 : Number(r.pct);
              return (
                <div
                  key={r.topic ?? "none"}
                  className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium">{r.topic ?? "Uncategorized"}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {r.correct}/{r.answered} · {pct}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded bg-gray-200 dark:bg-gray-800">
                    <div
                      className={`h-1.5 rounded ${
                        pct >= 75 ? "bg-green-600" : pct >= 50 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}