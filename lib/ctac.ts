// CTAC note practice: the SOAP rubric checks, from the CTAC master rubric (SOAP part). They are
// word matches, so they are hints, not a grade.

export type Section = "subjective" | "objective" | "assessment" | "plan" | "signoff";

export const SECTIONS: { key: Section; label: string }[] = [
  { key: "subjective", label: "Subjective" },
  { key: "objective", label: "Objective" },
  { key: "assessment", label: "Assessment" },
  { key: "plan", label: "Plan" },
  { key: "signoff", label: "Sign Off" },
];

export type Options = {
  visit: "well" | "problem";
  sex: "female" | "male";
  chronic: boolean; // patient has a chronic condition to manage
  breast: boolean;
  gi: boolean;
  gu: boolean;
  neuro: boolean;
};

export const DEFAULT_OPTIONS: Options = {
  visit: "well", sex: "female", chronic: false, breast: false, gi: false, gu: false, neuro: false,
};

// ---------- review of systems (three per system is "complete") ----------

export const ROS: { system: string; aliases: string }[] = [
  { system: "General", aliases: "general|constitutional" },
  { system: "Integument", aliases: "integument(?:ary)?|skin" },
  { system: "Head", aliases: "head" },
  { system: "Eyes", aliases: "eyes?" },
  { system: "Ears", aliases: "ears?" },
  { system: "Nose", aliases: "nose|nasal" },
  { system: "Mouth/Throat", aliases: "throat|mouth(?:\\s*/\\s*throat)?" },
  { system: "Neck", aliases: "neck" },
  { system: "CV", aliases: "cardiovascular|cv|cardiac|heart" },
  { system: "Pulm", aliases: "pulm(?:onary)?|resp(?:iratory)?|lungs?" },
  { system: "Chest/Breast", aliases: "chest(?:\\s*/\\s*breasts?)?|breasts?|c\\s*/\\s*b" },
  { system: "GI", aliases: "gi|gastrointestinal" },
  { system: "GU", aliases: "gu|genitourinary|urinary" },
  { system: "Sexual", aliases: "sexual" },
  { system: "MSK", aliases: "msk|musculoskeletal" },
  { system: "Neuro", aliases: "neuro(?:logical|logic)?" },
  { system: "Endo", aliases: "endo(?:crine)?" },
  { system: "Heme", aliases: "heme|hematolog(?:ic|y)|hematologic" },
  { system: "Psych", aliases: "psych(?:iatric)?" },
];

// Students often label the HEENT lines by letter, in order: H, E, E, N, T, N. Inside the ROS block,
// rename them to the full system (first E = Eyes, second E = Ears, first N = Nose, second N = Neck)
// so they count like the spelled-out labels.
const LETTERS: Record<string, string[]> = { h: ["Head"], e: ["Eyes", "Ears"], n: ["Nose", "Neck"], t: ["Throat"] };

function expandLetterLabels(subjective: string): string {
  const lines = subjective.split("\n");
  const start = lines.findIndex((l) => /^\s*(ROS|review of systems)\b/i.test(l));
  if (start < 0) return subjective;
  const seen: Record<string, number> = {};
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^([\t ]*)([HENT])([\t ]*(?:-|–|—|:).*)$/i);
    if (!m) continue;
    const k = m[2].toLowerCase();
    const name = LETTERS[k][seen[k] ?? 0];
    seen[k] = (seen[k] ?? 0) + 1;
    if (name) lines[i] = m[1] + name + m[3];
  }
  return lines.join("\n");
}

// the line a system is written on (as typed, letter labels and all), or null
export function rosLine(subjective: string, aliases: string): string | null {
  const re = new RegExp(`^[\\t ]*(?:${aliases})[\\t ]*(?:-|–|—|:)`, "i");
  const original = subjective.split("\n");
  const i = expandLetterLabels(subjective).split("\n").findIndex((l) => re.test(l));
  return i < 0 ? null : original[i].trim();
}

// counts the symptoms listed on a system's line ("Eyes – Denies vision loss, blurry vision, diplopia" = 3)
export function rosCount(subjective: string, aliases: string): number {
  const re = new RegExp(`^[\\t ]*(?:${aliases})[\\t ]*(?:-|–|—|:)[\\t ]*(.+)$`, "gim");
  let best = 0;
  for (const m of expandLetterLabels(subjective).matchAll(re)) {
    const body = m[1].replace(/\b(denies|admits|reports|endorses|no|negative for)\b/gi, " ");
    const n = body.split(/,|;|\band\b|\bor\b/i).map((s) => s.trim()).filter((s) => /[a-z]/i.test(s)).length;
    best = Math.max(best, n);
  }
  return best;
}

