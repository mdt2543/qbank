"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Question = { id: string; stem: string };
type Choice = { id: string; question_id: string; label: string; body: string };
type Answer = {
  selectedId: string;
  isCorrect: boolean;
  correctId: string;
  explanation: string | null;
};

export default function Runner({
  slug,
  title,
  userId,
}: {
  slug: string;
  title: string;
  userId: string;
}) {
  const supabase = createClient();
  const [phase, setPhase] = useState<"idle" | "loading" | "active" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [choices, setChoices] = useState<Record<string, Choice[]>>({});
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
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

    const { data: attempt } = await supabase
      .from("attempts")
      .select("question_ids")
      .eq("id", id)
      .single();
    if (!attempt) {
      setError("Could not load attempt");
      setPhase("idle");
      return;
    }

    const ids: string[] = attempt.question_ids;
    const { data: qs } = await supabase.from("v_question").select("id, stem").in("id", ids);
    const { data: cs } = await supabase
      .from("v_choice").select("id, question_id, label, body").in("question_id", ids);
    const { data: st } = await supabase
      .from("question_status").select("question_id, is_marked").in("question_id", ids);

    const byId = new Map((qs ?? []).map((q) => [q.id, q as Question]));
    const ordered = ids.map((i) => byId.get(i)).filter(Boolean) as Question[];

    const grouped: Record<string, Choice[]> = {};
    for (const c of (cs ?? []) as Choice[]) (grouped[c.question_id] ||= []).push(c);
    for (const k in grouped) grouped[k].sort((a, b) => a.label.localeCompare(b.label));

    const f: Record<string, boolean> = {};
    for (const s of st ?? []) if (s.is_marked) f[s.question_id] = true;

    setAttemptId(id as string);
    setQuestions(ordered);
    setChoices(grouped);
    setFlags(f);
    setIndex(0);
    setSelected(null);
    setAnswers({});
    setScore(null);
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
      },
    }));
  }

  async function toggleFlag() {
    const q = questions[index];
    if (!q) return;
    const next = !flags[q.id];
    setFlags((f) => ({ ...f, [q.id]: next }));
    await supabase
      .from("question_status")
      .upsert(
        { user_id: userId, question_id: q.id, is_marked: next },
        { onConflict: "user_id,question_id" }
      );
  }

  function jump(i: number) {
    if (i < 0 || i >= questions.length) return;
    setIndex(i);
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

  useEffect(() => {
    if (phase !== "active") return;
    function onKey(e: KeyboardEvent) {
      const q = questions[index];
      if (!q) return;
      const a = answers[q.id];
      if (e.key >= "1" && e.key <= "5" && !a) {
        const c = (choices[q.id] ?? [])[Number(e.key) - 1];
        if (c) setSelected(c.id);
      } else if (e.key === "Enter") {
        if (!a && selected) submitAnswer();
        else if (a && index < questions.length - 1) jump(index + 1);
      } else if (e.key.toLowerCase() === "f") {
        toggleFlag();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const banner = error && (
    <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
      {error}
    </p>
  );

  const primaryBtn =
    "rounded-lg bg-black px-5 py-2.5 text-white dark:bg-white dark:text-black disabled:opacity-40";
  const plainBtn =
    "rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-700 disabled:opacity-40";

  if (phase === "idle" || phase === "loading") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="text-sm text-gray-500 hover:underline dark:text-gray-400">
          ← All banks
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Tutor mode shows the explanation after each answer.
        </p>
        {banner}
        <button onClick={start} disabled={phase === "loading"} className={`mt-6 ${primaryBtn}`}>
          {phase === "loading" ? "Starting…" : "Start session"}
        </button>
      </main>
    );
  }

  if (phase === "done" && score) {
    const pct = Math.round((score.correct / score.total) * 100);
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Session complete</h1>
        <p className="mt-4 text-4xl font-semibold">{pct}%</p>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          {score.correct} of {score.total} correct
        </p>
        <div className="mt-8 flex gap-3">
          <button onClick={start} className={primaryBtn}>Start another</button>
          <Link href="/" className={plainBtn}>All banks</Link>
        </div>
      </main>
    );
  }

  const q = questions[index];
  const answer = answers[q.id];

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <Link href="/" className="hover:underline">← All banks</Link>
        <span>Question {index + 1} of {questions.length}</span>
      </div>

      <div className="mt-4 grid grid-cols-10 gap-1.5">
        {questions.map((qq, i) => {
          const a = answers[qq.id];
          let cls = "border-gray-300 text-gray-500 dark:border-gray-700 dark:text-gray-400";
          if (a)
            cls = a.isCorrect
              ? "border-green-600 bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100"
              : "border-red-500 bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100";
          return (
            <button
              key={qq.id}
              onClick={() => jump(i)}
              className={`relative h-8 rounded border text-xs ${cls} ${
                i === index ? "ring-2 ring-black dark:ring-white" : ""
              }`}
            >
              {i + 1}
              {flags[qq.id] && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500" />
              )}
            </button>
          );
        })}
      </div>

      {banner}

      <p className="mt-8 text-lg leading-relaxed">{q.stem}</p>

      <div className="mt-6 space-y-2">
        {(choices[q.id] ?? []).map((c) => {
          const isPicked = answer ? answer.selectedId === c.id : selected === c.id;
          const isKey = answer && answer.correctId === c.id;
          let cls = "border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900";
          if (answer) {
            if (isKey) cls = "border-green-600 bg-green-50 dark:bg-green-950";
            else if (isPicked) cls = "border-red-500 bg-red-50 dark:bg-red-950";
            else cls = "border-gray-200 opacity-50 dark:border-gray-800";
          } else if (isPicked) {
            cls = "border-black bg-gray-100 dark:border-white dark:bg-gray-800";
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
        <div className="mt-6 flex items-center gap-3">
          <button onClick={submitAnswer} disabled={!selected} className={primaryBtn}>
            Submit answer
          </button>
          <button onClick={toggleFlag} className={plainBtn}>
            {flags[q.id] ? "Unflag" : "Flag"}
          </button>
        </div>
      ) : (
        <>
          <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900">
            <p
              className={`font-medium ${
                answer.isCorrect
                  ? "text-green-700 dark:text-green-400"
                  : "text-red-700 dark:text-red-400"
              }`}
            >
              {answer.isCorrect ? "Correct" : "Incorrect"}
            </p>
            {answer.explanation && (
              <p className="mt-3 text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                {answer.explanation}
              </p>
            )}
          </div>
          <button onClick={toggleFlag} className={`mt-3 ${plainBtn}`}>
            {flags[q.id] ? "Unflag" : "Flag"}
          </button>
        </>
      )}

      <div className="mt-8 flex items-center justify-between">
        <button onClick={() => jump(index - 1)} disabled={index === 0} className={plainBtn}>
          Previous
        </button>
        <span className="text-xs text-gray-400">1–5 select · Enter submit · F flag</span>
        {index < questions.length - 1 ? (
          <button onClick={() => jump(index + 1)} className={plainBtn}>Next</button>
        ) : (
          <button onClick={finish} className={primaryBtn}>Finish</button>
        )}
      </div>
    </main>
  );
}