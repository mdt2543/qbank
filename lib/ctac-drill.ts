// Missed-item practice: for each rubric item a student missed, find the matching piece of the
// reference note (a block under a heading, a single exam line, or the whole box) so they can
// copy it out three times before writing the section again from memory.

import { rosLine } from "@/lib/ctac";

type Pick =
  | { block: RegExp } // heading line + the lines under it, up to the next blank line
  | { line: RegExp } // the first line that matches
  | { lines: RegExp } // every line that matches
  | { whole: true }; // the whole box

const PICKS: Record<string, Pick> = {
  name: { line: /\S/ },
  dob: { line: /\bDOB\b|\bborn\b/i },
  cc: { line: /^\s*CC\b|chief complaint|presenting|presents/i },
  oldcarts: { block: /^\s*HPI\b/i },
  since: { block: /^\s*HPI\b/i },
  concerns: { block: /^\s*HPI\b/i },
  pmhx: { block: /^\s*(PMHx|PMH|past medical)/i },
  chronic: { block: /^\s*(PMHx|PMH|past medical)/i },
  obgyn: { block: /^\s*(OB\s*\/?\s*Gyn|OB\b|gyn)/i },
  prevent: { block: /^\s*(health maintenance|prevent)/i },
  meds: { block: /^\s*(medications|meds)\s*:?\s*$/i },
  allergies: { block: /^\s*allergies\s*:?\s*$/i },
  fhx: { block: /^\s*(FHx|FH\b|family history)/i },
  shx: { block: /^\s*(SHx|SH\b|social history)/i },
  vitals: { block: /^\s*vitals/i },
  general: { line: /^\s*general\b/i },
  integ: { line: /^\s*integument|^\s*skin\b/i },
  pulses: { line: /radial|\bRAD\b|\bDP\b|dorsalis|pulses/i },
  head: { line: /NCAT|normocephalic|^\s*head\b/i },
  eyes: { line: /PERRL|^\s*eyes\b/i },
  ears: { line: /tragus|^\s*ears\b/i },
  nose: { line: /nares|septum|^\s*nose\b/i },
  throat: { line: /pharyn|oral mucosa|^\s*(throat|mouth)\b/i },
  neck: { line: /thyroid|^\s*neck\b/i },
  cv: { line: /RRR|^\s*(CV|cardio)/i },
  resp: { line: /CTA|^\s*(lungs|resp|pulm)/i },
  breast: { line: /^\s*breasts?\b/i },
  gi: { line: /^\s*(abd|abdomen|GI)\b/i },
  guf: { line: /^\s*(GU|genit)/i },
  gum: { line: /^\s*(GU|genit)/i },
  omm: { line: /^\s*(osteopathic|OMM|MSK)/i },
  neuro: { line: /^\s*neuro/i },
  summary: { line: /\by\/o\b|year[- ]old/i },
  dx: { lines: /^\s*\d+[.)]/ },
  plan: { whole: true },
  signoff: { whole: true },
};

export function referencePiece(itemId: string, text: string): string | null {
  const pick = PICKS[itemId];
  if (!pick || !text.trim()) return null;
  const lines = text.split("\n");
  if ("whole" in pick) return text.trim();
  if ("lines" in pick) {
    const hit = lines.filter((l) => pick.lines.test(l));
    return hit.length ? hit.join("\n").trim() : null;
  }
  if ("line" in pick) return lines.find((l) => pick.line.test(l))?.trim() ?? null;
  const start = lines.findIndex((l) => pick.block.test(l));
  if (start < 0) return null;
  let end = start + 1;
  while (end < lines.length && lines[end].trim()) end++;
  return lines.slice(start, end).join("\n").trim();
}

export function referenceRos(subjective: string, aliases: string): string | null {
  return rosLine(subjective, aliases);
}

// copying the reference word for word also counts, even if the checker would miss something
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const matchesReference = (typed: string, reference: string | null) =>
  !!reference && norm(typed) === norm(reference);
