import { notFound } from "next/navigation";
import Link from "next/link";
import Announcements, { type AdminAnnouncement } from "./announcements";
import { createClient } from "@/lib/supabase/server";

type Overview = {
  students: number | string;
  active_7d: number | string;
  sessions_submitted: number | string;
  questions_answered: number | string;
};

type BankRow = {
  bank: string;
  bank_slug: string;
  is_published: boolean;
  started: number | string;
  completed: number | string;
  class_avg: number | string | null;
  avg_seen: number | string | null;
  question_count: number | string;
  sessions_submitted: number | string;
  last_active: string | null;
};

type Activity = {
  user_id: string;
  email: string;
  display_name: string | null;
  is_admin: boolean;
  bank: string;
  bank_slug: string;
  questions_seen: number | string;
  pct_latest: number | string | null;
  sessions: number | string;
  submitted: number | string;
  last_active: string | null;
};

type FeedbackRow = {
  id: string;
  created_at: string;
  email: string;
  display_name: string | null;
  bank: string;
  bank_slug: string | null;
  rating: number | null;
  message: string;
  session_mode: string | null;
  session_correct: number | null;
  session_total: number | null;
};

type Student = {
  user_id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  banks: Activity[];
  seen: number;
  sessions: number;
  submitted: number;
  last: string | null;
};

type Tab = "overview" | "banks" | "students" | "feedback" | "announcements";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "banks", label: "Banks" },
  { key: "students", label: "Students" },
  { key: "feedback", label: "Feedback" },
  { key: "announcements", label: "Announcements" },
];

const MODE_LABEL: Record<string, string> = {
  tutor: "Tutor",
  timed: "Exam",
  timed_exam: "Timed exam",
};

const SORTS = [
  { key: "last", label: "Last active" },
  { key: "answered", label: "Most questions" },
  { key: "student", label: "Student" },
];

const num = (v: number | string | null | undefined) => Number(v ?? 0);

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

