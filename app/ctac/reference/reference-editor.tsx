"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SECTIONS } from "@/lib/ctac";
import type { NoteTexts } from "@/lib/ctac-reference";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function ReferenceEditor({
  noteId, starting, initial, savedAt: firstSavedAt, tableMissing,
}: { noteId: string; starting: NoteTexts; initial: NoteTexts; savedAt: string | null; tableMissing: boolean }) {
  const [texts, setTexts] = useState<NoteTexts>(initial);
  const [saved, setSaved] = useState<NoteTexts>(initial);
  const [savedAt, setSavedAt] = useState<string | null>(firstSavedAt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = SECTIONS.some((s) => texts[s.key] !== saved[s.key]);
  const isDefault = SECTIONS.every((s) => texts[s.key] === starting[s.key]);

  // warn before leaving with unsaved edits
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("admin_save_ctac_reference", {
      p_id: noteId,
      p_subjective: texts.subjective,
      p_objective: texts.objective,
      p_assessment: texts.assessment,
      p_plan: texts.plan,
      p_signoff: texts.signoff,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSaved(texts);
    setSavedAt(typeof data === "string" ? data : new Date().toISOString());
  }

  const status = error
    ? `Not saved: ${error}`
    : dirty
      ? "Unsaved changes"
      : savedAt
        ? `Saved ${fmt(savedAt)}`
        : "Starting version, not saved yet";

  return (
    <div className="space-y-4">
      {tableMissing && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Saving isn&apos;t set up yet (migration 040 hasn&apos;t been run). You can edit, but Save will fail until it is.
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 sm:px-4 dark:border-gray-800">
          <span className="font-medium">SOAP Note</span>
          <span className={`text-sm ${error ? "text-red-600" : dirty ? "text-amber-600" : "text-gray-500 dark:text-gray-400"}`}>{status}</span>
        </div>
        <div className="space-y-4 p-3 sm:p-4">
          {SECTIONS.map(({ key, label }, i) => (
            <label key={key} className="block">
              <span className="mb-1 block text-sm">{i + 1}.&nbsp;&nbsp;{label}</span>
              <textarea
                value={texts[key]}
                onChange={(e) => setTexts((t) => ({ ...t, [key]: e.target.value }))}
                rows={key === "signoff" ? 2 : Math.min(40, Math.max(4, texts[key].split("\n").length + 1))}
                className="w-full resize-y rounded border border-gray-300 bg-gray-50 p-2 text-sm leading-relaxed dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {!isDefault && (
          <button
            onClick={() => setTexts(starting)}
            className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            title="Puts the starting wording back in the boxes; nothing changes until you save"
          >
            Restore starting version
          </button>
        )}
        {dirty && (
          <button
            onClick={() => setTexts(saved)}
            className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Undo changes
          </button>
        )}
        <button
          onClick={save}
          disabled={saving || (!dirty && !!savedAt)}
          className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
