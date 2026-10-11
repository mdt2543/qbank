import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronRight, Folder } from "lucide-react";

// Folder order on the page. A bank's folder is the key stored in qbanks.folder.
const FOLDERS = [
  { key: "case-review", title: "Case Review" },
  { key: "exam-prep", title: "Exam Prep" },
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

function FolderBox({ title, banks }: { title: string; banks: Bank[] }) {
  return (
    <details className="group rounded-lg border border-gray-200 dark:border-gray-800">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-5">
        <Folder size={22} className="shrink-0 text-indigo-500" />
        <div className="flex-1">
          <div className="font-medium">{title}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {banks.length} question bank{banks.length === 1 ? "" : "s"}
          </div>
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
  // separate query so the page still works before the folder column exists
  const { data: folderRows } = await supabase.from("qbanks").select("slug, folder");

  // oldest upload first, newest at the bottom
  const uploaded = new Map((dates ?? []).map((d) => [d.slug, d.created_at as string]));
  const qbanks = ([...(summaries ?? [])] as Bank[]).sort((a, b) =>
    (uploaded.get(a.slug) ?? "").localeCompare(uploaded.get(b.slug) ?? "")
  );

  const folderOf = new Map(
    (folderRows ?? []).map((r) => [r.slug as string, (r.folder as string | null) ?? null])
  );
  const known = new Set(FOLDERS.map((f) => f.key));
  const inFolder = (key: string) => qbanks.filter((b) => folderOf.get(b.slug) === key);
  const unfiled = qbanks.filter((b) => !known.has(folderOf.get(b.slug) ?? ""));
  const anyFiled = unfiled.length < qbanks.length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
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
              const banks = inFolder(f.key);
              return banks.length ? <FolderBox key={f.key} title={f.title} banks={banks} /> : null;
            })}
            {unfiled.length > 0 && <FolderBox title="Other" banks={unfiled} />}
          </>
        )}
      </div>
    </main>
  );
}