function latestOf(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; admins?: string; q?: string; bank?: string; sort?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Everyone who is not an admin gets an ordinary "not found" page.
  if (!user) notFound();
  const { data: isAdmin } = await supabase.rpc("is_site_admin");
  if (!isAdmin) notFound();

  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "overview";
  const withAdmins = sp.admins === "1";
  const q = (sp.q ?? "").trim().toLowerCase();
  const bankFilter = sp.bank ?? "";
  const sort = SORTS.some((s) => s.key === sp.sort) ? sp.sort! : "last";

  const href = (t: Tab, extra: Record<string, string> = {}) => {
    const qs = new URLSearchParams();
    if (t !== "overview") qs.set("tab", t);
    if (withAdmins) qs.set("admins", "1");
    for (const [k, v] of Object.entries(extra)) if (v) qs.set(k, v);
    const s = qs.toString();
    return s ? `/admin?${s}` : "/admin";
  };

  const args = { p_include_admins: withAdmins };
  const needBanks = tab === "banks" || tab === "students" || tab === "feedback";
  const [{ data: ovData }, { data: banksData }, { data: actData }, { data: fbData }, { data: annData }] =
    await Promise.all([
      supabase.rpc("admin_overview_v2", args),
      needBanks ? supabase.rpc("admin_bank_summary_v2", args) : Promise.resolve({ data: null }),
      tab === "students" ? supabase.rpc("admin_student_activity_v2", args) : Promise.resolve({ data: null }),
      supabase.rpc("admin_feedback"),
      tab === "announcements" ? supabase.rpc("admin_announcements") : Promise.resolve({ data: null }),
    ]);

  const ov = (ovData as Overview[] | null)?.[0];
  const banks = (banksData ?? []) as BankRow[];
  const feedbackAll = (fbData ?? []) as FeedbackRow[];

  // --- students: one row per student, their banks inside ---
  let students: Student[] = [];
  if (tab === "students") {
    const by = new Map<string, Student>();
    for (const r of (actData ?? []) as Activity[]) {
      const s = by.get(r.user_id) ?? {
        user_id: r.user_id,
        email: r.email,
        name: r.display_name ?? r.email.split("@")[0],
        isAdmin: r.is_admin,
        banks: [],
        seen: 0,
        sessions: 0,
        submitted: 0,
        last: null,
      };
      s.banks.push(r);
      s.seen += num(r.questions_seen);
      s.sessions += num(r.sessions);
      s.submitted += num(r.submitted);
      s.last = latestOf(s.last, r.last_active);
      by.set(r.user_id, s);
    }
    students = [...by.values()];
    if (bankFilter) students = students.filter((s) => s.banks.some((b) => b.bank_slug === bankFilter));
    if (q) {
      students = students.filter((s) =>
        `${s.email} ${s.name} ${s.banks.map((b) => b.bank).join(" ")}`.toLowerCase().includes(q)
      );
    }
    if (sort === "answered") students.sort((a, b) => b.seen - a.seen);
    else if (sort === "student") students.sort((a, b) => a.email.localeCompare(b.email));
    else students.sort((a, b) => (b.last ?? "").localeCompare(a.last ?? ""));
  }
  const shownStudents = students.slice(0, 300);

  let feedback = feedbackAll;
  if (tab === "feedback") {
    if (bankFilter) feedback = feedback.filter((f) => f.bank_slug === bankFilter);
    if (q) {
      feedback = feedback.filter((f) =>
        `${f.email} ${f.display_name ?? ""} ${f.bank} ${f.message}`.toLowerCase().includes(q)
      );
    }
  }

  const filterForm = (
    <form method="get" className="mt-4 flex flex-wrap gap-2">
      <input type="hidden" name="tab" value={tab} />
      {withAdmins && <input type="hidden" name="admins" value="1" />}
      <input
        name="q"
        defaultValue={sp.q ?? ""}
        placeholder={tab === "feedback" ? "Search name, email, bank or message" : "Search name, email or bank"}
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
      {tab === "students" && (
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
      )}
      <button className="rounded-lg bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
        Apply
      </button>
    </form>
  );

  const th = "px-4 py-2 font-medium";
  const thead = "bg-gray-50 text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400";
  const box = "overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800";
  const muted = "text-gray-500 dark:text-gray-400";

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/" className={`text-sm hover:underline ${muted}`}>
        ← All banks
      </Link>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <Link
          href={(() => {
            const qs = new URLSearchParams();
            if (tab !== "overview") qs.set("tab", tab);
            if (!withAdmins) qs.set("admins", "1");
            const s = qs.toString();
            return s ? `/admin?${s}` : "/admin";
          })()}
          className={`rounded-full border px-3 py-1 text-xs ${
            withAdmins
              ? "border-brand-500 bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100"
              : "border-gray-300 dark:border-gray-700"
          }`}
        >
          {withAdmins ? "Admin accounts included" : "Admin accounts left out"}
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={href(t.key)}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              tab === t.key
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-gray-300 dark:border-gray-700"
            }`}
          >
            {t.label}
            {t.key === "feedback" && <span className="ml-1.5 opacity-70">{feedbackAll.length}</span>}
          </Link>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Students", value: ov?.students ?? 0, note: "accounts" },
              { label: "Active in the last 7 days", value: ov?.active_7d ?? 0, note: "answered a question" },
              { label: "Sessions submitted", value: ov?.sessions_submitted ?? 0, note: "finished sessions" },
              { label: "Questions answered", value: ov?.questions_answered ?? 0, note: "distinct, per student" },
            ].map((c) => (
              <div key={c.label} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                <p className="text-2xl font-semibold tabular-nums">{c.value}</p>
                <p className="mt-1 text-xs font-medium">{c.label}</p>
                <p className={`text-xs ${muted}`}>{c.note}</p>
              </div>
            ))}
          </div>
          <p className={`mt-4 text-xs leading-relaxed ${muted}`}>
            {withAdmins ? "Admin accounts are included in these numbers." : "Admin accounts are left out of these numbers."}{" "}
            &ldquo;Questions answered&rdquo; counts each question once per student, so retaking a bank does
            not add to it. Scores on the Students tab use each student&apos;s newest answer to each question,
            the same as the Performance page.
          </p>
        </>
      )}

      {tab === "banks" && (
        <div className={`mt-6 ${box}`}>
          <table className="w-full text-left text-sm">
            <thead className={thead}>
              <tr>
                <th className={th}>Bank</th>
                <th className={th}>Started</th>
                <th className={th}>Completed</th>
                <th className={th}>Class average</th>
                <th className={th}>Questions seen</th>
                <th className={th}>Sessions</th>
                <th className={th}>Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {banks.map((b) => (
                <tr key={b.bank_slug}>
                  <td className="px-4 py-2">
                    <Link href={href("students", { bank: b.bank_slug })} className="hover:underline">
                      {b.bank}
                    </Link>
                    {!b.is_published && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                        Hidden
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 tabular-nums">{b.started}</td>
                  <td className="px-4 py-2 tabular-nums">{b.completed}</td>
                  <td className="px-4 py-2 tabular-nums">{b.class_avg === null ? "–" : `${b.class_avg}%`}</td>
                  <td className="px-4 py-2 tabular-nums">
                    {b.avg_seen === null ? "–" : b.avg_seen}
                    <span className="text-gray-400"> of {b.question_count}</span>
                  </td>
                  <td className="px-4 py-2 tabular-nums">{b.sessions_submitted}</td>
                  <td className={`px-4 py-2 ${muted}`}>{ago(b.last_active)}</td>
                </tr>
              ))}
              {banks.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    No banks yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className={`border-t border-gray-200 px-4 py-2 text-xs dark:border-gray-800 ${muted}`}>
            Started = students with at least one session. Completed = students with a submitted session
            that has every question answered. Class average = the average of each student&apos;s most recent
            completed session. Questions seen = the average number of distinct questions each starting
            student has answered. Sessions = submitted sessions.
          </p>
        </div>
      )}

      {tab === "students" && (
        <>
          {filterForm}
          <div className={`mt-3 divide-y divide-gray-200 dark:divide-gray-800 ${box}`}>
            {shownStudents.map((s) => (
              <details key={s.user_id} className="group">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <span className="mr-2 inline-block text-gray-400 transition-transform group-open:rotate-90">▸</span>
                    <span className="text-sm font-medium">{s.name}</span>
                    {s.isAdmin && (
                      <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-800">Admin</span>
                    )}
                    <span className={`ml-2 text-xs ${muted}`}>{s.email}</span>
                  </div>
                  <div className={`text-xs tabular-nums ${muted}`}>
                    {s.banks.length} bank{s.banks.length === 1 ? "" : "s"} · {s.seen} questions · {s.submitted} of{" "}
                    {s.sessions} sessions submitted · {ago(s.last)}
                  </div>
                </summary>
                <div className="border-t border-gray-200 bg-gray-50/50 px-4 py-2 dark:border-gray-800 dark:bg-gray-900/40">
                  <table className="w-full text-left text-sm">
                    <thead className={`text-xs ${muted}`}>
                      <tr>
                        <th className="py-1 pr-3 font-medium">Bank</th>
                        <th className="py-1 pr-3 font-medium">Questions</th>
                        <th className="py-1 pr-3 font-medium">Score</th>
                        <th className="py-1 pr-3 font-medium">Sessions</th>
                        <th className="py-1 font-medium">Last active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.banks.map((b) => (
                        <tr key={b.bank_slug}>
                          <td className="py-1 pr-3">{b.bank}</td>
                          <td className="py-1 pr-3 tabular-nums">{b.questions_seen}</td>
                          <td className="py-1 pr-3 tabular-nums">{b.pct_latest === null ? "–" : `${b.pct_latest}%`}</td>
                          <td className="py-1 pr-3 tabular-nums">
                            {b.submitted} of {b.sessions}
                          </td>
                          <td className={`py-1 ${muted}`} title={b.last_active ?? undefined}>
                            {ago(b.last_active)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
            {shownStudents.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-gray-500">Nothing matches.</p>
            )}
          </div>
          {students.length > shownStudents.length && (
            <p className="mt-2 text-xs text-gray-500">
              Showing the first {shownStudents.length} of {students.length}.
            </p>
          )}
        </>
      )}

      {tab === "feedback" && (
        <>
          {filterForm}
          <h2 className="mt-6 text-sm font-medium">
            Feedback <span className="font-normal text-gray-500">({feedback.length})</span>
          </h2>
          <div className="mt-3 space-y-2">
            {feedback.slice(0, 200).map((f) => (
              <div key={f.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-medium">{f.display_name ?? f.email.split("@")[0]}</span>
                    <span className={muted}> · {f.email}</span>
                  </div>
                  <span className={`text-xs ${muted}`} title={f.created_at}>
                    {ago(f.created_at)}
                  </span>
                </div>
                <p className={`mt-1 text-xs ${muted}`}>
                  {f.bank}
                  {f.session_mode && (
                    <>
                      {" "}
                      · after a {MODE_LABEL[f.session_mode] ?? f.session_mode} session (
                      {f.session_correct ?? 0}/{f.session_total ?? 0})
                    </>
                  )}
                  {f.rating !== null && (
                    <span className="ml-2 text-amber-500">
                      {"★".repeat(f.rating)}
                      <span className="text-gray-300 dark:text-gray-700">{"★".repeat(5 - f.rating)}</span>
                    </span>
                  )}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{f.message}</p>
              </div>
            ))}
            {feedback.length === 0 && <p className={`text-sm ${muted}`}>No feedback yet.</p>}
          </div>
        </>
      )}

      {tab === "announcements" && (
        <div className="mt-6">
          <Announcements items={(annData ?? []) as AdminAnnouncement[]} />
        </div>
      )}
    </main>
  );
}
