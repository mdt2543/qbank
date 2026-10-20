import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PrintControls from "./print-controls";
import PrintSheet, { type PrintData, type PrintQuestion } from "./sheet";

type Review = {
  question_id: string;
  selected_choice_id: string | null;
  is_correct: boolean;
  correct_choice_id: string;
  explanation: string | null;
  rationales: Record<string, string | null> | null;
};

const MODE_LABEL: Record<string, string> = {
  tutor: "Tutor",
  timed: "Exam",
  timed_exam: "Timed exam",
};

export default async function PrintResults({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; attemptId: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  const { slug, attemptId } = await params;
  const { auto } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Admins only. Anyone else gets an ordinary "not found" page.
  const { data: isAdmin } = await supabase.rpc("is_site_admin");
  if (isAdmin !== true) notFound();

  // your own submitted session (the database refuses anything else)
  const { data: attempt } = await supabase
    .from("attempts")
    .select("id, mode, submitted_at, score_correct, score_total, question_ids")
    .eq("id", attemptId)
    .single();
  if (!attempt) notFound();
  const { data: rev } = await supabase.rpc("attempt_review", { p_attempt_id: attemptId });
  if (!rev) notFound();

  const ids: string[] = attempt.question_ids ?? [];
  const [{ data: qs }, { data: cs }, { data: tp }, { data: info }, { data: prof }] = await Promise.all([
    supabase
      .from("v_question")
      .select("id, stem, image_path, image_caption, topic_id")
      .in("id", ids),
    supabase.from("v_choice").select("id, question_id, label, body").in("question_id", ids),
    supabase.from("topics").select("id, name, description"),
    supabase.rpc("admin_bank_info", { p_slug: slug }),
    supabase.from("student_profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
  ]);

  const reviewById = new Map((rev as Review[]).map((r) => [r.question_id, r]));
  const questionById = new Map((qs ?? []).map((q) => [q.id as string, q]));
  const topicById = new Map((tp ?? []).map((t) => [t.id as string, t]));
  const choicesByQuestion = new Map<string, NonNullable<typeof cs>>();
  for (const c of cs ?? []) {
    const list = choicesByQuestion.get(c.question_id as string) ?? [];
    list.push(c);
    choicesByQuestion.set(c.question_id as string, list);
  }

  const questions: PrintQuestion[] = [];
  ids.forEach((id, i) => {
    const q = questionById.get(id);
    const r = reviewById.get(id);
    if (!q || !r) return;
    const choices = [...(choicesByQuestion.get(id) ?? [])].sort((a, b) =>
      String(a.label).localeCompare(String(b.label))
    );
    const topic = q.topic_id ? topicById.get(q.topic_id as string) : undefined;
    questions.push({
      number: i + 1,
      stem: q.stem as string,
      imageUrl: q.image_path
        ? supabase.storage.from("qbank-images").getPublicUrl(q.image_path as string).data.publicUrl
        : null,
      caption: (q.image_caption as string | null) ?? null,
      choices: choices.map((c) => ({
        id: c.id as string,
        label: c.label as string,
        body: c.body as string,
        why: r.rationales?.[c.id as string] ?? null,
        isKey: r.correct_choice_id === c.id,
        mine: r.selected_choice_id === c.id,
      })),
      outcome: !r.selected_choice_id ? "omitted" : r.is_correct ? "correct" : "incorrect",
      explanation: r.explanation,
      objective: topic
        ? { name: topic.name as string, description: (topic.description as string | null) ?? null }
        : null,
    });
  });

  const bank = (info as { title: string }[] | null)?.[0];
  const data: PrintData = {
    bankTitle: bank?.title ?? "Question bank",
    modeLabel: MODE_LABEL[attempt.mode as string] ?? String(attempt.mode),
    submitted: attempt.submitted_at
      ? new Date(attempt.submitted_at as string).toLocaleString("en-US", {
          dateStyle: "long",
          timeStyle: "short",
          timeZone: "America/New_York",
        }) + " ET"
      : "",
    student: (prof?.display_name as string | null) ?? (user.email ?? "").split("@")[0],
    correct: attempt.score_correct ?? 0,
    total: attempt.score_total ?? ids.length,
    questions,
  };

  return (
    <main className="min-h-screen bg-neutral-900 px-4 pb-10 print:bg-white print:p-0">
      <PrintControls auto={auto === "1"} />
      <PrintSheet data={data} />
    </main>
  );
}
