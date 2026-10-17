"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type AdminAnnouncement = {
  id: string;
  message: string;
  level: string;
  active: boolean;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  dismissed_count: number | string;
};

// ISO time -> the value a datetime-local box expects (in the viewer's own time zone)
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function status(a: AdminAnnouncement) {
  if (!a.active) return { label: "Hidden", cls: "text-gray-500" };
  if (a.ends_at && new Date(a.ends_at) <= new Date()) return { label: "Expired", cls: "text-gray-500" };
  return { label: "Live", cls: "text-green-600 dark:text-green-400" };
}

export default function Announcements({ items }: { items: AdminAnnouncement[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState("info");
  const [endsAt, setEndsAt] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(opts: {
    message: string;
    level: string;
    endsAt: string | null;
    active: boolean;
    id: string | null;
  }) {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("admin_save_announcement", {
      p_message: opts.message,
      p_level: opts.level,
      p_ends_at: opts.endsAt ? new Date(opts.endsAt).toISOString() : null,
      p_active: opts.active,
      p_id: opts.id,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return false;
    }
    router.refresh();
    return true;
  }

  async function submit() {
    const ok = await save({ message, level, endsAt: endsAt || null, active: true, id: editingId });
    if (ok) reset();
  }

  function reset() {
    setMessage("");
    setLevel("info");
    setEndsAt("");
    setEditingId(null);
  }

  function edit(a: AdminAnnouncement) {
    setEditingId(a.id);
    setMessage(a.message);
    setLevel(a.level);
    setEndsAt(toLocalInput(a.ends_at));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggle(a: AdminAnnouncement) {
    await save({
      message: a.message,
      level: a.level,
      endsAt: toLocalInput(a.ends_at) || null,
      active: !a.active,
      id: a.id,
    });
  }

  async function remove(a: AdminAnnouncement) {
    if (!window.confirm("Delete this announcement? This cannot be undone.")) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("admin_delete_announcement", { p_id: a.id });
    setBusy(false);
    if (error) return setError(error.message);
    if (editingId === a.id) reset();
    router.refresh();
  }

  const field =
    "rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-700";

  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <p className="text-sm font-medium">{editingId ? "Edit announcement" : "New announcement"}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Shown at the top of the landing page. Students see the first line with a &quot;Show more&quot;
          link, so lead with one clear sentence. Plain text only.
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="e.g. Case 9 question banks are now available."
          className={`mt-3 w-full ${field}`}
        />
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-gray-500 dark:text-gray-400">
            Style
            <select value={level} onChange={(e) => setLevel(e.target.value)} className={`mt-1 block ${field}`}>
              <option value="info">Notice (blue)</option>
              <option value="important">Important (amber)</option>
            </select>
          </label>
          <label className="text-xs text-gray-500 dark:text-gray-400">
            Stop showing on (optional)
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className={`mt-1 block ${field}`}
            />
          </label>
          <div className="ml-auto flex gap-2">
            {editingId && (
              <button onClick={reset} className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">
                Cancel
              </button>
            )}
            <button
              onClick={submit}
              disabled={busy || !message.trim()}
              className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-black"
            >
              {busy ? "Saving…" : editingId ? "Save changes" : "Post announcement"}
            </button>
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {items.map((a) => {
        const st = status(a);
        return (
          <div key={a.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
              <span className={`font-medium ${st.cls}`}>
                {st.label}
                <span className="font-normal text-gray-500 dark:text-gray-400">
                  {" "}
                  · {a.level === "important" ? "Important" : "Notice"}
                  {a.ends_at && ` · until ${new Date(a.ends_at).toLocaleString()}`}
                  {` · dismissed by ${a.dismissed_count}`}
                </span>
              </span>
              <span className="flex gap-3">
                <button onClick={() => edit(a)} className="underline">Edit</button>
                <button onClick={() => toggle(a)} disabled={busy} className="underline">
                  {a.active ? "Hide" : "Show"}
                </button>
                <button onClick={() => remove(a)} disabled={busy} className="text-red-600 underline dark:text-red-400">
                  Delete
                </button>
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{a.message}</p>
          </div>
        );
      })}
      {items.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">No announcements yet.</p>
      )}
    </div>
  );
}
