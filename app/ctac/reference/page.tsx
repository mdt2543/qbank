import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { REFERENCE_NOTES, type NoteTexts } from "@/lib/ctac-reference";
import ReferenceEditor from "./reference-editor";

export const metadata: Metadata = { title: "CTAC reference note · teterqbank" };

// Admin only, like /ctac.
export default async function CtacReferencePage({ searchParams }: { searchParams: Promise<{ note?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: isAdmin } = await supabase.rpc("is_site_admin");
  if (isAdmin !== true) notFound();

  const { note: noteId } = await searchParams;
  const note = REFERENCE_NOTES.find((n) => n.id === noteId) ?? REFERENCE_NOTES[0];

  const { data: row, error } = await supabase
    .from("ctac_reference_notes")
    .select("subjective, objective, assessment, plan, signoff, updated_at")
    .eq("id", note.id)
    .maybeSingle();

  const initial: NoteTexts = row
    ? { subjective: row.subjective, objective: row.objective, assessment: row.assessment, plan: row.plan, signoff: row.signoff }
    : note.texts;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/ctac" className="text-sm text-gray-500 hover:underline dark:text-gray-400">← CTAC note practice</Link>
      <div className="mb-2 mt-2 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold">CTAC reference note</h1>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          Admins only (draft)
        </span>
      </div>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        A complete well visit note in the five LearningSpace boxes. Edit any box and save.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {REFERENCE_NOTES.map((n) => (
          <Link
            key={n.id}
            href={`/ctac/reference?note=${n.id}`}
            className={`rounded-full border px-3 py-1 text-sm ${n.id === note.id
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"}`}
          >
            {n.label}
          </Link>
        ))}
      </div>
      <ReferenceEditor
        key={note.id}
        noteId={note.id}
        starting={note.texts}
        initial={initial}
        savedAt={row?.updated_at ?? null}
        tableMissing={!!error}
      />
    </main>
  );
}
