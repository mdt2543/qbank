"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function FeedbackForm({
  slug,
  attemptId = null,
}: {
  slug: string;
  attemptId?: string | null;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("submit_feedback", {
      p_qbank_slug: slug,
      p_message: message,
      p_rating: rating,
      p_attempt_id: attemptId,
    });
    setBusy(false);
    if (error) return setError(error.message);
    setSent(true);
    setMessage("");
    setRating(null);
  }

  if (sent) {
    return (
      <p className="text-sm text-green-700 dark:text-green-400">
        Thanks, your feedback was sent.{" "}
        <button
          onClick={() => {
            setSent(false);
            setOpen(true);
          }}
          className="underline"
        >
          Send more
        </button>
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="block text-sm text-gray-700 underline underline-offset-4 hover:text-black dark:text-gray-300 dark:hover:text-white"
      >
        Leave feedback
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <p className="text-sm font-medium">Leave feedback</p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        About this question bank. Your name and email are included so your instructor can follow
        up.
      </p>

      <div className="mt-3 flex items-center gap-1" role="group" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(rating === n ? null : n)}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            className={`text-2xl leading-none ${
              rating !== null && n <= rating ? "text-amber-500" : "text-gray-300 dark:text-gray-700"
            }`}
          >
            ★
          </button>
        ))}
        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">optional</span>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={2000}
        rows={4}
        placeholder="What worked, what didn't, any errors you spotted…"
        className="mt-3 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
      />

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          onClick={send}
          disabled={busy || !message.trim()}
          className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          {busy ? "Sending…" : "Send"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
