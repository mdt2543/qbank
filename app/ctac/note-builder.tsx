"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_OPTIONS, ROS, RUBRIC, SECTIONS, fhxGenerations, rosCount,
  type Options, type RubricItem, type Section,
} from "@/lib/ctac";
import { matchesReference, referencePiece, referenceRos } from "@/lib/ctac-drill";

type Texts = Record<Section, string>;
const EMPTY: Texts = { subjective: "", objective: "", assessment: "", plan: "", signoff: "" };
const STORE = "ctac-note-v2";

// What to practice: the whole note, or one part timed and graded on its own. The ROS lives in the
// Subjective box on the real note, so the Subjective drill grades the history without it and the
// ROS drill grades only the ROS.
type Mode = "full" | "subjective" | "ros" | "objective";
const MODES: { key: Mode; label: string; boxes: Section[]; boxLabel?: string }[] = [
  { key: "full", label: "Full note", boxes: SECTIONS.map((s) => s.key) },
  { key: "subjective", label: "Subjective", boxes: ["subjective"], boxLabel: "Subjective (without ROS)" },
  { key: "ros", label: "ROS", boxes: ["subjective"], boxLabel: "Subjective: ROS" },
  { key: "objective", label: "Objective", boxes: ["objective"] },
];
const REPS = 3;

type References = Record<"female" | "male", { name: string; texts: Record<Section, string> }>;

// one missed item to copy out three times against the reference
type DrillItem = {
  key: string;
  label: string;
  part: Section | "ros";
  reference: string | null;
  yours: string | null; // the matching piece of what you wrote, if any (for highlighting)
  state: State;
  needs: string[]; // what the checker looks for
  passes: (typed: string) => boolean;
};
// each item: copy it REPS times with the reference showing, then once from memory (recall)
type Drill = { items: DrillItem[]; idx: number; reps: number; recall: boolean; typed: string; feedback: string | null; refName: string; section: Section };
const modeOf = (m: Mode) => MODES.find((x) => x.key === m) ?? MODES[0];

// the ROS checker reads letter labels (H, E, E, N, T, N) only under an "ROS" heading
const asRos = (text: string) => (/^\s*(ROS|review of systems)\b/im.test(text) ? text : `ROS\n${text}`);

// the reference Subjective split at its ROS heading (the ROS runs to the end of the box)
const splitRos = (text: string) => {
  const at = text.search(/^\s*(ROS|review of systems)\b/im);
  return at < 0 ? { history: text.trim(), ros: "" } : { history: text.slice(0, at).trim(), ros: text.slice(at).trim() };
};

type State = "done" | "partial" | "missing";
type Result = { id: string; label: string; state: State; missing: string[]; hint?: string; auto: State };

function check(item: RubricItem, text: string): { state: State; missing: string[] } {
  if (item.id === "fhx") {
    const found = fhxGenerations(text);
    const missing = ["Siblings/children", "Parents", "Grandparents"].filter((g) => !found.includes(g));
    return { state: found.length >= 3 ? "done" : found.length ? "partial" : "missing", missing };
  }
  if (item.parts) {
    const found = item.parts.filter((p) => p.re.test(text));
    const missing = item.parts.filter((p) => !p.re.test(text)).map((p) => p.label);
    const need = item.min ?? item.parts.length;
    return { state: found.length >= need ? "done" : found.length ? "partial" : "missing", missing };
  }
  return { state: item.re?.test(text) ? "done" : "missing", missing: [] };
}

const countWords = (s: string) => (s.match(/\S+/g) ?? []).length;

