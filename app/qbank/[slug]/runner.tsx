"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Eraser,
  Highlighter,
  Minus,
  Strikethrough,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import HighlightedText, { type Range, type Tool } from "./highlight";

type Question = {
  id: string;
  stem: string;
  image_path: string | null;
  image_caption: string | null;
  topic_id: string | null;
};
type Choice = { id: string; question_id: string; label: string; body: string };
type Answer = {
  selectedId: string;
  isCorrect: boolean;
  correctId: string;
  explanation: string | null;
  rationales: Record<string, string | null>;
};

function fmtTime(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

type Resume = {
  attempt_id: string;
  mode: string;
  question_ids: string[];
  started_at: string;
  responses: {
    question_id: string;
    selected_choice_id: string | null;
    is_correct?: boolean;
    correct_choice_id?: string;
    explanation?: string | null;
    rationales?: Record<string, string | null> | null;
  }[];
};

export default function Runner({
  slug,
  title,
  userId,
  jumpscares,
}: {
  slug: string;
  title: string;
  userId: string;
  jumpscares: boolean;
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
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [scare, setScare] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const submitting = useRef(false);
  const finishRef = useRef<() => void>(() => {});
  const [resumable, setResumable] = useState<Resume | null>(null);
  const [mode, setMode] = useState<"tutor" | "exam" | "timed">("tutor");
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);
  const [tool, setTool] = useState<Tool>("none");
  const [hl, setHl] = useState<Record<string, Range[]>>({});
  const [struck, setStruck] = useState<Record<string, Record<string, boolean>>>({});
  const [zoom, setZoom] = useState(100);
  const [navOpen, setNavOpen] = useState(false);
  const [navFilter, setNavFilter] = useState<"all" | "unanswered" | "answered" | "flagged">("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reviewPage, setReviewPage] = useState(0);
  const [finishedAt, setFinishedAt] = useState<Date | null>(null);
  const reviewScroll = useRef<HTMLDivElement>(null);
  const [topics, setTopics] = useState<Record<string, { name: string; description: string | null }>>({});
  const timer = useRef<number>(Date.now());

  async function start() {
    setPhase("loading");
    setError(null);

    const { data: id, error: e1 } = await supabase.rpc("start_attempt", {
      p_qbank_slug: slug,
      p_mode: mode === "timed" ? "timed_exam" : mode === "exam" ? "timed" : "tutor",
      p_filter: "all",
      p_count: null,
    });
    if (e1 || !id) {
      setError(e1?.message ?? "Could not start attempt");
      setPhase("idle");
      return;
    }
    if (resumable) {
      await supabase.rpc("abandon_attempt", { p_attempt_id: resumable.attempt_id });
      setResumable(null);
    }

    const { data: attempt } = await supabase
      .from("attempts")
      .select("question_ids, time_limit_seconds")
      .eq("id", id)
      .single();
    if (!attempt) {
      setError("Could not load attempt");
      setPhase("idle");
      return;
    }

    const ids: string[] = attempt.question_ids;
    await load(
      id as string,
      ids,
      undefined,
      mode === "timed" ? attempt.time_limit_seconds : null
    );
  }

  async function resumeSession() {
    if (!resumable) return;
    setPhase("loading");
    setError(null);
    setMode(resumable.mode === "tutor" ? "tutor" : "exam");
    await load(resumable.attempt_id, resumable.question_ids, resumable);
  }

  async function discardResume() {
    if (!resumable) return;
    await supabase.rpc("abandon_attempt", { p_attempt_id: resumable.attempt_id });
    setResumable(null);
  }

  async function load(
    id: string,
    ids: string[],
    resume?: Resume,
    limitSeconds?: number | null
  ) {
    const { data: qs } = await supabase
      .from("v_question")
      .select("id, stem, image_path, image_caption, topic_id")
      .in("id", ids);
    const { data: tp } = await supabase.from("topics").select("id, name, description");
    setTopics(
      Object.fromEntries(
        (tp ?? []).map((t) => [t.id, { name: t.name, description: t.description }])
      )
    );
    const { data: cs } = await supabase
      .from("v_choice")
      .select("id, question_id, label, body")
      .in("question_id", ids);
    const { data: st } = await supabase
      .from("question_status")
      .select("question_id, is_marked")
      .in("question_id", ids);

    const byId = new Map((qs ?? []).map((q) => [q.id, q as Question]));
    const ordered = ids.map((i) => byId.get(i)).filter(Boolean) as Question[];

    const grouped: Record<string, Choice[]> = {};
    for (const c of (cs ?? []) as Choice[]) (grouped[c.question_id] ||= []).push(c);
    for (const k in grouped) grouped[k].sort((a, b) => a.label.localeCompare(b.label));

    const f: Record<string, boolean> = {};
    for (const s of st ?? []) if (s.is_marked) f[s.question_id] = true;

    // rebuild progress when resuming
    const ans: Record<string, Answer> = {};
    const picks: Record<string, string> = {};
    for (const r of resume?.responses ?? []) {
      if (!r.selected_choice_id) continue;
      if (resume?.mode === "tutor") {
        ans[r.question_id] = {
          selectedId: r.selected_choice_id,
          isCorrect: !!r.is_correct,
          correctId: r.correct_choice_id ?? "",
          explanation: r.explanation ?? null,
          rationales: r.rationales ?? {},
        };
      } else {
        picks[r.question_id] = r.selected_choice_id;
      }
    }
    const firstOpen = ordered.findIndex((qq) => !ans[qq.id] && !picks[qq.id]);
    let marks: { hl?: Record<string, Range[]>; struck?: Record<string, Record<string, boolean>> } = {};
    if (resume) {
      try {
        marks = JSON.parse(localStorage.getItem(`qbank-marks:${id}`) ?? "{}");
      } catch {
        marks = {};
      }
    }

    submitting.current = false;
    setDeadline(limitSeconds ? Date.now() + limitSeconds * 1000 : null);
    setRemaining(limitSeconds ?? null);
    setAttemptId(id);
    setQuestions(ordered);
    setChoices(grouped);
    setFlags(f);
    setIndex(firstOpen === -1 ? Math.max(0, ordered.length - 1) : firstOpen);
    setSelected(null);
    setAnswers(ans);
    setPicked(picks);
    setReviewing(false);
    setTool("none");
    setNavFilter("all");
    setNavOpen(false);
    setConfirmOpen(false);
    setHl(marks.hl ?? {});
    setStruck(marks.struck ?? {});
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
        rationales: data.rationales ?? {},
      },
    }));
  }

  async function pick(choiceId: string) {
    const q = questions[index];
    if (!q || !attemptId) return;
    const prev = picked[q.id];
    setPicked((p) => ({ ...p, [q.id]: choiceId }));
    const { error } = await supabase.rpc("answer_question", {
      p_attempt_id: attemptId,
      p_question_id: q.id,
      p_choice_id: choiceId,
      p_seconds: Math.round((Date.now() - timer.current) / 1000),
    });
    if (error) {
      setError(error.message);
      setPicked((p) => {
        const next = { ...p };
        if (prev) next[q.id] = prev;
        else delete next[q.id];
        return next;
      });
    }
  }

  function toggleStrike(choiceId: string) {
    const q = questions[index];
    if (!q) return;
    setStruck((st) => ({
      ...st,
      [q.id]: { ...st[q.id], [choiceId]: !st[q.id]?.[choiceId] },
    }));
  }

  function clickChoice(choiceId: string) {
    const q = questions[index];
    if (!q || answers[q.id]) return;
    if (tool === "strike") toggleStrike(choiceId);
    else if (mode !== "tutor") pick(choiceId);
    else setSelected(choiceId);
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
    if (mode === "tutor") {
      // tutor mode: each question must be answered before moving past it
      const firstOpen = questions.findIndex((qq) => !answers[qq.id]);
      if (firstOpen !== -1 && i > firstOpen) return;
    }
    setIndex(i);
    setSelected(null);
    timer.current = Date.now();
  }

  async function finish() {
    if (!attemptId || submitting.current) return;
    submitting.current = true;
    setConfirmOpen(false);
    const { data, error } = await supabase.rpc("submit_attempt", {
      p_attempt_id: attemptId,
    });
    if (error) {
      submitting.current = false;
      return setError(error.message);
    }
    if (mode !== "tutor") {
      const { data: rev, error: e2 } = await supabase.rpc("attempt_review", {
        p_attempt_id: attemptId,
      });
      if (e2) {
        submitting.current = false;
        return setError(e2.message);
      }
      const a: Record<string, Answer> = {};
      for (const r of rev as {
        question_id: string;
        selected_choice_id: string | null;
        is_correct: boolean;
        correct_choice_id: string;
        explanation: string | null;
        rationales: Record<string, string | null> | null;
      }[]) {
        a[r.question_id] = {
          selectedId: r.selected_choice_id ?? "",
          isCorrect: r.is_correct,
          correctId: r.correct_choice_id,
          explanation: r.explanation,
          rationales: r.rationales ?? {},
        };
      }
      setAnswers(a);
    }
    try {
      localStorage.removeItem(`qbank-marks:${attemptId}`);
    } catch {}
    setResumable(null);
    setDeadline(null);
    setReviewing(false);
    setFinishedAt(new Date());
    setScore({ correct: data.correct, total: data.total });
    setPhase("done");
  }

  useEffect(() => {
    finishRef.current = finish;
  });

  useEffect(() => {
    if (phase !== "active" || deadline === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) finishRef.current();
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [phase, deadline]);

  // Opt-in tutor-mode jump scare: a 1-in-10,000 chance each second the question
  // screen is visible. Skipped entirely when the device asks for reduced motion.
  useEffect(() => {
    if (!jumpscares || phase !== "active" || mode !== "tutor") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const audio = new Audio("/jumpscare.mp3");
    audio.volume = 0.8;
    audio.preload = "auto";
    new Image().src = "/jumpscare.jpg";

    let hide: number | undefined;
    const t = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Math.random() >= 1 / 10000) return;
      setScare(true);
      audio.currentTime = 0;
      audio.play().catch(() => {});
      window.clearTimeout(hide);
      hide = window.setTimeout(() => setScare(false), 2500);
    }, 1000);

    return () => {
      window.clearInterval(t);
      window.clearTimeout(hide);
      audio.pause();
      setScare(false);
    };
  }, [jumpscares, phase, mode]);

  useEffect(() => {
    if (phase !== "active" || mode !== "timed") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase, mode]);

  useEffect(() => {
    if (phase !== "idle") return;
    supabase.rpc("resume_attempt", { p_qbank_slug: slug }).then(({ data }) => {
      setResumable((data as Resume | null) ?? null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (!attemptId || phase !== "active") return;
    try {
      localStorage.setItem(`qbank-marks:${attemptId}`, JSON.stringify({ hl, struck }));
    } catch {}
  }, [hl, struck, attemptId, phase]);

  useEffect(() => {
    supabase.rpc("qbank_counts", { p_qbank_slug: slug }).then(({ data }) => {
      if (data) setCounts(data as Record<string, number>);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== "active" || confirmOpen) return;
    function onKey(e: KeyboardEvent) {
      const q = questions[index];
      if (!q) return;
      const a = answers[q.id];
      if (e.key >= "1" && e.key <= "5" && !a) {
        const c = (choices[q.id] ?? [])[Number(e.key) - 1];
        if (c) clickChoice(c.id);
      } else if (e.key === "Enter") {
        if (mode !== "tutor" && !a) {
          if (index < questions.length - 1) jump(index + 1);
        } else if (!a && selected) submitAnswer();
        else if (a && index < questions.length - 1) jump(index + 1);
      } else if (e.key === "ArrowRight") {
        jump(index + 1);
      } else if (e.key === "ArrowLeft") {
        jump(index - 1);
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
  const pill = (on: boolean) =>
    `rounded-full border px-4 py-1.5 text-sm ${
      on
        ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
        : "border-gray-300 dark:border-gray-700"
    }`;

  // ---------------- start screen ----------------
  if (phase === "idle" || phase === "loading") {
    const available = counts ? counts.total ?? 0 : null;

    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="text-sm text-gray-500 hover:underline dark:text-gray-400">
          ← All banks
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">{title}</h1>

        {counts && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {counts.total} questions · {counts.unused} unused · {counts.incorrect} incorrect ·{" "}
            {counts.marked} flagged
          </p>
        )}

        {resumable && (
          <div className="mt-6 rounded-lg border border-indigo-300 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-950">
            <p className="font-medium">
              Unfinished {resumable.mode === "tutor" ? "tutor" : "exam"} session
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {resumable.responses.length} of {resumable.question_ids.length} answered · started{" "}
              {new Date(resumable.started_at).toLocaleDateString()}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={resumeSession}
                disabled={phase === "loading"}
                className={primaryBtn}
              >
                Resume
              </button>
              <button onClick={discardResume} className={plainBtn}>
                Discard and start new
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Starting a new session below also discards this one.
            </p>
          </div>
        )}

        <div className="mt-8">
          <p className="text-sm font-medium">Mode</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => setMode("tutor")} className={pill(mode === "tutor")}>
              Tutor
            </button>
            <button onClick={() => setMode("exam")} className={pill(mode === "exam")}>
              Exam
            </button>
            <button onClick={() => setMode("timed")} className={pill(mode === "timed")}>
              Timed exam
            </button>
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {mode === "tutor"
              ? "See the answer and explanations after each question."
              : mode === "exam"
              ? "No feedback until you submit. You can change answers before then."
              : `90 seconds per question${
                  available ? ` (${fmtTime(available * 90)} for ${available} questions)` : ""
                }. The exam submits automatically when time runs out and cannot be resumed.`}
          </p>
        </div>

        {banner}

        <button
          onClick={start}
          disabled={phase === "loading" || available === 0}
          className={`mt-8 ${primaryBtn}`}
        >
          {phase === "loading" ? "Starting…" : "Start session"}
        </button>

        {available === 0 && (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            This bank has no questions yet.
          </p>
        )}
      </main>
    );
  }

  // ---------------- results ----------------
  if (phase === "done" && score) {
    const pct = Math.round((score.correct / score.total) * 100);
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Session complete</h1>
        <p className="mt-4 text-4xl font-semibold">{pct}%</p>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          {score.correct} of {score.total} correct
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {mode !== "tutor" && (
            <button
              onClick={() => {
                setIndex(0);
                setSelected(null);
                setReviewing(true);
                setReviewPage(0);
                setPhase("active");
              }}
              className={primaryBtn}
            >
              Review questions
            </button>
          )}
          <button onClick={start} className={mode !== "tutor" ? plainBtn : primaryBtn}>
            Start another
          </button>
          <button onClick={() => setPhase("idle")} className={plainBtn}>
            Change settings
          </button>
          <Link href="/performance" className={plainBtn}>Performance</Link>
          <Link href="/" className={plainBtn}>All banks</Link>
        </div>
      </main>
    );
  }

  // ---------------- question ----------------
  const q = questions[index];
  const answer = answers[q.id];

  if (mode !== "tutor" && reviewing) {
    const PAGE = 50;
    const pages = Math.max(1, Math.ceil(questions.length / PAGE));
    const from = reviewPage * PAGE;
    const slice = questions.slice(from, from + PAGE);
    const pct = score && score.total ? Math.round((1000 * score.correct) / score.total) / 10 : 0;
    const goPage = (n: number) => {
      setReviewPage(n);
      if (reviewScroll.current) reviewScroll.current.scrollTop = 0;
    };
    const iconBtn = "rounded p-1.5 text-white hover:bg-white/15 disabled:opacity-30";

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[#15171c] text-gray-100">
        <div className="flex items-center justify-between bg-black px-4 py-2.5">
          <span className="text-lg font-semibold tracking-tight">
            Qbank <span className="font-normal text-gray-400">exam</span>
          </span>
          <Link href="/" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white">
            <X size={16} /> Exit
          </Link>
        </div>

        <div className="flex items-center justify-between bg-indigo-900 px-4 py-2.5">
          <span className="text-lg font-semibold">View Responses</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setZoom((z) => Math.max(80, z - 10))} className={iconBtn} title="Zoom out">
              <ZoomOut size={18} />
            </button>
            <span className="w-12 text-center text-sm text-indigo-100">{zoom}%</span>
            <button onClick={() => setZoom((z) => Math.min(160, z + 10))} className={iconBtn} title="Zoom in">
              <ZoomIn size={18} />
            </button>
            <button onClick={() => setPhase("done")} className={`ml-2 ${iconBtn}`} title="Back to results">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex items-start justify-between bg-slate-800 px-4 py-3 text-sm">
          <div className="space-y-0.5">
            <p className="font-semibold">{title}</p>
            {finishedAt && <p className="text-gray-300">Submitted {finishedAt.toLocaleString()}</p>}
            {score && (
              <p className="font-semibold">
                Grade: {score.correct} / {score.total} ({pct}%)
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 text-base font-semibold">
            <button onClick={() => goPage(reviewPage - 1)} disabled={reviewPage === 0} className={iconBtn}>
              <ChevronLeft size={18} />
            </button>
            {from + 1} - {from + slice.length}
            <button onClick={() => goPage(reviewPage + 1)} disabled={reviewPage >= pages - 1} className={iconBtn}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div
          ref={reviewScroll}
          className="min-h-0 flex-1 overflow-y-auto"
          style={{ fontSize: `${(17 * zoom) / 100}px` }}
        >
          {slice.map((qq, i) => {
            const a = answers[qq.id];
            const cs = choices[qq.id] ?? [];
            const picked_ = cs.find((c) => c.id === a?.selectedId);
            const right = cs.find((c) => c.id === a?.correctId);
            const omitted = !a?.selectedId;
            const ok = !!a?.isCorrect;
            const tone = omitted
              ? { strip: "bg-neutral-600", panel: "bg-neutral-800/70", label: "OMITTED", text: "text-gray-300" }
              : ok
              ? { strip: "bg-indigo-600", panel: "bg-indigo-950/60", label: "CORRECT", text: "text-indigo-300" }
              : { strip: "bg-red-600", panel: "bg-red-950/60", label: "INCORRECT", text: "text-red-300" };
            const topic = qq.topic_id ? topics[qq.topic_id] : undefined;
            const src = qq.image_path
              ? supabase.storage.from("qbank-images").getPublicUrl(qq.image_path).data.publicUrl
              : null;

            return (
              <section key={qq.id} className="border-b border-neutral-800 px-6 py-6">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-400">
                  #{from + i + 1}
                  {flags[qq.id] && <Bookmark size={14} className="fill-amber-400 text-amber-400" />}
                </h3>

                <div className="mt-3 space-y-3 leading-relaxed">
                  {qq.stem.split(/\n\s*\n/).map((para, k) => (
                    <p key={k}>{para}</p>
                  ))}
                </div>
                {src && (
                  <figure className="mt-3">
                    <a href={src} target="_blank" rel="noreferrer" title="Open full size">
                      <img
                        src={src}
                        alt={qq.image_caption ?? "Figure"}
                        className="w-auto max-w-full rounded border border-neutral-800 bg-black object-contain"
                        style={{ maxHeight: `${(16 * zoom) / 100}rem` }}
                      />
                    </a>
                    {qq.image_caption && (
                      <figcaption className="mt-2 text-[0.75em] text-gray-400">{qq.image_caption}</figcaption>
                    )}
                  </figure>
                )}

                <div className="mt-4 divide-y divide-neutral-800 overflow-hidden rounded border border-neutral-800 bg-[#1b1e24]">
                  {cs.map((c) => {
                    const mine = a?.selectedId === c.id;
                    const isKey = a?.correctId === c.id;
                    const why = a?.rationales?.[c.id];
                    const ring = isKey
                      ? "border-green-500 text-green-400"
                      : mine
                      ? "border-red-500 text-red-400"
                      : "border-neutral-600";
                    return (
                      <div
                        key={c.id}
                        className={`flex items-start gap-3 px-4 py-2 ${
                          isKey ? "bg-green-950/50" : mine ? "bg-red-950/50" : ""
                        }`}
                      >
                        <span
                          className={`mt-[0.2em] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${ring}`}
                        >
                          {(mine || isKey) && <span className="h-2.5 w-2.5 rounded-full bg-current" />}
                        </span>
                        <span className="flex-1">
                          <span>{c.label}) {c.body}</span>
                          {why && (
                            <span className="mt-1.5 block text-[0.9em] leading-relaxed text-gray-300">
                              <span className={`font-medium ${isKey ? "text-green-400" : "text-red-400"}`}>
                                {isKey ? "Correct. " : "Incorrect. "}
                              </span>
                              {why}
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className={`mt-4 flex overflow-hidden rounded ${tone.panel}`}>
                  <div className={`flex w-10 shrink-0 items-center justify-center ${tone.strip}`}>
                    {omitted ? <Minus size={20} /> : ok ? <Check size={20} /> : <X size={20} />}
                  </div>
                  <div className="flex-1 space-y-1.5 p-3 text-[0.85em]">
                    <div className="flex justify-between">
                      <p>
                        <span className="font-semibold">Response </span>
                        {picked_ ? `${picked_.label}) ${picked_.body}` : "No response"}
                      </p>
                      <span className={`ml-4 shrink-0 text-[0.8em] font-semibold ${tone.text}`}>{tone.label}</span>
                    </div>
                    {!ok && right && (
                      <p>
                        <span className="font-semibold">Correct Answer </span>
                        {right.label}) {right.body}
                      </p>
                    )}
                    {a?.explanation && (
                      <p>
                        <span className="font-semibold">Rationale </span>
                        {a.explanation}
                      </p>
                    )}
                    {topic && (
                      <p>
                        <span className="font-semibold">Objective </span>
                        {topic.name}
                        {topic.description ? ` — ${topic.description}` : ""}
                      </p>
                    )}
                    <p className="text-right text-gray-400">{ok ? "1" : "0"} / 1</p>
                  </div>
                </div>
              </section>
            );
          })}

          <div className="flex justify-center gap-3 px-6 py-8">
            {reviewPage > 0 && (
              <button
                onClick={() => goPage(reviewPage - 1)}
                className="rounded bg-neutral-800 px-5 py-2.5 hover:bg-neutral-700"
              >
                Previous {PAGE}
              </button>
            )}
            {reviewPage < pages - 1 && (
              <button
                onClick={() => goPage(reviewPage + 1)}
                className="rounded bg-neutral-800 px-5 py-2.5 hover:bg-neutral-700"
              >
                Next {PAGE}
              </button>
            )}
            <button
              onClick={() => setPhase("done")}
              className="rounded bg-indigo-700 px-5 py-2.5 hover:bg-indigo-600"
            >
              Back to results
            </button>
          </div>
        </div>
      </div>
    );
  }

  const exam = mode !== "tutor";
  const paras = q.stem.split(/\n\s*\n/);
  const imgSrc = q.image_path
    ? supabase.storage.from("qbank-images").getPublicUrl(q.image_path).data.publicUrl
    : null;
  const topic = q.topic_id ? topics[q.topic_id] : undefined;
  const isDone = (id: string) => (exam ? !!picked[id] : !!answers[id]);
  const nAnswered = questions.filter((qq) => isDone(qq.id)).length;
  const nFlagged = questions.filter((qq) => flags[qq.id]).length;
  const nLeft = questions.length - nAnswered;
  const tb = (on: boolean) =>
    `flex h-9 w-9 items-center justify-center rounded ${
      on ? "bg-yellow-400 text-black" : "text-gray-300 hover:bg-neutral-800"
    }`;
  const flip = (t: Tool) => setTool((cur) => (cur === t ? "none" : t));

  const circle = (qq: Question, i: number, go: () => void) => {
    const a = answers[qq.id];
    let cls = "border-neutral-600 text-gray-300 hover:bg-neutral-800";
    if (!exam && a)
      cls = a.isCorrect
        ? "border-green-600 bg-green-900 text-green-100"
        : "border-red-500 bg-red-900 text-red-100";
    else if (exam && picked[qq.id]) cls = "border-violet-500 bg-violet-700 text-white";
    return (
      <button
        key={qq.id}
        onClick={go}
        className={`relative h-11 w-11 shrink-0 rounded-full border text-sm font-medium ${cls} ${
          i === index ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-[#15171c]" : ""
        }`}
      >
        {i + 1}
        {flags[qq.id] && (
          <Bookmark size={13} className="absolute -bottom-1 -right-1 fill-red-500 text-red-500" />
        )}
      </button>
    );
  };

  const legend = (filterable: boolean) => {
    const chip = (key: typeof navFilter, dot: React.ReactNode, n: number) => (
      <button
        key={key}
        disabled={!filterable}
        onClick={() => setNavFilter((f) => (f === key ? "all" : key))}
        className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 text-sm ${
          filterable && navFilter === key ? "bg-neutral-700" : ""
        }`}
      >
        {dot}
        {n}
      </button>
    );
    return (
      <div className="flex items-center gap-3">
        {chip("unanswered", <span className="h-3.5 w-3.5 rounded-full border border-neutral-500" />, nLeft)}
        {chip("answered", <span className="h-3.5 w-3.5 rounded-full bg-violet-600" />, nAnswered)}
        <span className="flex-1" />
        {chip("flagged", <Bookmark size={14} className="fill-red-500 text-red-500" />, nFlagged)}
      </div>
    );
  };

  const shown = questions
    .map((qq, i) => ({ qq, i }))
    .filter(({ qq }) =>
      navFilter === "unanswered"
        ? !isDone(qq.id)
        : navFilter === "answered"
        ? isDone(qq.id)
        : navFilter === "flagged"
        ? !!flags[qq.id]
        : true
    );

  const nextBtn =
    "flex flex-1 items-center justify-center gap-3 bg-indigo-700 py-4 text-lg font-medium hover:bg-indigo-600 disabled:opacity-40";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#15171c] text-gray-100">
      <div className="flex items-center justify-between bg-black px-4 py-2.5">
        <span className="text-lg font-semibold tracking-tight">
          Qbank <span className="font-normal text-gray-400">{mode === "timed" ? "timed exam" : exam ? "exam" : "tutor"}</span>
        </span>
        <Link
          href="/"
          onClick={(e) => {
            if (mode === "timed") {
              e.preventDefault();
              if (
                window.confirm(
                  "Exit now? A timed exam cannot be resumed, so it will be submitted with your current answers."
                )
              )
                finish();
              return;
            }
            if (
              !window.confirm(
                "Leave this session? Your answers are saved, but it will not be submitted."
              )
            )
              e.preventDefault();
          }}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"
        >
          <X size={16} /> Exit
        </Link>
      </div>

      <div className="flex items-center justify-between bg-indigo-900 px-4 py-2.5">
        <span className="text-lg font-semibold">{title}</span>
        <div className="flex items-center gap-3">
          {mode === "timed" && remaining !== null && (
            <span
              className={`rounded px-3 py-1 font-mono text-sm font-semibold ${
                remaining <= 300
                  ? "bg-red-600"
                  : remaining <= 600
                  ? "bg-amber-600"
                  : "bg-green-700"
              }`}
              title="Time remaining"
            >
              {fmtTime(remaining)}
            </span>
          )}
          <button
            onClick={() => setConfirmOpen(true)}
            className="rounded bg-white/15 px-4 py-1.5 text-sm hover:bg-white/25"
          >
            {exam ? "Submit exam" : "End session"}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-6 pt-4">
            <h2 className="text-xl font-semibold">
              #{index + 1}
              <span className="ml-2 text-sm font-normal text-gray-500">of {questions.length}</span>
            </h2>
            <div className="flex items-center gap-1">
              <button onClick={() => flip("highlight")} className={tb(tool === "highlight")} title="Highlight (select text)">
                <Highlighter size={18} />
              </button>
              <button onClick={() => flip("erase")} className={tb(tool === "erase")} title="Remove highlight (select text)">
                <Eraser size={18} />
              </button>
              <button onClick={() => flip("strike")} className={tb(tool === "strike")} title="Strike out answer choices">
                <Strikethrough size={18} />
              </button>
              <span className="mx-2 h-5 w-px bg-neutral-700" />
              <button onClick={() => setZoom((z) => Math.max(80, z - 10))} className={tb(false)} title="Zoom out">
                <ZoomOut size={18} />
              </button>
              <span className="w-12 text-center text-sm text-gray-300">{zoom}%</span>
              <button onClick={() => setZoom((z) => Math.min(160, z + 10))} className={tb(false)} title="Zoom in">
                <ZoomIn size={18} />
              </button>
              <span className="mx-2 h-5 w-px bg-neutral-700" />
              <button
                onClick={toggleFlag}
                className="flex items-center gap-1.5 rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-neutral-800"
              >
                <Bookmark size={18} className={flags[q.id] ? "fill-red-500 text-red-500" : ""} />
                Mark for Review
              </button>
            </div>
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-3"
            style={{ fontSize: `${(17 * zoom) / 100}px` }}
          >
            {error && <p className="mb-4 rounded bg-red-950 p-3 text-sm text-red-200">{error}</p>}

            <div className="rounded border border-dashed border-neutral-700 p-3">
              <HighlightedText
                paragraphs={paras}
                ranges={hl[q.id] ?? []}
                tool={tool}
                onChange={(next) => setHl((h) => ({ ...h, [q.id]: next }))}
              />
              {imgSrc && (
                <figure className="mt-4">
                  <a href={imgSrc} target="_blank" rel="noreferrer" title="Open full size">
                    <img
                      src={imgSrc}
                      alt={q.image_caption ?? "Figure"}
                      className="w-auto max-w-full rounded border border-neutral-800 bg-black object-contain"
                      style={{ maxHeight: `${(16 * zoom) / 100}rem` }}
                    />
                  </a>
                  {q.image_caption && (
                    <figcaption className="mt-2 text-[0.75em] text-gray-400">{q.image_caption}</figcaption>
                  )}
                </figure>
              )}
            </div>

            <div className="mt-4 divide-y divide-neutral-800 overflow-hidden rounded border border-neutral-800 bg-[#1b1e24]">
              {(choices[q.id] ?? []).map((c) => {
                const mine = answer
                  ? answer.selectedId === c.id
                  : exam
                  ? picked[q.id] === c.id
                  : selected === c.id;
                const isKey = !!answer && answer.correctId === c.id;
                const why = answer?.rationales?.[c.id];
                const cut = !!struck[q.id]?.[c.id];
                let row = "hover:bg-neutral-800/60";
                let ring = "border-neutral-500";
                if (answer) {
                  row = isKey ? "bg-green-950/60" : mine ? "bg-red-950/60" : "";
                  ring = isKey
                    ? "border-green-500 text-green-400"
                    : mine
                    ? "border-red-500 text-red-400"
                    : "border-neutral-600";
                } else if (mine) {
                  row = "bg-sky-950/50";
                  ring = "border-sky-400 text-sky-400";
                }
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={!!answer}
                    onClick={() => clickChoice(c.id)}
                    className={`flex w-full items-start gap-3 px-4 py-2 text-left ${row}`}
                  >
                    <span
                      className={`mt-[0.2em] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${ring}`}
                    >
                      {(mine || isKey) && <span className="h-2.5 w-2.5 rounded-full bg-current" />}
                    </span>
                    <span className="flex-1">
                      <span className={cut ? "text-gray-500 line-through" : ""}>
                        {c.label}) {c.body}
                      </span>
                      {why && (
                        <span className="mt-2 block text-[0.9em] leading-relaxed text-gray-300">
                          <span className={`font-medium ${isKey ? "text-green-400" : "text-red-400"}`}>
                            {isKey ? "Correct. " : "Incorrect. "}
                          </span>
                          {why}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {!exam && !answer && (
              <button
                onClick={submitAnswer}
                disabled={!selected}
                className="mt-4 rounded bg-indigo-700 px-5 py-2.5 hover:bg-indigo-600 disabled:opacity-40"
              >
                Submit answer
              </button>
            )}

            {answer && (
              <div className="mt-4 rounded border border-neutral-800 bg-[#1b1e24] p-4">
                <p className={`font-medium ${answer.isCorrect ? "text-green-400" : "text-red-400"}`}>
                  {answer.isCorrect ? "Correct" : "Incorrect"}
                </p>
                {answer.explanation && (
                  <p className="mt-2 text-[0.9em] leading-relaxed text-gray-200">{answer.explanation}</p>
                )}
                {topic && (
                  <div className="mt-3 border-t border-neutral-800 pt-3 text-[0.9em]">
                    <p className="font-medium text-gray-200">{topic.name}</p>
                    {topic.description && (
                      <p className="mt-1 leading-relaxed text-gray-400">{topic.description}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="relative flex">
          <button
            onClick={() => setNavOpen((o) => !o)}
            className="absolute right-full top-3 flex h-10 w-6 items-center justify-center rounded-l bg-neutral-800 text-gray-300 hover:bg-neutral-700"
            title={navOpen ? "Hide question list" : "Show question list"}
          >
            {navOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          {navOpen && (
            <aside className="flex w-80 flex-col border-l border-neutral-800 bg-neutral-950">
              <p className="border-b border-neutral-800 px-4 py-2.5 text-sm font-medium text-gray-300">
                Review
              </p>
              <div className="border-b border-neutral-800 px-4 py-2.5">{legend(true)}</div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-5 justify-items-center gap-3">
                  {shown.map(({ qq, i }) => circle(qq, i, () => jump(i)))}
                </div>
                {shown.length === 0 && (
                  <p className="text-center text-sm text-gray-500">No questions match.</p>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>

      <div className="flex">
        <button
          onClick={() => jump(index - 1)}
          disabled={index === 0}
          className="flex flex-1 items-center justify-center gap-3 bg-neutral-800 py-4 text-lg font-medium hover:bg-neutral-700 disabled:opacity-40"
        >
          <ArrowLeft size={20} /> Previous Page
        </button>
        {index < questions.length - 1 ? (
          <button
            onClick={() => jump(index + 1)}
            disabled={!exam && !answer}
            title={!exam && !answer ? "Submit an answer to continue" : undefined}
            className={nextBtn}
          >
            Next Page <ArrowRight size={20} />
          </button>
        ) : (
          <button onClick={() => setConfirmOpen(true)} className={nextBtn}>
            {exam ? "Submit exam" : "End session"} <ArrowRight size={20} />
          </button>
        )}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-20">
          <div className="w-full max-w-4xl overflow-hidden rounded bg-[#1b1e24] shadow-xl">
            <div className="bg-indigo-700 px-5 py-3 text-lg font-semibold">Confirm your submission</div>
            <div className="space-y-3 px-5 py-4 text-sm text-gray-300">
              <p>
                <span className="font-semibold text-gray-100">Please review your submission.</span> A
                colored circle indicates that the question is answered. Select a question to view it or
                use the &quot;Go Back&quot; button to return.
              </p>
              <p>When you are ready to submit, click the &quot;Submit&quot; button.</p>
            </div>
            <div className="border-y border-neutral-800 px-5 py-2.5">{legend(false)}</div>
            <div className="flex max-h-72 flex-wrap gap-3 overflow-y-auto px-5 py-5">
              {questions.map((qq, i) =>
                circle(qq, i, () => {
                  setConfirmOpen(false);
                  jump(i);
                })
              )}
            </div>
            <div className="flex">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex flex-1 items-center justify-center gap-2 bg-teal-600 py-3.5 font-medium hover:bg-teal-500"
              >
                <ArrowLeft size={18} /> Go Back
              </button>
              <button
                onClick={finish}
                className="flex flex-1 items-center justify-center gap-2 bg-sky-600 py-3.5 font-medium hover:bg-sky-500"
              >
                Submit {exam ? "Test" : "Session"} <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {scare && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
          onClick={() => setScare(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/jumpscare.jpg" alt="" className="h-full w-full object-contain" />
        </div>
      )}
    </div>
  );
}
