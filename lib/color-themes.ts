// Brand color themes. A student's choice is stored as text in student_profiles.color_theme:
//   - a preset name ("burgundy", "blue", ...): its shades live in app/globals.css (--brand-*),
//     picked by <html data-theme="...">;
//   - "h<hue>" or "h<hue>b<brightness>": a color picked on the spectrum (hue 0-359, brightness
//     0-100, default 0). The shades are generated here and set as inline CSS variables.
// "orange" was a preset once: students who saved it keep it, but it is no longer offered.
// Keep this in step with save_appearance() in migrations/migration_029.sql.
export const COLOR_THEMES = [
  { key: "burgundy", label: "Burgundy", swatch: "#5d0124", hue: 337 },
  { key: "purple", label: "Purple", swatch: "#4338ca", hue: 245 },
  { key: "blue", label: "Blue", swatch: "#1d4ed8", hue: 221 },
  { key: "green", label: "Green", swatch: "#047857", hue: 160 },
  { key: "teal", label: "Teal", swatch: "#0f766e", hue: 175 },
] as const;

const LEGACY_PRESETS = ["orange"];
const LEGACY_HUE: Record<string, number> = { orange: 24 };

export type ColorTheme = (typeof COLOR_THEMES)[number]["key"];
export const DEFAULT_COLOR_THEME: ColorTheme = "burgundy";

export type Custom = { hue: number; bright: number };

const CUSTOM = /^h(\d{1,3})(?:b(\d{1,3}))?$/;

// The hue and brightness behind a stored custom choice, or null for a preset
export function parseCustom(value: string): Custom | null {
  const m = CUSTOM.exec(value);
  if (!m) return null;
  const hue = Number(m[1]);
  const bright = m[2] === undefined ? 0 : Number(m[2]);
  return hue <= 359 && bright <= 100 ? { hue, bright } : null;
}

export function customValue(hue: number, bright: number): string {
  return bright > 0 ? `h${hue}b${bright}` : `h${hue}`;
}

// A valid stored choice: a preset name or a custom color. Anything else is the default.
export function asColorValue(v: unknown): string {
  if (typeof v !== "string") return DEFAULT_COLOR_THEME;
  if (COLOR_THEMES.some((t) => t.key === v) || LEGACY_PRESETS.includes(v)) return v;
  return parseCustom(v) ? v : DEFAULT_COLOR_THEME;
}

// where the sliders start for any stored choice
export function startingPoint(value: string): Custom {
  const c = parseCustom(value);
  if (c) return c;
  const hue = COLOR_THEMES.find((t) => t.key === value)?.hue ?? LEGACY_HUE[value] ?? 337;
  return { hue, bright: 0 };
}

export function asAppearance(v: unknown): "light" | "dark" | null {
  return v === "light" || v === "dark" ? v : null;
}

export const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
type Shade = (typeof SHADES)[number];

// saturation and lightness of each shade, measured from the burgundy default so every hue
// gets the same light-to-dark curve
const CURVE: Record<Shade, [number, number]> = {
  50: [73, 97],
  100: [78, 95],
  200: [78, 89],
  300: [76, 80],
  400: [72, 67],
  500: [56, 51],
  600: [87, 30],
  700: [98, 18],
  800: [97, 15],
  900: [96, 11],
  950: [100, 7],
};

// how much of the brightness lift each dark shade gets (lightness points at brightness 100)
const LIFT: Partial<Record<Shade, number>> = { 600: 14, 700: 26, 800: 20, 900: 14, 950: 8 };

// shades that carry white text must stay readable: contrast against white at least this
const MIN_CONTRAST: Partial<Record<Shade, number>> = { 600: 3.5, 700: 4.5, 800: 4.5 };

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function contrastWithWhite([r, g, b]: [number, number, number]) {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return 1.05 / (lum + 0.05);
}

// CSS variables ("--brand-50": "253 242 246", ...) for a color, in the form Tailwind reads
export function brandVars(hue: number, bright = 0): Record<string, string> {
  const out: Record<string, string> = {};
  for (const sh of SHADES) {
    const [s, l0] = CURVE[sh];
    let l = l0 + (LIFT[sh] ?? 0) * (bright / 100);
    let rgb = hslToRgb(hue, s, l);
    const min = MIN_CONTRAST[sh];
    // lifting must never make white text hard to read (yellows and greens get light fast)
    while (min && l > 8 && contrastWithWhite(rgb) < min) {
      l -= 1;
      rgb = hslToRgb(hue, s, l);
    }
    out[`--brand-${sh}`] = rgb.join(" ");
  }
  return out;
}
