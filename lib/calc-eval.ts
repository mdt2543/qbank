// Turns what a student typed into the calculator (LaTeX from the math field) into an
// answer, using the Compute Engine. Kept free of any browser code so it can be tested alone.

export type CalcResult =
  | { ok: true; kind: "number"; text: string } // plain, copyable: "2.513043478"
  | { ok: true; kind: "math"; latex: string } // symbolic, shown typeset: "3x^2"
  | { ok: true; kind: "note"; text: string } // "True", "f(x) defined", "∞"
  | { ok: false; message: string };

// The slice of the Compute Engine this file uses.
type Boxed = {
  json: unknown;
  latex: string;
  isValid?: boolean;
  re?: number;
  im?: number;
  evaluate: () => Boxed;
  N: () => Boxed;
};
export type Engine = { parse: (latex: string) => Boxed };

/** the matching ")" for the "(" at `open`, or -1 */
function closeOf(s: string, open: number) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")" && --depth === 0) return i;
  }
  return -1;
}

/** the matching "(" for the ")" at `close`, or -1 */
function openOf(s: string, close: number) {
  let depth = 0;
  for (let i = close; i >= 0; i--) {
    if (s[i] === ")") depth++;
    else if (s[i] === "(" && --depth === 0) return i;
  }
  return -1;
}

/** Rewrites the few notations the engine does not evaluate itself. */
export function rewriteLatex(input: string): string {
  let s = input.trim();
  s = s.replace(/(?:=|\\approx)\s*$/, "").trim(); // a trailing "="
  s = s.replace(/\\left\(/g, "(").replace(/\\right\)/g, ")");
  s = s.replace(/\^\{\\prime\}|\^\\prime/g, "'");

  // (f∘g)(a)  ->  f(g(a))
  const comp = /\(\s*([a-zA-Z])\s*\\circ\s*([a-zA-Z])\s*\)\s*\(/;
  for (let guard = 0; guard < 20; guard++) {
    const m = comp.exec(s);
    if (!m) break;
    const argOpen = m.index + m[0].length - 1;
    const argClose = closeOf(s, argOpen);
    if (argClose < 0) break;
    const arg = s.slice(argOpen + 1, argClose);
    s = s.slice(0, m.index) + `${m[1]}(${m[2]}(${arg}))` + s.slice(argClose + 1);
  }

  // (expression)'  ->  d/dx of the expression
  for (let guard = 0; guard < 20; guard++) {
    const at = s.indexOf(")'");
    if (at < 0) break;
    const open = openOf(s, at);
    if (open < 0) break;
    const inner = s.slice(open + 1, at);
    s = s.slice(0, open) + `\\frac{d}{dx}(${inner})` + s.slice(at + 2);
  }
  return s;
}

/** a list of lists (a matrix) as LaTeX, or null when the value is not one */
function matrixLatex(json: unknown): string | null {
  if (!Array.isArray(json) || json[0] !== "List") return null;
  const rows = json.slice(1);
  if (!rows.length || !rows.every((r) => Array.isArray(r) && r[0] === "List")) return null;
  const cell = (c: unknown): string => {
    if (typeof c === "number") return formatNumber(c);
    if (typeof c === "string") return c;
    if (c && typeof c === "object" && "num" in c) return formatNumber(Number((c as { num: string }).num));
    return "?";
  };
  const body = (rows as unknown[][]).map((r) => r.slice(1).map(cell).join("&")).join("\\\\");
  return `\\begin{pmatrix}${body}\\end{pmatrix}`;
}

/** 10 significant digits, no trailing zeros, exponent form for very big or small values */
export function formatNumber(re: number, boxed?: Boxed): string {
  if (Object.is(re, -0) || re === 0) return "0";
  if (Number.isInteger(re)) {
    if (Math.abs(re) < 1e15) return String(re);
    // beyond what a double holds exactly: use the engine's exact digits when it has them
    const j = boxed?.json as { num?: string } | number | undefined;
    const digits = typeof j === "number" ? String(j) : j?.num;
    if (digits && /^-?\d+$/.test(digits)) return digits;
  }
  const abs = Math.abs(re);
  if (abs >= 1e15 || abs < 1e-7) return re.toExponential(9).replace(/\.?0+e/, "e").replace("e+", "e");
  return String(Number(re.toPrecision(10)));
}

/** shortens long decimals inside a LaTeX answer and drops the engine's digit grouping */
function tidyLatex(latex: string, addConstant: boolean) {
  let s = latex.replace(/\\,/g, "");
  s = s.replace(/(\d+\.\d{7,})/g, (m) => String(Number(Number(m).toPrecision(8))));
  s = s.replace(/(\d)\.0(?![\d])/g, "$1");
  return addConstant ? `${s}+C` : s;
}

export function evaluateLatex(ce: Engine, input: string): CalcResult {
  const prepared = rewriteLatex(input);
  if (!prepared) return { ok: false, message: "Type an expression first." };

  try {
    // f(x) = ...   (also :=) defines a function for later use, e.g. f(3)
    const def = /^([a-zA-Z])\(\s*([a-zA-Z])\s*\)\s*(?::=|\\coloneq|\\coloneqq|=)\s*(.+)$/.exec(prepared);
    if (def) {
      const [, name, arg, body] = def;
      const assigned = ce.parse(`${name}(${arg}):=${body}`);
      if (!assigned.isValid) return { ok: false, message: "That definition isn't valid." };
      assigned.evaluate();
      return { ok: true, kind: "note", text: `${name}(${arg}) defined` };
    }

    const expr = ce.parse(prepared);
    if (!expr.isValid) return { ok: false, message: "That expression isn't complete." };

    const value = expr.evaluate();
    const num = value.N();
    const json = num.json;

    if (json === "True") return { ok: true, kind: "note", text: "True" };
    if (json === "False") return { ok: true, kind: "note", text: "False" };
    if (json === "ComplexInfinity") return { ok: false, message: "Cannot divide by zero." };
    if (json === "NaN") return { ok: false, message: "That has no value." };
    if (json === "PositiveInfinity") return { ok: true, kind: "note", text: "∞" };
    if (json === "NegativeInfinity") return { ok: true, kind: "note", text: "−∞" };

    const re = num.re;
    if (typeof re === "number" && Number.isFinite(re) && !num.im) {
      return { ok: true, kind: "number", text: formatNumber(re, num) };
    }

    const matrix = matrixLatex(value.json);
    if (matrix) return { ok: true, kind: "math", latex: matrix };

    // symbolic or complex: show it typeset. An integral without limits gets "+ C".
    const indefinite = /\\int(?!\s*_)/.test(prepared);
    return { ok: true, kind: "math", latex: tidyLatex(value.latex, indefinite) };
  } catch {
    return { ok: false, message: "Couldn't work that out." };
  }
}
