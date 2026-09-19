"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Question = { id: string; stem: string };
type Choice = { id: string; question_id: string; label: string; body: string };
type Answer = {
  selectedId: string;
  isCorrect: boolean;
  correctId: string;
  explanation: string | null;
  rationales: Record<string, string | null>;
};

export default function Runner({ slug, title }: { slug: string; title: string }) {
  const supabase = createClient();
  const [phase, setPhase] = useState<"idle" | "loading" | "active" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [choices, setChoices] = useState<Record<string, Choice[]>>({});
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  const timer = useRef<number>(Date.now());

  async function start() {
    setPhase("loading");
    setError(null);

    const { data: id, error: e1 } = await supabase.rpc("start_attempt", {
      p_qbank_slug: slug,
      p_mode: "tutor",
      p_filter: "all",
    });
    if (e1 || !id) {
      setError(e1?.message ?? "Could not start attempt");
      setPhase("idle");
      return;
    }

    const { data: attempt, error: e2 } = await supabase
      .from("attempts")
      .select("question_ids")
      .eq("id", id)
      .single();
    if (e2 || !attempt) {
      setError(e2?.message ?? "Could not load attempt");
      setPhase("idle");
      return;
    }

    const ids: string[] = attempt.question_ids;
    const { data: qs } = await supabase
      .from("v_question").select("id, stem").in("id", ids);
    const { data: cs } = await supabase
      .from("v_choice").select("id, question_id, label, body").in("question_id", ids);

    const byId = new Map((qs ?? []).map((q) => [q.id, q as Question]));
    const ordered = ids.map((i) => byId.get(i)).filter(Boolean) as Question[];

    const grouped: Record<string, Choice[]> = {};
    for (const c of (cs ?? []) as Choice[]) {
      (grouped[c.question_id] ||= []).push(c);
    }
    for (const k in grouped) grouped[k].sort((a, b) => a.label.localeCompare(b.label));

    setAttemptId(id as string);
    setQuestions(ordered);
    setChoices(grouped);
    setIndex(0);
    setSelected(null);
    setAnswers({});
    timer.current = Date.now();
    setPhase("active");
  }

  async function submitAnswer() {
    if (!selected || !attemptId) return;
    const q = questions[index];
    const { data, error } = await supabase.rpc("answer_question", {
      p_attempt_id: attemptId,
      p_question_id: q.id,
      p_choice_id: selected,
      p_seconds: Math.round((Date.now() - timer.current) / 1000),
    });
    if (error) return setError(error.message);

    setAnswers((a) => ({
      ...a,
      [q.id]: {
        selectedId: selected,
        isCorrect: data.is_correct,
        correctId: data.correct_choice_id,
        explanation: data.explanation,
        rationales: data.rationales ?? {},
      },
    }));
  }

  function go(delta: number) {
    const next = index + delta;
    if (next < 0 || next >= questions.length) return;
    setIndex(next);
    setSelected(null);
    timer.current = Date.now();
  }

  async function finish() {
    if (!attemptId) return;
    const { data, error } = await supabase.rpc("submit_attempt", {
      p_attempt_id: attemptId,
    });
    if (error) return setError(error.message);
    setScore({ correct: data.correct, total: data.total });
    setPhase("done");
  }

  const banner = error && (
    <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
  );

  if (phase === "idle" || phase === "loading") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <Link href="/" className="text-sm text-gray-500 hover:underline">← All banks</Link>
        <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-gray-600">
          Tutor mode shows the explanation after each answer.
        </p>
        {banner}
        <button
          onClick={start}
          disabled={phase === "loading"}
          className="mt-6 rounded-lg bg-black px-5 py-2.5 text-white disabled:opacity-50"
        >
          {phase === "loading" ? "Starting…" : "Start session"}
        </button>
      </main>
    );
  }

  if (phase === "done" && score) {
    const pct = Math.round((score.correct / score.total) * 100);
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Session complete</h1>
        <p className="mt-4 text-4xl font-semibold">{pct}%</p>
        <p className="mt-1 text-gray-600">{score.correct} of {score.total} correct</p>
        <div className="mt-8 flex gap-3">
          <button onClick={start} className="rounded-lg bg-black px-5 py-2.5 text-white">
            Start another
          </button>
          <Link href="/" className="rounded-lg border px-5 py-2.5">All banks</Link>
        </div>
      </main>
    );
  }

  const q = questions[index];
  const answer = answers[q.id];
  const answeredCount = Object.keys(answers).length;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <Link href="/" className="hover:underline">← All banks</Link>
        <span>Question {index + 1} of {questions.length}</span>
      </div>

      <div className="mt-3 h-1 w-full rounded bg-gray-200">
        <div
          className="h-1 rounded bg-black transition-all"
          style={{ width: `${((index + 1) / questions.length) * 100}%` }}
        />
      </div>

      {banner}

      <p className="mt-8 text-lg leading-relaxed">{q.stem}</p>

      <div className="mt-6 space-y-2">
        {(choices[q.id] ?? []).map((c) => {
          const isPicked = answer ? answer.selectedId === c.id : selected === c.id;
          const isKey = answer && answer.correctId === c.id;
          let cls = "border-gray-200 hover:bg-gray-50";
          if (answer) {
            if (isKey) cls = "border-green-500 bg-green-50";
            else if (isPicked) cls = "border-red-400 bg-red-50";
            else cls = "border-gray-200 opacity-60";
          } else if (isPicked) {
            cls = "border-black bg-gray-50";
          }
          return (
            <button
              key={c.id}
              disabled={!!answer}
              onClick={() => setSelected(c.id)}
              className={`flex w-full gap-3 rounded-lg border p-4 text-left ${cls}`}
            >
              <span className="font-medium">{c.label}.</span>
              <span>{c.body}</span>
            </button>
          );
        })}
      </div>

      {!answer ? (
        <button
          onClick={submitAnswer}
          disabled={!selected}
          className="mt-6 rounded-lg bg-black px-5 py-2.5 text-white disabled:opacity-40"
        >
          Submit answer
        </button>
      ) : (
        <div className="mt-6 rounded-lg border bg-gray-50 p-5">
          <p className={`font-medium ${answer.isCorrect ? "text-green-700" : "text-red-700"}`}>
            {answer.isCorrect ? "Correct" : "Incorrect"}
          </p>
          {answer.explanation && (
            <p className="mt-3 text-sm leading-relaxed text-gray-800">{answer.explanation}</p>
          )}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={() => go(-1)}
          disabled={index === 0}
          className="rounded-lg border px-4 py-2 disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-sm text-gray-500">{answeredCount} answered</span>
        {index < questions.length - 1 ? (
          <button onClick={() => go(1)} className="rounded-lg border px-4 py-2">Next</button>
        ) : (
          <button onClick={finish} className="rounded-lg bg-black px-4 py-2 text-white">
            Finish
          </button>
        )}
      </div>
    </main>
  );
}