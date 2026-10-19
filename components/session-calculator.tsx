"use client";

// Floating calculator for the question screen. Typeset math input (MathLive) with a
// palette of functions; answers come from the Compute Engine (see lib/calc-eval.ts).
// The two libraries are loaded only when the calculator is first opened.

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Delete, X } from "lucide-react";
import type { MathfieldElement } from "mathlive";
import { evaluateLatex, type CalcResult, type Engine } from "@/lib/calc-eval";

type Action = (mf: MathfieldElement) => void;
type Key = { label: React.ReactNode; title: string; act: Action; tone?: "op" | "fn" };

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
}: {
  open: boolean;
  onClose: () => void;
}) {
  const inputHost = useRef<HTMLDivElement>(null);
  const resultHost = useRef<HTMLDivElement>(null);
  const mfRef = useRef<MathfieldElement | null>(null);
  const resultRef = useRef<MathfieldElement | null>(null);
  const engine = useRef<Engine | null>(null);
  const evalRef = useRef<() => void>(() => {});

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [last, setLast] = useState<string | null>(null); // last numeric answer, for "Ans"
  const [pos, setPos] = useState({ x: 16, y: 150 });
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  // Load the libraries once, the first time the window is shown.
  useEffect(() => {
    if (!open || mfRef.current) return;
    let disposed = false;
    (async () => {
      try {
        const [{ MathfieldElement }, { ComputeEngine }] = await Promise.all([
          import("mathlive"),
          import("@cortex-js/compute-engine"),
        ]);
        if (disposed || !inputHost.current || !resultHost.current) return;
        MathfieldElement.fontsDirectory = "/mathlive/fonts";
        MathfieldElement.soundsDirectory = null;
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

        const out = new MathfieldElement();
        out.readOnly = true;
        out.mathVirtualKeyboardPolicy = "manual";
        resultHost.current.appendChild(out);
        resultRef.current = out;

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
      resultRef.current?.remove();
      mfRef.current = null;
      resultRef.current = null;
    },
    []
  );

  function calculate() {
    const mf = mfRef.current;
    const ce = engine.current;
    if (!mf || !ce) return;
    const r = evaluateLatex(ce, mf.getValue("latex"));
    setResult(r);
    if (r.ok && r.kind === "number") setLast(r.text);
    if (resultRef.current) resultRef.current.value = r.ok && r.kind === "math" ? r.latex : "";
  }
  evalRef.current = calculate;

  const press = (act: Action) => {
    const mf = mfRef.current;
    if (mf) act(mf);
  };

  function clearAll() {
    const mf = mfRef.current;
    if (mf) {
      mf.setValue("");
      mf.focus();
    }
    setResult(null);
    if (resultRef.current) resultRef.current.value = "";
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

  const keypad: { label: React.ReactNode; act: Action; cls: string; span?: string; title: string }[] = [
    { label: "C", title: "Clear", act: () => clearAll(), cls: "bg-neutral-700 text-red-300 hover:bg-neutral-600" },
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
    { label: "=", title: "Work out the answer", act: () => calculate(), cls: "bg-indigo-600 text-white hover:bg-indigo-500 row-span-2 !h-auto" },

    { label: "0", title: "0", act: putAfter("0"), cls: "bg-neutral-800 hover:bg-neutral-700 col-span-2", span: "2" },
    { label: ".", title: "Decimal point", act: putAfter("."), cls: "bg-neutral-800 hover:bg-neutral-700" },
    { label: "+", title: "Add", act: putAfter("+"), cls: "bg-neutral-700 hover:bg-neutral-600" },
  ];

  return (
    <div
      role="dialog"
      aria-label="Calculator"
      data-no-shortcuts
      style={{ left: pos.x, top: pos.y, display: open ? undefined : "none" }}
      className="fixed z-[55] w-[26rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border border-neutral-700 bg-[#1b1e24] text-gray-100 shadow-2xl"
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

      <div className="px-3 pt-3">
        <div className="calc-field min-h-[3.25rem] rounded-md border border-neutral-700 bg-neutral-950 focus-within:border-indigo-500">
          <div ref={inputHost} />
          {!ready && !failed && (
            <p className="px-3 py-3 text-sm text-gray-500">Loading calculator…</p>
          )}
          {failed && (
            <p className="px-3 py-3 text-sm text-red-300">The calculator could not load. Reload the page.</p>
          )}
        </div>

        <div className="calc-field mt-2 min-h-[2.25rem] px-1 text-right" aria-live="polite">
          {result && result.ok && result.kind === "number" && (
            <p className="select-text px-2 text-2xl font-semibold tabular-nums text-indigo-200">= {result.text}</p>
          )}
          {result && result.ok && result.kind === "note" && (
            <p className="px-2 text-xl font-semibold text-indigo-200">{result.text}</p>
          )}
          {result && !result.ok && <p className="px-2 py-1 text-sm text-red-300">{result.message}</p>}
          <div
            ref={resultHost}
            className={result && result.ok && result.kind === "math" ? "" : "hidden"}
          />
        </div>
      </div>

      <div className="grid grid-cols-8 gap-1 px-3 pt-3">
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
