"use client";

import { useEffect, useState } from "react";
import { Folder, FolderOpen } from "lucide-react";
import BankList, { type Bank } from "@/components/bank-card";

export type PickerSub = { key: string; title: string; banks: Bank[] };

// "Case 11 - Gait MM Lab Practice Questions" -> "Gait MM Lab" inside the Case 11 tile
function shortTitle(title: string) {
  return title.replace(/^Case \d+ - /, "").replace(/ Practice Questions$/, "");
}

// A grid of small subfolder tiles (Case 1 ... Case 16, Exam 1 ... Exam 6) with the chosen one's
// banks listed underneath, so many subfolders fit on one screen. Opens on the newest subfolder;
// the student's last choice is remembered on this device.
export default function FolderPicker({
  storageKey,
  subs,
}: {
  storageKey: string;
  subs: PickerSub[];
}) {
  const newest = subs[subs.length - 1]?.key ?? "";
  const [open, setOpen] = useState(newest);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && subs.some((s) => s.key === saved)) setOpen(saved);
    } catch {
      // storage blocked: stay on the newest
    }
  }, [storageKey, subs]);

  const choose = (key: string) => {
    setOpen(key);
    try {
      localStorage.setItem(storageKey, key);
    } catch {
      // storage blocked: the choice just isn't remembered
    }
  };

  const current = subs.find((s) => s.key === open) ?? subs[subs.length - 1];
  if (!current) return null;
  const isCase = current.key.startsWith("case-");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {subs.map((s) => {
          const on = s.key === current.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => choose(s.key)}
              aria-pressed={on}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-3 py-1.5 text-sm transition-colors ${
                on
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-950"
                  : "border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
              }`}
            >
              {on ? (
                <FolderOpen size={14} className="shrink-0 text-brand-500" />
              ) : (
                <Folder size={14} className="shrink-0 text-brand-500" />
              )}
              <span className="font-medium">{s.title}</span>
              <span className="text-gray-500 dark:text-gray-400">
                {" "}
                – {s.banks.length} bank{s.banks.length === 1 ? "" : "s"}
              </span>
            </button>
          );
        })}
      </div>
      <BankList banks={current.banks} label={isCase ? (qb) => shortTitle(qb.title) : undefined} />
    </div>
  );
}
