"use client";

import { useEffect, useRef, useState } from "react";
import { Megaphone, TriangleAlert, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Item = { id: string; message: string; level: string };

function Row({ item, onDismiss }: { item: Item; onDismiss: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const line = useRef<HTMLSpanElement>(null);

  // is the one-line version cut off? (only measurable while it is collapsed)
  useEffect(() => {
    if (expanded) return;
    const check = () => {
      const el = line.current;
      if (el) setOverflowing(el.scrollWidth > el.clientWidth + 1);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [expanded, item.message]);

  const important = item.level === "important";
  const Icon = important ? TriangleAlert : Megaphone;

  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
        important
          ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
          : "border-brand-200 bg-brand-50 text-brand-950 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-100"
      }`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <span
          ref={line}
          className={expanded ? "whitespace-pre-wrap break-words" : "truncate"}
        >
          {item.message}
        </span>
        {(overflowing || expanded) && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="shrink-0 font-medium underline underline-offset-2"
            aria-expanded={expanded}
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss announcement"
        className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export default function AnnouncementBar({ items }: { items: Item[] }) {
  const supabase = createClient();
  const [gone, setGone] = useState<Set<string>>(new Set());

  const shown = items.filter((i) => !gone.has(i.id));
  if (!shown.length) return null;

  function dismiss(id: string) {
    setGone((g) => new Set(g).add(id));
    // remembered for this student, so it does not come back
    supabase.rpc("dismiss_announcement", { p_id: id }).then(() => {});
  }

  return (
    <div className="mb-6 space-y-2">
      {shown.map((i) => (
        <Row key={i.id} item={i} onDismiss={() => dismiss(i.id)} />
      ))}
    </div>
  );
}
