"use client";

// Floating calculator for the question screen. Typeset math input (MathLive) with a
// palette of functions; answers come from the Compute Engine (see lib/calc-eval.ts).
// Pressing "=" moves the calculation into a history list and clears the entry box.
// The two libraries are loaded only when the calculator is first opened.

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Delete, X } from "lucide-react";
import type { MathfieldElement } from "mathlive";
import { evaluateLatex, type Engine } from "@/lib/calc-eval";

type Action = (mf: MathfieldElement) => void;
type Key = { label: React.ReactNode; title: string; act: Action };

// one finished calculation: what was typed, and its answer
type Entry = { latex: string; kind: "number" | "math" | "note"; value: string };
const MAX_HISTORY = 50;

// Load MathLive once, and point it at the fonts we serve ourselves.
let mathlive: Promise<typeof import("mathlive")> | null = null;
function loadMathlive() {
  if (!mathlive) {
    mathlive = import("mathlive").then((m) => {
      m.MathfieldElement.fontsDirectory = "/mathlive/fonts";
      m.MathfieldElement.soundsDirectory = null;
      return m;
    });
  }
  return mathlive;
}

/** typeset math that cannot be edited (used in the history) */
function Typeset({ latex }: { latex: string }) {
  const host = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let gone = false;
    let el: MathfieldElement | undefined;
    loadMathlive().then(({ MathfieldElement }) => {
      if (gone || !host.current) return;
      el = new MathfieldElement();
      el.readOnly = true;
      el.mathVirtualKeyboardPolicy = "manual";
      el.value = latex;
      host.current.appendChild(el);
    });
    return () => {
      gone = true;
      el?.remove();
    };
  }, [latex]);
  return <span ref={host} className="calc-field calc-hist block" />;
}

const storageName = (key: string) => `qbank-calc:${key}`;

