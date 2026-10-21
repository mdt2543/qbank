// Brand color themes students can choose from. The shades live in app/globals.css
// (--brand-*), picked by <html data-theme="...">. Keep this list in step with the CSS and
// with save_appearance() in migrations/migration_022.sql.
export const COLOR_THEMES = [
  { key: "burgundy", label: "Burgundy", swatch: "#5d0124" },
  { key: "purple", label: "Purple", swatch: "#4338ca" },
  { key: "blue", label: "Blue", swatch: "#1d4ed8" },
  { key: "green", label: "Green", swatch: "#047857" },
  { key: "teal", label: "Teal", swatch: "#0f766e" },
  { key: "orange", label: "Orange", swatch: "#c2410c" },
] as const;

export type ColorTheme = (typeof COLOR_THEMES)[number]["key"];
export const DEFAULT_COLOR_THEME: ColorTheme = "burgundy";

export function asColorTheme(v: unknown): ColorTheme {
  return COLOR_THEMES.some((t) => t.key === v) ? (v as ColorTheme) : DEFAULT_COLOR_THEME;
}

export function asAppearance(v: unknown): "light" | "dark" | null {
  return v === "light" || v === "dark" ? v : null;
}
