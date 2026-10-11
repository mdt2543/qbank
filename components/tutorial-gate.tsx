"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CircleUser,
  Folder,
  Ghost,
  Highlighter,
  History,
  MessageSquare,
  Sparkles,
  Trophy,
  X,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Step = {
  icon: LucideIcon;
  title: string;
  body: React.ReactNode;
  action?: { href: string; label: string };
};

const STEPS: Step[] = [
  {
    icon: Sparkles,
    title: "Welcome to teterqbank",
    body: (
      <p>
        A quick tour of what you can do here. It takes about a minute, and you can replay it any
        time from your Profile page.
      </p>
    ),
  },
  {
    icon: Folder,
    title: "Pick a bank and a mode",
    body: (
      <>
        <p>Question banks are grouped into folders on the home page. Each time you start, choose:</p>
        <ul className="mt-2 space-y-1">
          <li>
            <b>Tutor</b>: see the answer and explanations after every question.
          </li>
          <li>
            <b>Exam</b>: no feedback until you submit, then a full review.
          </li>
          <li>
            <b>Timed exam</b>: 90 seconds per question; it submits itself when time runs out and
            can&apos;t be resumed.
          </li>
        </ul>
      </>
    ),
  },
  {
    icon: Highlighter,
    title: "Tools while you answer",
    body: (
      <p>
        Highlight text in the question, strike out answer choices, zoom in or out, and use{" "}
        <b>Mark for Review</b> to flag a question. Open the panel on the right edge to see every
        question at a glance and jump to any of them. Keyboard shortcuts: 1–5 to choose, Enter for
        next, F to flag.
      </p>
    ),
  },
  {
    icon: History,
    title: "Your progress is saved",
    body: (
      <p>
        Leave in the middle of a tutor or exam session and you can <b>Resume</b> it later from that
        bank&apos;s page. Under <b>Previous attempts</b> you can review the full answers for any
        submitted session, or delete it.
      </p>
    ),
  },
  {
    icon: BarChart3,
    title: "Performance",
    body: (
      <p>
        See how you&apos;re doing by learning objective, by case, and by question bank, with your
        weakest areas listed first. The <b>Progress</b> tab shows how much you&apos;ve answered
        each week and how each case has improved.
      </p>
    ),
    action: { href: "/performance", label: "Open Performance" },
  },
  {
    icon: CircleUser,
    title: "Your profile",
    body: (
      <p>
        Choose a display name and upload a picture. They only appear on the leaderboard, next to
        your total questions answered, and nothing else about you is shared with other students.
      </p>
    ),
    action: { href: "/profile", label: "Open Profile" },
  },
  {
    icon: Trophy,
    title: "Leaderboard",
    body: (
      <p>
        See who has answered the most unique questions. Retaking a question doesn&apos;t count
        twice. You only appear once you&apos;ve chosen a display name.
      </p>
    ),
    action: { href: "/leaderboard", label: "Open Leaderboard" },
  },
  {
    icon: Ghost,
    title: "Jump scare mode (optional)",
    body: (
      <>
        <p>
          Feeling brave? Turn on <b>jump scares</b> in your Profile. Very rarely, a loud and sudden
          image and sound will appear while you study in <b>tutor mode</b>. It&apos;s{" "}
          <b>off by default</b>, never happens in exams, and you can switch it off again any time.
        </p>
      </>
    ),
    action: { href: "/profile", label: "Open Profile" },
  },
  {
    icon: MessageSquare,
    title: "Tell us what you think",
    body: (
      <p>
        Spotted a mistake in a question, or have an idea? Use <b>Leave feedback</b> under the Start
        button on any bank, or on the results screen after a session.
      </p>
    ),
  },
];

export default function TutorialGate({ show }: { show: boolean }) {
  const supabase = createClient();
  const [open, setOpen] = useState(show);
  const [step, setStep] = useState(0);
  // when a link inside the tour is followed, the tour shrinks to a small button
  // instead of closing, so the student can carry on from the same step
  const [minimized, setMinimized] = useState(false);

  // first login: record that it has been shown, so it only appears once
  useEffect(() => {
    if (show) supabase.rpc("mark_tutorial_seen").then(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  // the Profile page's "Show the tutorial again" button
  useEffect(() => {
    const replay = () => {
      setStep(0);
      setMinimized(false);
      setOpen(true);
    };
    window.addEventListener("open-tutorial", replay);
    return () => window.removeEventListener("open-tutorial", replay);
  }, []);

  if (!open) return null;

  const s = STEPS[step];
  const Icon = s.icon;
  const last = step === STEPS.length - 1;
  const close = () => {
    setOpen(false);
    setMinimized(false);
  };

  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-[70] flex items-center rounded-full bg-indigo-600 text-white shadow-lg">
        <button
          onClick={() => setMinimized(false)}
          className="rounded-l-full py-2.5 pl-5 pr-3 text-sm font-medium hover:bg-indigo-700"
        >
          Continue tour · {step + 1} of {STEPS.length}
        </button>
        <button
          onClick={close}
          aria-label="End tour"
          className="rounded-r-full py-2.5 pl-1 pr-4 text-white/80 hover:bg-indigo-700 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Site tour"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {step + 1} of {STEPS.length}
          </span>
          <button
            onClick={close}
            className="text-sm text-gray-500 underline-offset-4 hover:underline dark:text-gray-400"
          >
            Skip tour
          </button>
        </div>

        <div className="mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
          <Icon size={24} />
        </div>
        <h2 className="mt-4 text-lg font-semibold">{s.title}</h2>
        <div className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          {s.body}
        </div>

        {s.action && (
          <Link
            href={s.action.href}
            onClick={() => setMinimized(true)}
            className="mt-4 inline-block text-sm font-medium text-indigo-600 underline underline-offset-4 dark:text-indigo-400"
          >
            {s.action.label} →
          </Link>
        )}

        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-1.5" aria-hidden>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${
                  i === step ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-700"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700"
              >
                Back
              </button>
            )}
            <button
              onClick={() => (last ? close() : setStep(step + 1))}
              className="rounded-lg bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
            >
              {last ? "Get started" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
