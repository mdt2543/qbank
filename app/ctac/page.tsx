import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { REFERENCE_NOTES, type NoteTexts } from "@/lib/ctac-reference";
import NoteBuilder from "./note-builder";

export const metadata: Metadata = { title: "CTAC note practice · teterqbank" };

// Admin only until the owner approves it for students: everyone else gets a 404.
export default async function CtacPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: isAdmin } = await supabase.rpc("is_site_admin");
  if (isAdmin !== true) notFound();

  // the reference notes for missed-item practice: the saved copy if there is one, else the starting text
  const { data: rows } = await supabase
    .from("ctac_reference_notes")
    .select("id, subjective, objective, assessment, plan, signoff");
  const references = Object.fromEntries(REFERENCE_NOTES.map((n) => {
    const r = rows?.find((x) => x.id === n.id);
    const texts: NoteTexts = r
      ? { subjective: r.subjective, objective: r.objective, assessment: r.assessment, plan: r.plan, signoff: r.signoff }
      : n.texts;
    return [n.sex, { name: n.label.replace(/\s*\(.*\)$/, ""), texts }];
  })) as Record<"female" | "male", { name: string; texts: NoteTexts }>;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold">CTAC note practice</h1>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          Admins only (draft)
        </span>
        <Link href="/ctac/reference" className="ml-auto text-sm text-brand-700 hover:underline dark:text-brand-300">
          Reference note →
        </Link>
      </div>
      <p className="mb-4 max-w-3xl text-sm text-gray-600 dark:text-gray-400">
        Write the SOAP note from memory in the same five boxes as LearningSpace. A stopwatch runs from
        your first keystroke until you submit, then you see your time, typing speed and the CTAC SOAP
        rubric. Practice the full note, or time and grade just the Subjective, the ROS, or the Objective.
        Your draft stays in this browser only.
      </p>
      <NoteBuilder references={references} />
    </main>
  );
}
