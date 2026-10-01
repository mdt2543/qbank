"use client";

import { useRef } from "react";

export type Range = { p: number; s: number; e: number };
export type Tool = "none" | "highlight" | "erase" | "strike";

function merge(list: Range[], add: Range): Range[] {
  const same = list.filter((r) => r.p === add.p);
  const rest = list.filter((r) => r.p !== add.p);
  let { s, e } = add;
  const keep: Range[] = [];
  for (const r of same) {
    if (r.e < s || r.s > e) keep.push(r);
    else {
      s = Math.min(s, r.s);
      e = Math.max(e, r.e);
    }
  }
  return [...rest, ...keep, { p: add.p, s, e }];
}

function subtract(list: Range[], cut: Range): Range[] {
  const out: Range[] = [];
  for (const r of list) {
    if (r.p !== cut.p || r.e <= cut.s || r.s >= cut.e) {
      out.push(r);
      continue;
    }
    if (r.s < cut.s) out.push({ p: r.p, s: r.s, e: cut.s });
    if (r.e > cut.e) out.push({ p: r.p, s: cut.e, e: r.e });
  }
  return out;
}

function offsetIn(el: Element, node: Node, off: number) {
  const r = document.createRange();
  r.selectNodeContents(el);
  r.setEnd(node, off);
  return r.toString().length;
}

export default function HighlightedText({
  paragraphs,
  ranges,
  tool,
  onChange,
}: {
  paragraphs: string[];
  ranges: Range[];
  tool: Tool;
  onChange: (next: Range[]) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const active = tool === "highlight" || tool === "erase";

  function onMouseUp() {
    if (!active || !box.current) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!box.current.contains(range.commonAncestorContainer)) return;

    let next = ranges;
    box.current.querySelectorAll<HTMLElement>("[data-p]").forEach((el) => {
      if (!range.intersectsNode(el)) return;
      const len = (el.textContent ?? "").length;
      const s = el.contains(range.startContainer)
        ? offsetIn(el, range.startContainer, range.startOffset)
        : 0;
      const e = el.contains(range.endContainer)
        ? offsetIn(el, range.endContainer, range.endOffset)
        : len;
      if (e <= s) return;
      const cut = { p: Number(el.dataset.p), s, e };
      next = tool === "highlight" ? merge(next, cut) : subtract(next, cut);
    });
    sel.removeAllRanges();
    onChange(next);
  }

  return (
    <div
      ref={box}
      onMouseUp={onMouseUp}
      className={`space-y-4 leading-relaxed ${active ? "cursor-text" : ""}`}
    >
      {paragraphs.map((text, p) => {
        const mine = ranges
          .filter((r) => r.p === p)
          .sort((a, b) => a.s - b.s);
        const parts: React.ReactNode[] = [];
        let at = 0;
        for (const r of mine) {
          if (r.s > at) parts.push(text.slice(at, r.s));
          parts.push(
            <mark key={r.s} className="rounded-sm bg-yellow-300 px-0.5 text-black">
              {text.slice(r.s, r.e)}
            </mark>
          );
          at = r.e;
        }
        if (at < text.length) parts.push(text.slice(at));
        return (
          <p key={p} data-p={p}>
            {parts}
          </p>
        );
      })}
    </div>
  );
}
