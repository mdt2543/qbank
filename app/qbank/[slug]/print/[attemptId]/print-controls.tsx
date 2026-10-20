"use client";

import { useEffect } from "react";

// Print button (hidden on paper). With ?auto=1 it opens the print dialog by itself,
// once the pictures have loaded.
export default function PrintControls({ auto }: { auto: boolean }) {
  useEffect(() => {
    if (!auto) return;
    let cancelled = false;
    const pending = [...document.images].map((img) =>
      img.complete
        ? null
        : new Promise<void>((done) => {
            img.addEventListener("load", () => done());
            img.addEventListener("error", () => done());
          })
    );
    Promise.all(pending).then(() => {
      if (!cancelled) setTimeout(() => window.print(), 300);
    });
    return () => {
      cancelled = true;
    };
  }, [auto]);

  return (
    <div className="mx-auto mt-6 flex max-w-3xl items-center justify-between gap-3 px-2 print:hidden">
      <p className="text-sm text-gray-400">Choose &quot;Save as PDF&quot; in the print window to keep a copy.</p>
      <button
        onClick={() => window.print()}
        className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-200"
      >
        Print / Save as PDF
      </button>
    </div>
  );
}