function readHistory(key?: string): Entry[] {
  if (!key || typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(storageName(key)) ?? "[]");
    return Array.isArray(raw) ? (raw as Entry[]).slice(-MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

const put =
  (latex: string): Action =>
  (mf) => {
    mf.insert(latex, { format: "latex", selectionMode: "placeholder", focus: true });
  };
const putAfter =
  (latex: string): Action =>
  (mf) => {
    mf.insert(latex, { format: "latex", selectionMode: "after", focus: true });
  };
const run =
  (cmd: string): Action =>
  (mf) => {
    mf.executeCommand(cmd as never);
    mf.focus();
  };

const sub = (s: string) => <sub className="text-[0.65em]">{s}</sub>;
const sup = (s: string) => <sup className="text-[0.65em]">{s}</sup>;

// the function palette: four rows of eight
const FUNCTIONS: Key[] = [
  { label: <>x{sup("2")}</>, title: "Square", act: put("#@^{2}") },
  { label: <>x{sup("n")}</>, title: "Power", act: put("#@^{#?}") },
  { label: <>log{sub("□")}</>, title: "Logarithm with a base", act: put("\\log_{#?}\\left(#?\\right)") },
  { label: "√□", title: "Square root", act: put("\\sqrt{#?}") },
  { label: <>{sup("n")}√□</>, title: "Nth root", act: put("\\sqrt[#?]{#?}") },
  { label: "π", title: "Pi", act: putAfter("\\pi") },
  { label: "≤", title: "Less than or equal", act: putAfter("\\le") },
  { label: "≥", title: "Greater than or equal", act: putAfter("\\ge") },

  { label: "□⁄□", title: "Fraction", act: put("\\frac{#?}{#?}") },
  { label: "·", title: "Multiply", act: putAfter("\\cdot") },
  { label: "÷", title: "Divide", act: putAfter("\\div") },
  { label: <>x{sup("°")}</>, title: "Degrees", act: putAfter("\\degree") },
  { label: "(□)′", title: "Derivative", act: put("\\left(#?\\right)^{\\prime}") },
  { label: "d/dx", title: "Derivative with respect to x", act: put("\\frac{\\mathrm{d}}{\\mathrm{d}x}\\left(#?\\right)") },
  { label: "∂/∂x", title: "Partial derivative", act: put("\\frac{\\partial}{\\partial x}\\left(#?\\right)") },
  { label: "∞", title: "Infinity", act: putAfter("\\infty") },

  { label: "∫", title: "Integral", act: put("\\int #?\\,\\mathrm{d}x") },
  { label: <>∫{sub("a")}{sup("b")}</>, title: "Definite integral", act: put("\\int_{#?}^{#?}#?\\,\\mathrm{d}x") },
  { label: "lim", title: "Limit", act: put("\\lim_{x\\to #?}#?") },
  { label: "Σ", title: "Sum", act: put("\\sum_{n=#?}^{#?}#?") },
  { label: "θ", title: "Theta", act: putAfter("\\theta") },
  { label: "f(x)", title: "Function (define it with f(x)=…)", act: put("f\\left(#?\\right)") },
  { label: "(f∘g)", title: "Composition", act: put("\\left(f\\circ g\\right)\\left(#?\\right)") },
  { label: "▦", title: "2 × 2 matrix", act: put("\\begin{pmatrix}#?&#?\\\\#?&#?\\end{pmatrix}") },

  { label: "sin", title: "Sine (use ° for degrees)", act: put("\\sin\\left(#?\\right)") },
  { label: "cos", title: "Cosine", act: put("\\cos\\left(#?\\right)") },
  { label: "tan", title: "Tangent", act: put("\\tan\\left(#?\\right)") },
  { label: "ln", title: "Natural log", act: put("\\ln\\left(#?\\right)") },
  { label: "det", title: "Determinant of a 2 × 2 matrix", act: put("\\det\\begin{pmatrix}#?&#?\\\\#?&#?\\end{pmatrix}") },
  { label: "|x|", title: "Absolute value", act: put("\\left|#?\\right|") },
  { label: "n!", title: "Factorial", act: putAfter("!") },
  { label: "%", title: "Percent", act: putAfter("\\%") },
];

export default function SessionCalculator({
  open,
  onClose,
  storageKey,
}: {
  open: boolean;
  onClose: () => void;
  /** keeps the history on this device for the session, e.g. the attempt id */
  storageKey?: string;
}) {
  const inputHost = useRef<HTMLDivElement>(null);
  const mfRef = useRef<MathfieldElement | null>(null);
  const engine = useRef<Engine | null>(null);
  const evalRef = useRef<() => void>(() => {});
  const tape = useRef<HTMLDivElement>(null);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [last, setLast] = useState<string | null>(null); // last numeric answer, for "Ans"
  const [pos, setPos] = useState({ x: 16, y: 100 });
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  // bring back this session's history once the page is up (not while rendering, so the
  // server and browser versions of the page always match)
  useEffect(() => {
    const prev = readHistory(storageKey);
    setHistory(prev);
    const lastNumber = [...prev].reverse().find((e) => e.kind === "number");
    setLast(lastNumber ? lastNumber.value : null);
    setHydrated(true);
  }, [storageKey]);

  // keep the history for the session
  useEffect(() => {
    if (!storageKey || !hydrated) return;
    try {
      localStorage.setItem(storageName(storageKey), JSON.stringify(history));
    } catch {}
  }, [history, hydrated, storageKey]);

  // newest calculation in view
  useEffect(() => {
    const el = tape.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history.length]);

  // Load the libraries once, the first time the window is shown.
  useEffect(() => {
    if (!open || mfRef.current) return;
    let disposed = false;
    (async () => {
      try {
        const [{ MathfieldElement }, { ComputeEngine }] = await Promise.all([
          loadMathlive(),
          import("@cortex-js/compute-engine"),
        ]);
        if (disposed || !inputHost.current) return;
        engine.current = new ComputeEngine() as unknown as Engine;

        const mf = new MathfieldElement();
        mf.mathVirtualKeyboardPolicy = "manual";
        mf.setAttribute("aria-label", "Calculator input");
        // Enter works the answer out instead of doing anything else
        mf.addEventListener(
          "keydown",
          (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              evalRef.current();
            }
          },
          true
        );
        inputHost.current.appendChild(mf);
        mfRef.current = mf;

        setReady(true);
        mf.focus();
      } catch {
        if (!disposed) setFailed(true);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [open]);

  // tidy up when the whole screen goes away
  useEffect(
    () => () => {
      mfRef.current?.remove();
      mfRef.current = null;
    },
    []
  );

  // "=": a good answer goes to the history and the box is cleared; a problem stays in the
  // box (with a message) so it can be fixed
  function calculate() {
    const mf = mfRef.current;
    const ce = engine.current;
    if (!mf || !ce) return;
    const latex = mf.getValue("latex");
    const r = evaluateLatex(ce, latex);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setError(null);
    const entry: Entry =
      r.kind === "math"
        ? { latex, kind: "math", value: r.latex }
        : { latex, kind: r.kind, value: r.text };
    setHistory((h) => [...h, entry].slice(-MAX_HISTORY));
    if (r.kind === "number") setLast(r.text);
    mf.setValue("");
    mf.focus();
  }
  evalRef.current = calculate;

  const press = (act: Action) => {
    const mf = mfRef.current;
    if (mf) act(mf);
  };

  function clearEntry() {
    const mf = mfRef.current;
    if (mf) {
      mf.setValue("");
      mf.focus();
    }
    setError(null);
  }

  // put a past calculation back in the box to change it
  function reuse(e: Entry) {
    const mf = mfRef.current;
    if (!mf) return;
    mf.setValue(e.latex);
    mf.executeCommand("moveToMathfieldEnd" as never);
    mf.focus();
    setError(null);
  }

  // drop a past answer into the box
  function insertAnswer(e: Entry) {
    const mf = mfRef.current;
    if (!mf || e.kind === "note") return;
    mf.insert(e.value, { format: "latex", selectionMode: "after", focus: true });
  }

  // dragging the window by its title bar
  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const maxX = Math.max(0, window.innerWidth - 120);
    const maxY = Math.max(0, window.innerHeight - 60);
    setPos({
      x: Math.min(maxX, Math.max(-200, e.clientX - drag.current.dx)),
      y: Math.min(maxY, Math.max(0, e.clientY - drag.current.dy)),
    });
  }
  function onUp() {
    drag.current = null;
  }

  const btn =
    "flex h-9 items-center justify-center rounded text-sm font-medium transition-colors select-none";
  const keep = (e: React.MouseEvent) => e.preventDefault(); // keep the cursor in the input

  const keypad: { label: React.ReactNode; act: Action; cls: string; title: string }[] = [
    { label: "C", title: "Clear the entry", act: () => clearEntry(), cls: "bg-neutral-700 text-red-300 hover:bg-neutral-600" },
    { label: <Delete size={16} />, title: "Backspace", act: run("deleteBackward"), cls: "bg-neutral-700 hover:bg-neutral-600" },
    { label: "(", title: "Open bracket", act: putAfter("("), cls: "bg-neutral-700 hover:bg-neutral-600" },
    { label: ")", title: "Close bracket", act: putAfter(")"), cls: "bg-neutral-700 hover:bg-neutral-600" },
    {
      label: "Ans",
      title: "Insert the last answer",
      act: (mf) => last && mf.insert(last, { format: "latex", selectionMode: "after", focus: true }),
      cls: "bg-neutral-700 hover:bg-neutral-600",
    },

    ...["7", "8", "9"].map((d) => ({ label: d, title: d, act: putAfter(d), cls: "bg-neutral-800 hover:bg-neutral-700" })),
    { label: "÷", title: "Divide", act: putAfter("\\div"), cls: "bg-neutral-700 hover:bg-neutral-600" },
    { label: <ChevronLeft size={16} />, title: "Move left", act: run("moveToPreviousChar"), cls: "bg-neutral-700 hover:bg-neutral-600" },

    ...["4", "5", "6"].map((d) => ({ label: d, title: d, act: putAfter(d), cls: "bg-neutral-800 hover:bg-neutral-700" })),
    { label: "×", title: "Multiply", act: putAfter("\\times"), cls: "bg-neutral-700 hover:bg-neutral-600" },
    { label: <ChevronRight size={16} />, title: "Move right", act: run("moveToNextChar"), cls: "bg-neutral-700 hover:bg-neutral-600" },

    ...["1", "2", "3"].map((d) => ({ label: d, title: d, act: putAfter(d), cls: "bg-neutral-800 hover:bg-neutral-700" })),
    { label: "−", title: "Subtract", act: putAfter("-"), cls: "bg-neutral-700 hover:bg-neutral-600" },
    { label: "=", title: "Work out the answer", act: () => calculate(), cls: "bg-brand-600 text-white hover:bg-brand-500 row-span-2 !h-auto" },

    { label: "0", title: "0", act: putAfter("0"), cls: "bg-neutral-800 hover:bg-neutral-700 col-span-2" },
    { label: ".", title: "Decimal point", act: putAfter("."), cls: "bg-neutral-800 hover:bg-neutral-700" },
    { label: "+", title: "Add", act: putAfter("+"), cls: "bg-neutral-700 hover:bg-neutral-600" },
  ];

  return (
    <div
      role="dialog"
      aria-label="Calculator"
      data-no-shortcuts
      style={{
        left: pos.x,
        top: pos.y,
        // never taller than the space left on screen; scrolls inside if it has to
        maxHeight: `calc(100vh - ${pos.y}px - 0.5rem)`,
        display: open ? undefined : "none",
      }}
      className="fixed z-[55] w-[26rem] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-neutral-700 bg-[#1b1e24] text-gray-100 shadow-2xl"
    >
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        className="flex cursor-grab touch-none items-center justify-between bg-neutral-900 px-3 py-2 active:cursor-grabbing"
      >
        <span className="text-sm font-semibold">Calculator</span>
        <button
          onClick={onClose}
          aria-label="Close calculator"
          className="rounded p-1 text-gray-400 hover:bg-neutral-800 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      {history.length > 0 && (
        <div className="border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center justify-between px-3 pt-2 text-xs text-gray-500">
            <span>History</span>
            <button
              onClick={() => setHistory([])}
              className="underline hover:text-gray-300"
              title="Remove everything from the history"
            >
              Clear history
            </button>
          </div>
          <div ref={tape} className="max-h-32 space-y-1 overflow-y-auto px-3 pb-2 pt-1">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <button
                  onMouseDown={keep}
                  onClick={() => reuse(h)}
                  title="Put this back in the entry box"
                  className="min-w-0 flex-1 overflow-x-auto rounded px-1 text-left hover:bg-neutral-800"
                >
                  <Typeset latex={h.latex} />
                </button>
                {h.kind === "note" ? (
                  <span className="shrink-0 text-sm font-semibold text-brand-200">{h.value}</span>
                ) : (
                  <button
                    onMouseDown={keep}
                    onClick={() => insertAnswer(h)}
                    title="Use this answer"
                    className="flex shrink-0 items-center gap-1 rounded px-1 text-sm font-semibold tabular-nums text-brand-200 hover:bg-neutral-800"
                  >
                    <span>=</span>
                    {h.kind === "number" ? <span>{h.value}</span> : <Typeset latex={h.value} />}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-3 pt-3">
        <div className="calc-field min-h-[3.25rem] rounded-md border border-neutral-700 bg-neutral-950 focus-within:border-brand-500">
          <div ref={inputHost} />
          {!ready && !failed && (
            <p className="px-3 py-3 text-sm text-gray-500">Loading calculator…</p>
          )}
          {failed && (
            <p className="px-3 py-3 text-sm text-red-300">The calculator could not load. Reload the page.</p>
          )}
        </div>
        <div className="min-h-[1.5rem] px-1 pt-1 text-right" aria-live="polite">
          {error && <p className="text-sm text-red-300">{error}</p>}
        </div>
      </div>

      <div className="grid grid-cols-8 gap-1 px-3 pt-1">
        {FUNCTIONS.map((k, i) => (
          <button
            key={i}
            type="button"
            title={k.title}
            onMouseDown={keep}
            onClick={() => press(k.act)}
            disabled={!ready}
            className={`${btn} bg-neutral-800 text-[0.8rem] text-gray-100 hover:bg-neutral-700 disabled:opacity-40`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-1 p-3">
        {keypad.map((k, i) => (
          <button
            key={i}
            type="button"
            title={k.title}
            onMouseDown={keep}
            onClick={() => press(k.act)}
            disabled={!ready}
            className={`${btn} ${k.cls} disabled:opacity-40`}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}
