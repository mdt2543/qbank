"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AnimalIcon, { ANIMALS, DEFAULT_ANIMAL, animalLabel, type AnimalKey } from "@/components/animal-icon";

// Shown once on the leaderboard to students with no profile picture who have never picked an
// animal. Any answer is saved (closing it keeps the platypus), so it does not come back.
export default function AnimalPrompt() {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [pick, setPick] = useState<AnimalKey>(DEFAULT_ANIMAL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(animal: AnimalKey) {
    setBusy(true);
    setError(null);
    const { error: e } = await createClient().rpc("save_avatar_animal", { p_animal: animal });
    setBusy(false);
    if (e) return setError("That didn't save. Please try again.");
    setOpen(false);
    router.refresh();
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) save(DEFAULT_ANIMAL);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy]);

  if (!open) return null;
  const isDefault = pick === DEFAULT_ANIMAL;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="animal-title"
        className="relative max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-950"
      >
        <button
          onClick={() => save(DEFAULT_ANIMAL)}
          disabled={busy}
          className="absolute right-3 top-3 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-900 dark:hover:text-gray-200"
          aria-label="Close and keep the platypus"
        >
          <X size={18} />
        </button>

        <div className="bg-gradient-to-b from-brand-50 to-transparent px-6 pb-2 pt-7 text-center dark:from-brand-950">
          <div className="mx-auto w-fit rounded-full ring-4 ring-white shadow-md dark:ring-gray-950">
            <AnimalIcon animal={pick} size={88} />
          </div>
          <h2 id="animal-title" className="mt-4 text-lg font-semibold">
            Pick your leaderboard animal
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            You don&apos;t have a profile picture yet, so on the leaderboard you&apos;re a{" "}
            <span className="font-medium text-gray-900 dark:text-gray-100">platypus</span>. You&apos;ll
            stay a platypus unless you pick a different animal or upload a profile picture.
          </p>
        </div>

        <div className="grid grid-cols-5 gap-1.5 px-4 py-4 sm:gap-2 sm:px-6">
          {ANIMALS.map((a) => {
            const on = a.key === pick;
            return (
              <button
                key={a.key}
                type="button"
                onClick={() => setPick(a.key)}
                aria-pressed={on}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] transition-colors sm:text-xs ${
                  on
                    ? "border-brand-500 bg-brand-50 font-medium text-brand-900 dark:bg-brand-950 dark:text-brand-100"
                    : "border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
                }`}
              >
                <AnimalIcon animal={a.key} size={44} />
                {a.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-2 border-t border-gray-200 px-6 py-4 dark:border-gray-800">
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            onClick={() => save(pick)}
            disabled={busy}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? "Saving…" : isDefault ? "Keep the platypus" : `Be the ${animalLabel(pick).toLowerCase()}`}
          </button>
          {!isDefault && (
            <button
              onClick={() => save(DEFAULT_ANIMAL)}
              disabled={busy}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              Keep the platypus
            </button>
          )}
          <p className="pt-1 text-center text-xs text-gray-500 dark:text-gray-400">
            Rather use a photo?{" "}
            <Link href="/profile" className="font-medium text-brand-600 underline dark:text-brand-300">
              Upload a profile picture
            </Link>
            . You can change your animal on your{" "}
            <Link href="/profile" className="font-medium text-brand-600 underline dark:text-brand-300">
              Profile
            </Link>{" "}
            anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