function mmss(s: number) {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

const dot: Record<State, string> = { done: "bg-green-500", partial: "bg-amber-400", missing: "bg-red-500" };
const miss: Record<State, string> = { done: "", partial: "bg-amber-50 dark:bg-amber-950/30", missing: "bg-red-50 dark:bg-red-950/30" };

export default function NoteBuilder({ references }: { references: References }) {
  const [texts, setTexts] = useState<Texts>(EMPTY);
  const [opts, setOpts] = useState<Options>(DEFAULT_OPTIONS);
  const [overrides, setOverrides] = useState<Record<string, State>>({});
  const [startedAt, setStartedAt] = useState<number | null>(null); // first keystroke
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>("full");
  const cur = modeOf(mode);
  const boxes = SECTIONS.filter((s) => cur.boxes.includes(s.key));

  // stopwatch: runs from the first keystroke until Submit
  const [now, setNow] = useState(() => Date.now());

  const submitted = submittedAt !== null;

  // restore the draft (this browser only)
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) ?? "null");
      if (s) {
        if (s.texts) setTexts({ ...EMPTY, ...s.texts });
        if (s.opts) setOpts({ ...DEFAULT_OPTIONS, ...s.opts });
        if (typeof s.startedAt === "number") setStartedAt(s.startedAt);
        if (typeof s.submittedAt === "number") setSubmittedAt(s.submittedAt);
        if (MODES.some((m) => m.key === s.mode)) setMode(s.mode);
      }
    } catch { /* no saved draft */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORE, JSON.stringify({ texts, opts, startedAt, submittedAt, mode }));
    } catch { /* storage blocked: the page still works */ }
  }, [texts, opts, startedAt, submittedAt, mode, loaded]);

  const running = startedAt !== null && submittedAt === null;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [running]);
  const elapsed = startedAt === null ? 0 : Math.max(0, Math.floor(((submittedAt ?? now) - startedAt) / 1000));

  const submit = () => { setSubmittedAt(Date.now()); setConfirmSubmit(false); };
  const newNote = () => {
    setTexts(EMPTY); setOverrides({}); setStartedAt(null); setSubmittedAt(null);
  };
  // switching parts starts a fresh attempt
  const pickMode = (m: Mode) => {
    setMode(m);
    setTexts(EMPTY); setOverrides({}); setStartedAt(null); setSubmittedAt(null); setConfirmSubmit(false);
  };
  // mid-attempt, switching would throw away what's typed, so ask first
  const [pendingMode, setPendingMode] = useState<Mode | null>(null);
  const choose = (m: Mode) => {
    if (m === mode) { setPendingMode(null); return; }
    if (startedAt !== null && !submitted) setPendingMode(m);
    else pickMode(m);
  };

  // missed-item practice: each missed piece copied 3 times, then typed once from memory
  const [drill, setDrill] = useState<Drill | null>(null);
  const [practiced, setPracticed] = useState<{ at: number | null; sections: Section[] }>({ at: null, sections: [] });

  const results = useMemo(() => {
    const out: Record<Section, Result[]> = { subjective: [], objective: [], assessment: [], plan: [], signoff: [] };
    for (const item of RUBRIC) {
      if (item.show && !item.show(opts)) continue;
      const r = check(item, texts[item.section]);
      out[item.section].push({ id: item.id, label: item.label, missing: r.missing, auto: r.state, state: overrides[item.id] ?? r.state, hint: item.hint });
    }
    return out;
  }, [texts, opts, overrides]);

  const ros = useMemo(() => ROS.map((r) => {
    const n = rosCount(mode === "ros" ? asRos(texts.subjective) : texts.subjective, r.aliases);
    const auto: State = n >= 3 ? "done" : n > 0 ? "partial" : "missing";
    return { ...r, n, auto, state: overrides[`ros-${r.system}`] ?? auto };
  }), [texts.subjective, overrides, mode]);

  // what this attempt is graded on
  const gradedSections: Section[] = mode === "ros" ? [] : cur.boxes;
  const gradeRos = mode === "full" || mode === "ros";
  const all = [...gradedSections.flatMap((s) => results[s]), ...(gradeRos ? ros : [])];
  const doneCount = all.filter((r) => r.state === "done").length;
  const filled = boxes.filter((s) => texts[s.key].trim()).length;

  const words = boxes.reduce((n, s) => n + countWords(texts[s.key]), 0);
  const writeSecs = startedAt && submittedAt ? Math.max(1, (submittedAt - startedAt) / 1000) : 0;
  const wpm = writeSecs ? Math.round(words / (writeSecs / 60)) : 0;

  const toggle = (id: string, auto: State, current: State) => {
    setOverrides((o) => {
      const next = { ...o };
      if (id in o) delete next[id];
      else next[id] = current === "done" ? "missing" : "done";
      if (next[id] === auto) delete next[id];
      return next;
    });
  };

  // everything this attempt missed (an item you marked done yourself doesn't count)
  const ref = references[opts.sex];
  // only the vitals lines, without the "Vitals" heading; shown while the Objective box is on screen
  const vitals = boxes.some((b) => b.key === "objective")
    ? referencePiece("vitals", ref.texts.objective)?.replace(/^\s*vitals\s*:?\s*/i, "").trim() || null
    : null;
  // the reference text for a box, for the side-by-side view after submitting
  const refBox = (key: Section) =>
    key !== "subjective" || mode === "full" ? ref.texts[key].trim()
      : mode === "ros" ? splitRos(ref.texts.subjective).ros : splitRos(ref.texts.subjective).history;
  const missedItems: DrillItem[] = [
    ...gradedSections.flatMap((s) => results[s]).filter((r) => r.state !== "done").map((r): DrillItem => {
      const item = RUBRIC.find((i) => i.id === r.id)!;
      const reference = referencePiece(item.id, ref.texts[item.section]);
      return {
        key: item.id, label: item.label, part: item.section, reference, state: r.state,
        yours: referencePiece(item.id, texts[item.section]),
        needs: item.id === "fhx" ? ["Siblings/children", "Parents", "Grandparents"] : item.parts?.map((p) => p.label) ?? [],
        passes: (t) => check(item, t).state === "done" || matchesReference(t, reference),
      };
    }),
    ...(gradeRos ? ros : []).filter((r) => r.state !== "done").map((r): DrillItem => {
      const reference = referenceRos(ref.texts.subjective, r.aliases);
      return {
        key: `ros-${r.system}`, label: `ROS: ${r.system}`, part: "ros", reference, state: r.state,
        yours: referenceRos(texts.subjective, r.aliases),
        needs: ["3 symptoms on the line"],
        passes: (t) => rosCount(asRos(t), r.aliases) >= 3 || matchesReference(t, reference),
      };
    }),
  ];
  const missedIds = new Set(missedItems.map((m) => m.key));
  const boxOf = (m: DrillItem): Section => (m.part === "ros" ? "subjective" : m.part);
  const missedIn = (s: Section) => missedItems.filter((m) => boxOf(m) === s);
  const missedSections = SECTIONS.map((x) => x.key).filter((s) => missedIn(s).length > 0);
  // lines to shade in a box: the missed pieces of the reference, and the partly-right pieces you wrote
  const shade = (s: Section, side: "reference" | "yours") => {
    const out = new Map<string, State>();
    for (const m of missedIn(s)) {
      const piece = side === "reference" ? m.reference : m.state === "partial" ? m.yours : null;
      for (const l of piece?.split("\n") ?? []) if (l.trim()) out.set(l.trim(), m.state);
    }
    return out;
  };
  const lineBg: Record<State, string> = { done: "", partial: "bg-amber-200/60 dark:bg-amber-800/40", missing: "bg-red-200/70 dark:bg-red-900/50" };
  const shaded = (text: string, marks: Map<string, State>) =>
    text.split("\n").map((l, n) => (
      <div key={n} className={`min-h-[1.5em] rounded-sm px-0.5 ${lineBg[marks.get(l.trim()) ?? "done"]}`}>{l}</div>
    ));

  // each box's practice is done once per submitted attempt
  const isPracticed = (s: Section) => practiced.at === submittedAt && practiced.sections.includes(s);
  const startDrill = (s: Section) => {
    const items = missedIn(s);
    if (!items.length) return;
    setDrill({ items, idx: 0, reps: 0, recall: false, typed: "", feedback: null, refName: ref.name, section: s });
  };
  const checkRep = () => {
    if (!drill) return;
    const item = drill.items[drill.idx];
    if (!item.passes(drill.typed)) {
      // missing it from memory sends you back to copying it 3 more times
      if (drill.recall) {
        setDrill({ ...drill, recall: false, reps: 0, typed: "", feedback: "Not quite from memory. Copy it 3 more times, then try again without the reference." });
        return;
      }
      setDrill({ ...drill, feedback: item.reference ? "Not quite yet. Copy the reference above, everything in it." : "Not quite yet. Make sure it has everything listed above." });
      return;
    }
    if (!drill.recall) {
      const reps = drill.reps + 1;
      setDrill({ ...drill, reps, recall: reps >= REPS, typed: "", feedback: null });
      return;
    }
    if (drill.idx + 1 < drill.items.length) {
      setDrill({ ...drill, idx: drill.idx + 1, reps: 0, recall: false, typed: "", feedback: null });
      return;
    }
    setDrill(null);
    setPracticed((p) => ({ at: submittedAt, sections: [...(p.at === submittedAt ? p.sections : []), drill.section] }));
  };

  const chip = "rounded-full border px-2.5 py-1 text-xs transition";
  const on = "border-brand-600 bg-brand-600 text-white";
  const off = "border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800";

  return (
    <div className={submitted && !drill ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]" : "mx-auto max-w-3xl"}>
      {drill ? (() => {
        const item = drill.items[drill.idx];
        return (
          <div className="space-y-3 rounded-lg border border-gray-200 p-3 sm:p-4 dark:border-gray-800">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-medium">Practice what you missed</h2>
              <span className="text-sm tabular-nums text-gray-500 dark:text-gray-400">
                Item {drill.idx + 1} of {drill.items.length}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold">{item.label}</span>
              <span className="ml-auto flex gap-1" aria-label={`Copy ${drill.reps} of ${REPS} done`}>
                {Array.from({ length: REPS }, (_, i) => (
                  <span key={i} className={`h-2.5 w-8 rounded-full ${i < drill.reps ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"}`} />
                ))}
                <span title="From memory" className={`h-2.5 w-8 rounded-full ${drill.recall ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"}`} />
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {drill.recall
                ? <>Now type it once from memory, without the reference.</>
                : <>Type it {REPS} times while looking at the reference. Copy {drill.reps + 1} of {REPS}, then once from memory.</>}
              {item.needs.length > 0 && <> It needs: {item.needs.join(", ")}.</>}
            </p>
            {!drill.recall && <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Reference ({drill.refName})
              </div>
              {item.reference ? (
                <pre className="whitespace-pre-wrap rounded border border-brand-200 bg-brand-50 p-2 font-sans text-sm leading-relaxed dark:border-brand-900 dark:bg-brand-950/40">{item.reference}</pre>
              ) : (
                <p className="rounded border border-gray-200 p-2 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  The reference note doesn&apos;t have this part. Write it so it includes everything listed above.
                </p>
              )}
            </div>}
            <textarea
              key={`${drill.idx}-${drill.reps}-${drill.recall}`}
              autoFocus
              value={drill.typed}
              onChange={(e) => setDrill({ ...drill, typed: e.target.value, feedback: null })}
              onPaste={(e) => e.preventDefault()}
              onDrop={(e) => e.preventDefault()}
              rows={Math.max(3, (item.reference ?? "").split("\n").length + 1)}
              spellCheck
              autoComplete="off"
              className="w-full resize-y rounded border border-gray-300 bg-gray-50 p-2 text-sm leading-relaxed dark:border-gray-700 dark:bg-gray-900"
            />
            {drill.feedback && <p className="text-sm text-red-600">{drill.feedback}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setDrill(null)} className="rounded border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">Stop</button>
              <button onClick={checkRep} disabled={!drill.typed.trim()} className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
                Check
              </button>
            </div>
          </div>
        );
      })() : (
      <div className="min-w-0 space-y-3">
      {/* what to practice: picked before you start, or after you submit */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-sm text-gray-500 dark:text-gray-400">Practice:</span>
        {MODES.map((m) => (
          <button key={m.key} onClick={() => choose(m.key)} className={`${chip} ${mode === m.key ? on : off}`}>
            {m.label}
          </button>
        ))}
      </div>
      {pendingMode && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <span>Switch to {modeOf(pendingMode).label}? This clears what you&apos;ve typed.</span>
          <button onClick={() => setPendingMode(null)} className="ml-auto rounded border border-amber-400 px-3 py-1 dark:border-amber-700">Keep writing</button>
          <button onClick={() => { pickMode(pendingMode); setPendingMode(null); }} className="rounded bg-brand-600 px-3 py-1 text-white hover:bg-brand-700">Switch</button>
        </div>
      )}
      {/* the vitals are handed out with the encounter, so they stay in view; the rest is from memory */}
      {vitals && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm sm:px-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-1 font-medium">Vitals for this patient</div>
          <pre className="whitespace-pre-wrap font-sans text-gray-700 dark:text-gray-300">{vitals}</pre>
        </div>
      )}
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
        {/* stopwatch: not part of the note */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 sm:px-4 dark:border-gray-800 dark:bg-gray-900">
          <span className="font-mono text-2xl tabular-nums">{mmss(elapsed)}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {submitted ? "stopped at Submit" : running ? "running" : "starts when you begin typing"}
          </span>
        </div>

        {/* the note, laid out like LearningSpace */}
        <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 sm:px-4 dark:border-gray-800">
          <span className="font-medium">SOAP Note</span>
          <span className="text-sm tabular-nums text-gray-500 dark:text-gray-400">{filled} of {boxes.length}</span>
        </div>
        <div className="space-y-4 p-3 sm:p-4">
          {boxes.map(({ key, label }, i) => {
            const missedHere = submitted ? missedIn(key).length : 0;
            return (
            <div key={key}>
              <span className="mb-1 flex flex-wrap items-baseline gap-2 text-sm">
                <span>{i + 1}.&nbsp;&nbsp;{boxes.length === 1 && cur.boxLabel ? cur.boxLabel : label}</span>
                {missedHere > 0 && <span className="rounded bg-red-100 px-1.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">{missedHere} missed</span>}
                {missedHere > 0 && !isPracticed(key) && (
                  <button type="button" onClick={() => startDrill(key)} className="ml-auto rounded bg-brand-600 px-2.5 py-0.5 text-xs text-white hover:bg-brand-700">
                    Practice {missedHere === 1 ? "this item" : `these ${missedHere}`}
                  </button>
                )}
              </span>
              <div className={submitted ? "grid gap-x-3 gap-y-1 md:grid-cols-2" : ""}>
              {submitted && <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Yours</div>}
              {submitted && <div className="hidden text-xs font-semibold uppercase tracking-wide text-gray-500 md:block dark:text-gray-400">Reference ({ref.name})</div>}
              {submitted ? (
                <div className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded border border-gray-300 bg-gray-50 p-2 text-sm leading-relaxed dark:border-gray-700 dark:bg-gray-900">
                  {texts[key] ? shaded(texts[key], shade(key, "yours")) : <span className="text-gray-400">(empty)</span>}
                </div>
              ) : (
              <textarea
                aria-label={label}
                value={texts[key]}
                readOnly={submitted}
                onChange={(e) => {
                  if (startedAt === null) setStartedAt(Date.now());
                  setTexts((t) => ({ ...t, [key]: e.target.value }));
                }}
                // like the real note platform: pasting is allowed and the browser's spell check is on
                rows={key === "signoff" ? 2 : boxes.length === 1 ? 20 : key === "subjective" || key === "objective" ? 12 : 5}
                spellCheck
                autoComplete="off"
                className="w-full resize-y rounded border border-gray-300 bg-gray-50 p-2 text-sm leading-relaxed dark:border-gray-700 dark:bg-gray-900"
              />
              )}
              {submitted && (
                <>
                  <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden dark:text-gray-400">Reference ({ref.name})</div>
                  <div className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded border border-brand-200 bg-brand-50 p-2 text-sm leading-relaxed dark:border-brand-900 dark:bg-brand-950/40">{refBox(key) ? shaded(refBox(key), shade(key, "reference")) : "—"}</div>
                </>
              )}
              </div>
            </div>
            );
          })}

          <div className="flex justify-end gap-2">
            {submitted ? (
              <button onClick={newNote} className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">{mode === "full" ? "Start a new note" : `Try ${cur.label} again`}</button>
            ) : confirmSubmit ? (
              <>
                <span className="self-center text-sm">Submit this note?</span>
                <button onClick={() => setConfirmSubmit(false)} className="rounded border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">Cancel</button>
                <button onClick={submit} className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">Submit</button>
              </>
            ) : (
              <button onClick={() => setConfirmSubmit(true)} disabled={filled === 0} className="rounded bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
                Submit
              </button>
            )}
          </div>
        </div>
      </div>
      </div>
      )}

      {/* results: only after the note is submitted */}
      {submitted && !drill && (
        <aside className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <div className="grid grid-cols-3 gap-2 rounded-lg border border-gray-200 p-3 text-center dark:border-gray-800">
            <div>
              <div className="text-2xl font-semibold tabular-nums">{wpm}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">words per minute</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">{words}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">words</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">{mmss(writeSecs)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">writing time</div>
            </div>
            <p className="col-span-3 text-xs text-gray-500 dark:text-gray-400">Timed from your first keystroke to Submit.</p>
          </div>

          {/* next step: practice what was missed, or rewrite the next missed section */}
          {missedItems.length > 0 && (
            <div className="space-y-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/30">
              <p className="font-medium text-red-800 dark:text-red-200">
                {missedItems.length} {missedItems.length === 1 ? "item" : "items"} missed
              </p>
              <p className="text-red-900/80 dark:text-red-200/80">
                The missed lines are shaded in the reference next to your note. Practice each section on its own:
                retype just its missed items {REPS} times against the reference, then once from memory.
              </p>
              {missedSections.map((s) => {
                const label = s === "subjective" && mode !== "full" ? (cur.boxLabel ?? cur.label) : SECTIONS.find((x) => x.key === s)!.label;
                const items = missedIn(s);
                return isPracticed(s) ? (
                  <p key={s} className="rounded bg-green-100 px-3 py-2 text-green-800 dark:bg-green-950/40 dark:text-green-200">
                    {label}: practiced
                  </p>
                ) : (
                  <button key={s} onClick={() => startDrill(s)} className="w-full rounded bg-brand-600 px-3 py-2 text-left text-white hover:bg-brand-700">
                    <span className="font-medium">Practice {label}</span>
                    <span className="block text-xs text-white/80">{items.map((m) => m.label).join(", ")}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="space-y-4 rounded-lg border border-gray-200 p-3 text-sm sm:p-4 dark:border-gray-800">
            <div>
              <div className="flex items-baseline justify-between">
                <h2 className="font-medium">{mode === "full" ? "SOAP rubric" : `${cur.label} rubric`}</h2>
                <span className="tabular-nums text-gray-500 dark:text-gray-400">{doneCount}/{all.length}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Checked by word matching, so treat it as a hint. Tap an item to mark it yourself.
              </p>
            </div>

            <div className="space-y-2">
              {mode !== "ros" && (<>
              <p className="text-xs text-gray-500 dark:text-gray-400">Set these to match the encounter:</p>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => setOpts({ ...opts, visit: "well" })} className={`${chip} ${opts.visit === "well" ? on : off}`}>Well visit</button>
                <button onClick={() => setOpts({ ...opts, visit: "problem" })} className={`${chip} ${opts.visit === "problem" ? on : off}`}>Problem visit</button>
                <button onClick={() => setOpts({ ...opts, sex: "female" })} className={`${chip} ${opts.sex === "female" ? on : off}`}>Female</button>
                <button onClick={() => setOpts({ ...opts, sex: "male" })} className={`${chip} ${opts.sex === "male" ? on : off}`}>Male</button>
              </div>
              <div className="flex flex-wrap gap-1">
                {([["chronic", "Chronic condition"], ["breast", "Breast exam"], ["gi", "Abdominal exam"], ["gu", "GU exam"], ["neuro", "Neuro exam"]] as const)
                  .filter(([k]) => k !== "breast" || opts.sex === "female")
                  .map(([k, label]) => (
                    <button key={k} onClick={() => setOpts({ ...opts, [k]: !opts[k] })} className={`${chip} ${opts[k] ? on : off}`}>{label}</button>
                  ))}
              </div>
              </>)}
              <div className="flex gap-3 pt-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${dot.done}`} /> done</span>
                <span className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${dot.partial}`} /> partial</span>
                <span className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${dot.missing}`} /> missing</span>
              </div>
            </div>

            {boxes.map(({ key, label }) => (
              <div key={key}>
                {gradedSections.includes(key) && (<>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</h3>
                <ul className="space-y-1">
                  {results[key].map((r) => (
                    <li key={r.id}>
                      <button onClick={() => toggle(r.id, r.auto, r.state)} className={`flex w-full items-start gap-2 rounded px-1 py-0.5 text-left hover:bg-gray-100 dark:hover:bg-gray-800 ${missedIds.has(r.id) ? miss[r.state] : ""}`}>
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot[r.state]}`} />
                        <span className="min-w-0">
                          {r.label}
                          {r.id in overrides && <span className="text-xs text-gray-400"> (marked by you)</span>}
                          {r.state !== "done" && r.missing.length > 0 && (
                            <span className="block text-xs text-gray-500 dark:text-gray-400">Missing: {r.missing.join(", ")}</span>
                          )}
                          {r.state !== "done" && r.hint && <span className="block text-xs text-gray-500 dark:text-gray-400">{r.hint}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                </>)}
                {key === "subjective" && gradeRos && (
                  <>
                    <h3 className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">ROS (3 each)</h3>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                      {ros.map((r) => (
                        <button key={r.system} onClick={() => toggle(`ros-${r.system}`, r.auto, r.state)} className={`flex items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-gray-100 dark:hover:bg-gray-800 ${missedIds.has(`ros-${r.system}`) ? miss[r.state] : ""}`}>
                          <span className={`h-2 w-2 shrink-0 rounded-full ${dot[r.state]}`} />
                          <span className="truncate">{r.system}</span>
                          <span className="ml-auto text-xs tabular-nums text-gray-400">{r.n}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}
