"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// "Class average 74%". The number is only sent to students who have jump scare mode on; for
// everyone else `pct` is null and this shows an italic, underlined "hidden". Clicking it asks
// whether to turn jump scare mode on so the average can be shown.
export default function ClassAverage({
  pct,
  prefix = "Class average",
  className = "",
  onEnabled,
}: {
  pct: number | null;
  prefix?: string;
  className?: string;
  onEnabled?: () => void;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enable() {
    setBusy(true);
    setError(null);
    const { error: err } = await createClient().rpc("set_jumpscares", { p_enabled: true });
    setBusy(false);
    if (err) return setError(err.message);
    setAsking(false);
    if (onEnabled) onEnabled();
    else router.refresh();
  }

  return (
    <p className={className}>
      {prefix}{" "}
      {pct !== null ? (
        <>{pct}%</>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            // this can sit inside a dropdown header: don't open or close it
            e.preventDefault();
            e.stopPropagation();
            setAsking(true);
          }}
          className="italic underline underline-offset-2"
        >
          hidden
        </button>
      )}
      {asking &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
            onClick={() => !busy && setAsking(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-xl bg-white p-6 text-left text-black shadow-xl dark:bg-neutral-900 dark:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold">Enable jump scare mode to view the class average?</h2>
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                The class average is only shown to students who have jump scare mode turned on. With it on,
                a loud, sudden image and sound can very rarely appear while you study in tutor mode. It never
                happens in exam modes, and not if your device is set to reduce motion. You can turn it off any
                time on your Profile page.
              </p>
              {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAsking(false)}
                  disabled={busy}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700"
                >
                  Not now
                </button>
                <button
                  type="button"
                  onClick={enable}
                  disabled={busy}
                  className="rounded-lg bg-brand-700 px-4 py-2 text-sm text-white hover:bg-brand-600 disabled:opacity-40"
                >
                  {busy ? "Enabling…" : "Enable and show"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </p>
  );
}
