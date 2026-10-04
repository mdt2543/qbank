import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Activity = {
  user_id: string;
  email: string;
  display_name: string | null;
  bank: string;
  bank_slug: string;
  questions_answered: number | string;
  sessions: number | string;
  submitted: number | string;
  pct_correct: number | string | null;
  last_active: string | null;
};

type BankRow = {
  bank: string;
  bank_slug: string;
  students: number | string;
  sessions: number | string;
  unique_answers: number | string;
  question_count: number | string;
  last_active: string | null;
};

const SORTS = [
  { key: "last", label: "Last active" },
  { key: "answered", label: "Most answered" },
  { key: "student", label: "Student" },
];

function ago(iso: string | null) {
  if (!iso) return "never";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return days < 60 ? `${days} day${days === 1 ? "" : "s"} ago` : iso.slice(0, 10);
}

export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; bank?: string; sort?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Everyone who is not an admin gets an ordinary "not found" page.
  if (!user) notFound();
  const { data: isAdmin } = await supabase.rpc("is_site_admin");
  if (!isAdmin) notFound();

  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const bankFilter = sp.bank ?? "";
  const sort = SORTS.some((s) => s.key === sp.sort) ? sp.sort! : "last";

  const { data: overview } = await supabase.rpc("admin_overview");
  const { data: banksData } = await supabase.rpc("admin_bank_summary");
  const { data: actData } = await supabase.rpc("admin_student_activity");

  const ov = (overview as { accounts: number; active_7d: number; answers: number }[] | null)?.[0];
  const banks = (banksData ?? []) as BankRow[];
  let rows = (actData ?? []) as Activity[];

  if (bankFilter) rows = rows.filter((r) => r.bank_slug === bankFilter);
  if (q) {
    rows = rows.filter((r) =>
      `${r.email} ${r.display_name ?? ""} ${r.bank}`.toLowerCase().includes(q)
    );
  }
  const num = (v: number | string | null) => Number(v ?? 0);
  if (sort === "answered") rows = [...rows].sort((a, b) => num(b.questions_answered) - num(a.questions_answered));
  if (sort === "student") rows = [...rows].sort((a, b) => a.email.localeCompare(b.email) || a.bank.localeCompare(b.bank));

  const shown = rows.slice(0, 500);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/" className="text-sm text-gray-500 hover:underline dark:text-gray-400">
        ← All banks
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Admin</h1>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          { label: "Accounts", value: ov?.accounts ?? 0 },
          { label: "Active in the last 7 days", value: ov?.active_7d ?? 0 },
          { label: "Total answers", value: ov?.answers ?? 0 },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
            <p className="text-2xl font-semibold tabular-nums">{c.value}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-sm font-medium">By question bank</h2>
      <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">
            <tr>
              <th className="px-4 py-2 font-medium">Bank</th>
              <th className="px-4 py-2 font-medium">Students</th>
              <th className="px-4 py-2 font-medium">Sessions</th>
              <th className="px-4 py-2 font-medium">Questions answered</th>
              <th className="px-4 py-2 font-medium">Last active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {banks.map((b) => (
              <tr key={b.bank_slug}>
                <td className="px-4 py-2">
                  <Link href={`/admin?bank=${b.bank_slug}`} className="hover:underline">
                    {b.bank}
                  </Link>
                </td>
                <td className="px-4 py-2 tabular-nums">{b.students}</td>
                <td className="px-4 py-2 tabular-nums">{b.sessions}</td>
                <td className="px-4 py-2 tabular-nums">
                  {b.unique_answers}
                  <span className="text-gray-400"> (of {b.question_count} per student)</span>
                </td>
                <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{ago(b.last_active)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-sm font-medium">Students and banks</h2>
      <form method="get" className="mt-3 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search name, email or bank"
          className="min-w-56 flex-1 rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
        />
        <select
          name="bank"
          defaultValue={bankFilter}
          className="rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
        >
          <option value="">All banks</option>
          {banks.map((b) => (
            <option key={b.bank_slug} value={b.bank_slug}>
              {b.bank}
            </option>
          ))}
        </select>
        <select
          name="sort"
          defaultValue={sort}
          className="rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <button className="rounded-lg bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
          Apply
        </button>
      </form>

      <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">
            <tr>
              <th className="px-4 py-2 font-medium">Student</th>
              <th className="px-4 py-2 font-medium">Bank</th>
              <th className="px-4 py-2 font-medium">Answered</th>
              <th className="px-4 py-2 font-medium">Sessions</th>
              <th className="px-4 py-2 font-medium">Correct</th>
              <th className="px-4 py-2 font-medium">Last active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {shown.map((r) => (
              <tr key={`${r.user_id}-${r.bank_slug}`}>
                <td className="px-4 py-2">
                  <div className="font-medium">{r.display_name ?? r.email.split("@")[0]}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{r.email}</div>
                </td>
                <td className="px-4 py-2">{r.bank}</td>
                <td className="px-4 py-2 tabular-nums">{r.questions_answered}</td>
                <td className="px-4 py-2 tabular-nums">
                  {r.sessions}
                  <span className="text-gray-400"> ({r.submitted} submitted)</span>
                </td>
                <td className="px-4 py-2 tabular-nums">
                  {r.pct_correct === null ? "–" : `${r.pct_correct}%`}
                </td>
                <td
                  className="px-4 py-2 text-gray-500 dark:text-gray-400"
                  title={r.last_active ?? undefined}
                >
                  {ago(r.last_active)}
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  Nothing matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > shown.length && (
        <p className="mt-2 text-xs text-gray-500">Showing the first {shown.length} of {rows.length}.</p>
      )}
    </main>
  );
}