// ---------- rubric checks (SOAP part of the CTAC master rubric) ----------

export type Part = { label: string; re: { test(text: string): boolean } };
export type RubricItem = {
  id: string;
  section: Section;
  label: string;
  parts?: Part[];
  re?: RegExp;
  min?: number; // parts needed for "done" (default: all)
  show?: (o: Options) => boolean;
  hint?: string;
};

const p = (label: string, re: Part["re"]): Part => ({ label, re });

// true when the note has medication lines (Rx / OTC / Supplements) and every one says none
function takesNoMeds(text: string): boolean {
  const lines = text.match(/^\s*(Rx|OTC|Supplements?)\b.*$/gim) ?? [];
  return lines.length > 0 && lines.every((l) => /\b(none|denies|no)\b/i.test(l));
}
// dose and timing only apply when something is taken
const unlessNoMeds = (re: RegExp): Part["re"] => ({ test: (t) => takesNoMeds(t) || re.test(t) });

export const RUBRIC: RubricItem[] = [
  // subjective
  { id: "name", section: "subjective", label: "Patient name (first and last)", re: /\b(?:[A-Z][a-z]+ |(?:[A-Z]\. ?){1,3})[A-Z][a-z]+\b.{0,40}\b(is a|y\/o|year)/ }, // "A.T. Still" counts too
  { id: "dob", section: "subjective", label: "Date of birth", re: /\b(born|DOB)\b[^\n]{0,20}\d{1,2}\/\d{1,2}\/\d{2,4}/i },
  { id: "cc", section: "subjective", label: "Chief complaint / reason for visit", re: /presenting|presents|here (today )?for|\bCC\b|reason for visit|c\/o/i },
  {
    id: "oldcarts", section: "subjective", label: "OLDCARTS", show: (o) => o.visit === "problem",
    parts: [
      p("Onset", /onset|began|started/i), p("Location", /locat|radiat/i), p("Duration", /duration|lasting|lasts/i),
      p("Character", /character|describes|sharp|dull|aching|burning|throbbing|pressure/i),
      p("Aggravating", /aggravat|worse/i), p("Relieving", /reliev|better|alleviat/i),
      p("Timing", /timing|constant|intermittent|comes and goes/i), p("Severity", /severity|\/10|out of 10/i),
    ],
  },
  { id: "since", section: "subjective", label: "Health since last well visit", show: (o) => o.visit === "well", re: /since (her |his |their |the )?last|last seen|general(ly)? (in )?good health|overall health|health since/i },
  { id: "concerns", section: "subjective", label: "New complaints / concerns", re: /concern/i },
  {
    id: "pmhx", section: "subjective", label: "Past medical history", min: 5,
    parts: [
      p("Significant events", /\bMI\b|\bCVA\b|stroke|heart attack|medical events|serious/i),
      p("Psychiatric", /psych|depress|anxiety/i), p("Hospitalizations", /hospitali/i),
      p("Injuries", /injur|trauma|fracture/i), p("Surgeries", /surg|ectomy/i),
      p("Chronic diagnoses", /chronic|diagnos|medical hx/i),
    ],
  },
  {
    id: "chronic", section: "subjective", label: "Chronic disease management", show: (o) => o.chronic,
    parts: [
      p("Controlled?", /controlled/i), p("How monitored", /monitor/i), p("How managed", /managed|management/i),
      p("Who manages", /PCP|specialist|cardiolog|endocrinolog|by Dr|primary care/i),
      p("Last lab/test", /last (lab|test|A1c|check)|labs? (on|in)/i), p("Adherence", /adheren|complian|tolerat/i),
    ],
  },
  {
    id: "obgyn", section: "subjective", label: "OB/Gyn history", show: (o) => o.sex === "female",
    parts: [p("Menarche", /menarche|first (period|menses)/i), p("Menstrual Hx / LMP", /\bLMP\b|menses|menstrua|menopaus/i), p("G/P", /\bG\s?\d|gravida|pregnan|TPAL/i)],
  },
  {
    id: "prevent", section: "subjective", label: "Health maintenance", show: (o) => o.visit === "well",
    parts: [
      p("Last well visit", /last seen|last (well|annual|wellness) visit|(one|1) year ago/i),
      p("Immunizations", /vaccin|immuniz|booster|flu shot|tetanus|Tdap/i),
      p("Screening tests", /screen|mammo|pap\b|colonoscop|lipid|\blabs?\b/i),
    ],
  },
  {
    id: "meds", section: "subjective", label: "Medications",
    parts: [
      p("OTC", /\bOTC\b|over[- ]the[- ]counter/i), p("Rx", /\bRx\b|prescri/i), p("Supplements", /supplement|vitamin/i),
      p("Dose", unlessNoMeds(/\b\d+\s?(mg|mcg|units?|IU)\b|\bdose/i)),
      p("Timing", unlessNoMeds(/daily|\bBID\b|\bTID\b|nightly|once a|twice a|every (morning|night|day)|as needed|\bPRN\b/i)),
    ],
    hint: "If the patient takes nothing, say so for each: no Rx, OTC, or supplements.",
  },
  {
    id: "allergies", section: "subjective", label: "Allergies",
    parts: [p("Food", /food/i), p("Environment", /environment|seasonal|pollen|ragweed|dust|pet/i), p("Medications", /NKDA|drug|medication allerg|allergies.{0,40}medication/i), p("Reaction", /reaction|rash|hives|swelling|anaphyla|sneez|itch|watery/i)],
  },
  { id: "fhx", section: "subjective", label: "Family history (3 generations)" },
  {
    id: "shx", section: "subjective", label: "Social history",
    parts: [
      p("Living situation", /lives|living|home|house/i), p("Occupation", /works?|job|occupation|employ|retired|student/i),
      p("Diet", /diet|nutrition|eats|meals/i), p("Exercise", /exercis|walks|gym|bik|cycl|runs/i),
      p("Caffeine", /caffeine|coffee|\btea\b|soda|energy drink/i), p("Tobacco/vaping", /tobacco|smok|nicotine|vap|cigar/i),
      p("Alcohol", /alcohol|EtOH|drinks/i), p("Drugs", /drug use|recreational|illicit|marijuana|cannabis/i),
    ],
  },
  // objective
  {
    id: "vitals", section: "objective", label: "Vitals",
    parts: [
      p("BP", /\bBP\b|blood pressure/i), p("RR", /^\s*R\b\s*[-–:]?\s*\d|\bRR\b|resp(iratory)? rate/im),
      p("HR", /^\s*(P|HR)\b\s*[-–:]?\s*\d|heart rate/im), p("Temp", /^\s*T\b\s*[-–:]?\s*\d|\btemp/im), p("O2 sat", /SpO2|\bO2\b|pulse ox|oxygen sat/i),
    ],
  },
  { id: "general", section: "objective", label: "General appearance", re: /^\s*general\b.*(NAD|WNWD|A&O|appears|distress)/im },
  { id: "integ", section: "objective", label: "Integument", parts: [p("Skin", /skin/i), p("Hair", /hair/i), p("Nails", /nails?/i)] },
  { id: "pulses", section: "objective", label: "Pulses", parts: [p("Upper", /radial|brachial|\bRAD\b|upper/i), p("Lower", /dorsalis|\bDP\b|tibial|pedal|lower/i)] },
  { id: "head", section: "objective", label: "Head", re: /NCAT|normocephalic|scalp|^\s*head\s*[-–:]/im },
  { id: "eyes", section: "objective", label: "Eyes", parts: [p("Reactive", /PERRL|reactive/i), p("EOM", /\bEOM/i), p("Fundoscopic", /fundo|disc margins|optic/i)] },
  { id: "ears", section: "objective", label: "Ears", parts: [p("Tragus nontender", /tragus/i), p("EAC clear", /\bEAC\b|canal/i), p("TM described", /\bTMs?\b|tympanic/i)] },
  { id: "nose", section: "objective", label: "Nose", parts: [p("Drainage", /drainage|discharge|rhinorrhea|epistaxis/i), p("Appearance", /septum|nares|turbinate/i)] },
  { id: "throat", section: "objective", label: "Mouth/Throat", parts: [p("Oral mucosa", /oral mucosa|buccal|dentition/i), p("Pharynx/tonsils", /pharyn|tonsil/i)] },
  { id: "neck", section: "objective", label: "Neck", parts: [p("Motion", /\bF?ROM\b|motion|supple/i), p("Lymph nodes", /lymph|adenopathy/i), p("Thyroid", /thyroid/i)] },
  { id: "cv", section: "objective", label: "Cardiovascular", parts: [p("RRR", /RRR|regular rate/i), p("No m/r/g", /m\/r\/g|murmur/i)] },
  { id: "resp", section: "objective", label: "Respiratory", parts: [p("CTA b/l", /CTA/i), p("No w/c/r", /w\/[cr]\/r|wheez/i)] },
  {
    id: "breast", section: "objective", label: "Breast", show: (o) => o.sex === "female" && o.breast,
    parts: [p("Symmetry", /symmetr/i), p("Palpation", /palpat/i), p("Axillary nodes", /axillary/i), p("Nipple discharge", /nipple/i)],
  },
  {
    id: "gi", section: "objective", label: "Abdomen (GI)", show: (o) => o.gi,
    parts: [p("Bowel sounds", /\bBS\b|bowel sounds/i), p("Soft/firm", /soft|firm/i), p("Tenderness", /\bNT\b|tender/i), p("Masses", /mass/i), p("Organomegaly", /organomegaly|hepatomegaly|splenomegaly|HSM/i)],
  },
  {
    id: "guf", section: "objective", label: "GU (female)", show: (o) => o.sex === "female" && o.gu,
    parts: [p("External inspection", /external/i), p("Inguinal nodes", /inguinal/i), p("Speculum", /speculum/i), p("Bimanual", /bimanual/i)],
  },
  {
    id: "gum", section: "objective", label: "GU (male)", show: (o) => o.sex === "male" && o.gu,
    parts: [p("Scrotum", /scrot/i), p("Inguinal nodes", /inguinal/i), p("Penis", /penis/i), p("Testes", /test(es|is)/i), p("Epididymis", /epididym/i), p("Hernia", /hernia/i)],
  },
  { id: "omm", section: "objective", label: "Osteopathic/MSK findings", re: /cervical|thoracic|lumbar|spine|somatic|tissue texture|TART/i },
  {
    id: "neuro", section: "objective", label: "Neuro", show: (o) => o.neuro,
    parts: [p("CN II–XII", /\bCN\b|cranial/i), p("Motor strength", /strength|5\/5/i), p("Coordination", /coordinat|RAM|finger|heel/i), p("Sensation", /sensation|dermatome/i), p("DTRs", /DTR|reflex/i), p("Gait", /gait/i)],
  },
  // assessment and plan
  { id: "summary", section: "assessment", label: "Summary statement", re: /\b\d{1,3}[- ]?(y\/o|yo|year[- ]old)\b.{0,80}(presenting|presents|here for|for)/i },
  { id: "dx", section: "assessment", label: "Numbered assessments", re: /^\s*1[.)]/m },
  {
    id: "plan", section: "plan", label: "Plan elements", min: 4,
    parts: [
      p("Lifestyle", /diet|exercise|lifestyle|nutrition|sleep|weight/i), p("Testing", /\blabs?\b|test|CBC|CMP|lipid|A1c|panel|order/i),
      p("Referral / coordination", /refer|coordinat|specialist|social worker|nutritionist|dietitian/i),
      p("Treatment", /prescri|\bOMT\b|start|continue|\bmg\b|therapy|medication/i),
      p("Social needs", /social determin|food|transport|housing|safety|financ|insurance|social work/i),
      p("Education", /educat|discussed|counsel|explained|advised|informed/i),
      p("Prevention", /vaccin|booster|screen|mammo|colonoscop|pap\b|immuniz/i),
      p("Follow-up", /\bRTC\b|return|follow[- ]?up|\bF\/U\b|sooner if/i),
    ],
  },
  {
    id: "signoff", section: "signoff", label: "Sign off",
    parts: [p("First and last name", /\b[A-Z][a-z]+\b.*\b[A-Z][a-z]+\b/), p("Credentials", /OMS-?\s?(I{1,4}|[1-4])\b|\bDO\b|\bMD\b|student/i), p("Date", /\d{1,2}\/\d{1,2}\/\d{2,4}/), p("Time", /\d{1,2}:\d{2}\s*(am|pm)?/i)],
  },
];

// family history: one point per generation mentioned
export function fhxGenerations(subjective: string): string[] {
  const gens: string[] = [];
  if (/brother|sister|sibling|\bson\b|daughter|child/i.test(subjective)) gens.push("Siblings/children");
  if (/mother|father|\bmom\b|\bdad\b|parents|^\s*[MD]\s*[-–:]/im.test(subjective)) gens.push("Parents");
  if (/grand|\b[MP]G[MF]\b/i.test(subjective)) gens.push("Grandparents");
  return gens;
}
