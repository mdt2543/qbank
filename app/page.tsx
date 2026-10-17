import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronRight, Folder } from "lucide-react";
import AnnouncementBar from "@/components/announcement-bar";

type Sub = { key: string; title: string };

// Subfolders inside Case Review: Case 1 ... Case 14
const CASE_SUBFOLDERS: Sub[] = Array.from({ length: 14 }, (_, i) => ({
  key: `case-${i + 1}`,
  title: `Case ${i + 1}`,
}));

// Folder order on the page. A bank's folder is the key stored in qbanks.folder, and its
// subfolder the key stored in qbanks.subfolder.
const FOLDERS: { key: string; title: string; subfolders: Sub[] }[] = [
  { key: "case-review", title: "Case Review", subfolders: CASE_SUBFOLDERS },
  { key: "exam-prep", title: "Exam Prep", subfolders: [] },
];

type Bank = {
  slug: string;
  title: string;
  description: string | null;
  question_count: number | string;
};

function BankCard({ qb }: { qb: Bank }) {
  return (
    <Link
      href={`/qbank/${qb.slug}`}
      className="block rounded-lg border border-gray-200 p-5 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
    >
      <div className="font-medium">{qb.title}</div>
      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {qb.question_count} questions
      </div>
    </Link>
  );
}

function count(n: number) {
  return `${n} question bank${n === 1 ? "" : "s"}`;
}

function SubFolderBox({ title, banks }: { title: string; banks: Bank[] }) {
  // a subfolder with nothing in it yet is shown, but can't be opened
  if (!banks.length) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-gray-200 px-4 py-3 text-gray-400 dark:border-gray-800 dark:text-gray-600">
        <Folder size={18} className="shrink-0" />
        <span className="flex-1 text-sm">{title}</span>
        <span className="text-xs">No question banks yet</span>
      </div>
    );
  }
  return (
    <details className="group rounded-lg border border-gray-200 dark:border-gray-800">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
        <Folder size={18} className="shrink-0 text-indigo-500" />
        <div className="flex-1">
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{count(banks.length)}</div>
        </div>
        <ChevronRight
          size={16}
          className="shrink-0 text-gray-400 transition-transform group-open:rotate-90"
        />
      </summary>
      <div className="space-y-3 border-t border-gray-200 p-3 dark:border-gray-800">
        {banks.map((qb) => (
          <BankCard key={qb.slug} qb={qb} />
        ))}
      </div>
    </details>
  );
}

function FolderBox({
  title,
  banks,
  subs = [],
}: {
  title: string;
  banks: Bank[];
  subs?: { key: string; title: string; banks: Bank[] }[];
}) {
  const total = banks.length + subs.reduce((n, s) => n + s.banks.length, 0);
  return (
    <details className="group rounded-lg border border-gray-200 dark:border-gray-800">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-5">
        <Folder size={22} className="shrink-0 text-indigo-500" />
        <div className="flex-1">
          <div className="font-medium">{title}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{count(total)}</div>
        </div>
        <ChevronRight
          size={18}
          className="shrink-0 text-gray-400 transition-transform group-open:rotate-90"
        />
      </summary>
      <div className="space-y-3 border-t border-gray-200 p-4 dark:border-gray-800">
        {banks.map((qb) => (
          <BankCard key={qb.slug} qb={qb} />
        ))}
        {subs.map((s) => (
          <SubFolderBox key={s.key} title={s.title} banks={s.banks} />
        ))}
      </div>
    </details>
  );
}

export default async function Home() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: summaries } = await supabase
    .from("v_qbank_summary")
    .select("slug, title, description, question_count");
  const { data: dates } = await supabase.from("qbanks").select("slug, created_at");
  // live announcements this student has not dismissed (an error, e.g. SQL not run yet, means none)
  const { data: announcements } = await supabase.rpc("current_announcements");
  // separate queries so the page still works before these columns exist
  const { data: folderRows } = await supabase.from("qbanks").select("slug, folder");
  const { data: subRows } = await supabase.from("qbanks").select("slug, subfolder");

  // oldest upload first, newest at the bottom
  const uploaded = new Map((dates ?? []).map((d) => [d.slug, d.created_at as string]));
  const qbanks = ([...(summaries ?? [])] as Bank[]).sort((a, b) =>
    (uploaded.get(a.slug) ?? "").localeCompare(uploaded.get(b.slug) ?? "")
  );

  const folderOf = new Map(
    (folderRows ?? []).map((r) => [r.slug as string, (r.folder as string | null) ?? null])
  );
  const subOf = new Map(
    (subRows ?? []).map((r) => [r.slug as string, (r.subfolder as string | null) ?? null])
  );
  const known = new Set(FOLDERS.map((f) => f.key));
  const unfiled = qbanks.filter((b) => !known.has(folderOf.get(b.slug) ?? ""));
  const anyFiled = unfiled.length < qbanks.length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <AnnouncementBar items={(announcements ?? []) as { id: string; message: string; level: string }[]} />
      <h1 className="text-2xl font-semibold">Question banks</h1>

      <div className="mt-8 space-y-3">
        {!qbanks.length ? (
          <p className="text-sm text-gray-500">No published question banks found.</p>
        ) : !anyFiled ? (
          // no folders assigned yet: show the plain list as before
          qbanks.map((qb) => <BankCard key={qb.slug} qb={qb} />)
        ) : (
          <>
            {FOLDERS.map((f) => {
              const inFolder = qbanks.filter((b) => folderOf.get(b.slug) === f.key);
              const validSubs = new Set(f.subfolders.map((s) => s.key));
              // banks without a (valid) subfolder sit directly in the folder
              const loose = inFolder.filter((b) => !validSubs.has(subOf.get(b.slug) ?? ""));
              const subs = f.subfolders.map((s) => ({
                ...s,
                banks: inFolder.filter((b) => subOf.get(b.slug) === s.key),
              }));
              // a folder with subfolders is always shown; one without is shown once it has banks
              if (!inFolder.length && !f.subfolders.length) return null;
              return <FolderBox key={f.key} title={f.title} banks={loose} subs={subs} />;
            })}
            {unfiled.length > 0 && <FolderBox title="Other" banks={unfiled} />}
          </>
        )}
      </div>
    </main>
  );
}
