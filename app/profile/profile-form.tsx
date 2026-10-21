"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "next-themes";
import Avatar from "@/components/avatar";
import { brandVars, COLOR_THEMES, customValue, parseCustom, SHADES, startingPoint } from "@/lib/color-themes";

// Crop to a centered square and shrink, so uploads stay small whatever the original.
async function toSquareJpeg(file: File, size = 256): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  canvas
    .getContext("2d")!
    .drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not process that image"))),
      "image/jpeg",
      0.85
    )
  );
}

export default function ProfileForm({
  userId,
  email,
  initialName,
  initialPath,
  initialUrl,
  initialJumpscares,
  initialColor,
  initialAppearance,
}: {
  userId: string;
  email: string;
  initialName: string;
  initialPath: string | null;
  initialUrl: string | null;
  initialJumpscares: boolean;
  initialColor: string;
  initialAppearance: "light" | "dark" | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [path, setPath] = useState(initialPath);
  const [preview, setPreview] = useState(initialUrl);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [jumpscares, setJumpscares] = useState(initialJumpscares);
  const [savedJumpscares, setSavedJumpscares] = useState(initialJumpscares);
  const { setTheme } = useTheme();
  const [color, setColor] = useState<string>(initialColor);
  const [mode, setMode] = useState<"system" | "light" | "dark">(initialAppearance ?? "system");
  const [saved, setSaved] = useState({ color: initialColor, mode: initialAppearance ?? "system" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      return setMsg({ ok: false, text: "Please choose an image file." });
    }
    try {
      const out = await toSquareJpeg(file);
      setBlob(out);
      setPreview(URL.createObjectURL(out));
      setMsg(null);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Could not read that image." });
    }
  }

  // choices show straight away; they are saved with the Save button
  function chooseColor(c: string) {
    setColor(c);
    const root = document.documentElement;
    const custom = parseCustom(c);
    if (!custom) {
      // a preset: its shades come from the stylesheet
      root.dataset.theme = c;
      for (const sh of SHADES) root.style.removeProperty(`--brand-${sh}`);
    } else {
      root.dataset.theme = "custom";
      for (const [k, v] of Object.entries(brandVars(custom.hue, custom.bright))) root.style.setProperty(k, v);
    }
  }
  // where the two sliders sit: the picked color, or the starting point of the chosen preset
  const point = startingPoint(color);
  const moreStartsOpen = !COLOR_THEMES.some((t) => t.key === initialColor);
  function chooseMode(m: "system" | "light" | "dark") {
    setMode(m);
    setTheme(m);
  }

  function removePhoto() {
    setBlob(null);
    setPreview(null);
    setPath(null);
  }

  async function save() {
    setBusy(true);
    setMsg(null);

    let nextPath = path;
    if (blob) {
      nextPath = `${userId}/avatar-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(nextPath, blob, { contentType: "image/jpeg" });
      if (upErr) {
        setBusy(false);
        return setMsg({ ok: false, text: upErr.message });
      }
    }

    const { error } = await supabase.rpc("save_profile", {
      p_display_name: name,
      p_avatar_path: nextPath,
      // only sent when changed, so saving a name never depends on the newer setting
      ...(jumpscares !== savedJumpscares ? { p_jumpscares: jumpscares } : {}),
    });
    if (error) {
      if (blob && nextPath) await supabase.storage.from("avatars").remove([nextPath]);
      setBusy(false);
      return setMsg({ ok: false, text: error.message });
    }

    if (color !== saved.color || mode !== saved.mode) {
      const { error: lookErr } = await supabase.rpc("save_appearance", {
        p_color: color,
        p_mode: mode === "system" ? null : mode,
      });
      if (lookErr) {
        setBusy(false);
        return setMsg({ ok: false, text: lookErr.message });
      }
      setSaved({ color, mode });
    }

    // delete the previous picture file now that it is no longer used
    if (initialPath && initialPath !== nextPath) {
      await supabase.storage.from("avatars").remove([initialPath]);
    }
    setBlob(null);
    setPath(nextPath);
    setSavedJumpscares(jumpscares);
    setBusy(false);
    setMsg({ ok: true, text: "Saved." });
    router.refresh();
  }

  const shown = name.trim() || email.split("@")[0];

  return (
    <div className="mt-8 space-y-6">
      <div className="flex items-center gap-5">
        <Avatar url={preview} name={shown} size={96} />
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onFile}
            className="hidden"
          />
          <button
            onClick={() => fileInput.current?.click()}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700"
          >
            {preview ? "Change picture" : "Upload picture"}
          </button>
          {preview && (
            <button
              onClick={removePhoto}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="name" className="text-sm font-medium">
          Display name
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          placeholder="2–30 characters"
          className="mt-2 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-700"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          You only appear on the leaderboard once you choose a name.
        </p>
      </div>

      <div>
        <p className="text-sm font-medium">Color theme</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {COLOR_THEMES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => chooseColor(t.key)}
              aria-label={t.label}
              aria-pressed={color === t.key}
              title={t.label}
              style={{ backgroundColor: t.swatch }}
              className={`h-9 w-9 rounded-full ring-offset-2 ring-offset-white dark:ring-offset-neutral-950 ${
                color === t.key ? "ring-2 ring-gray-900 dark:ring-white" : ""
              }`}
            />
          ))}
        </div>

        <details open={moreStartsOpen} className="group mt-4 rounded-lg border border-gray-200 dark:border-gray-800">
          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium">
            <span className="mr-2 inline-block text-gray-400 transition-transform group-open:rotate-90">▸</span>
            More colors
          </summary>
          <div className="space-y-4 border-t border-gray-200 px-3 py-4 dark:border-gray-800">
            <div>
              <label htmlFor="hue" className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Color
              </label>
              <input
                id="hue"
                type="range"
                min={0}
                max={359}
                value={point.hue}
                onChange={(e) => chooseColor(customValue(Number(e.target.value), point.bright))}
                className="hue-slider mt-2 w-full cursor-pointer"
                style={{
                  background:
                    "linear-gradient(to right, hsl(0 85% 45%), hsl(60 85% 45%), hsl(120 85% 38%), hsl(180 85% 38%), hsl(240 85% 52%), hsl(300 85% 45%), hsl(359 85% 45%))",
                }}
              />
            </div>
            <div>
              <label htmlFor="bright" className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Brightness
              </label>
              <input
                id="bright"
                type="range"
                min={0}
                max={100}
                value={point.bright}
                onChange={(e) => chooseColor(customValue(point.hue, Number(e.target.value)))}
                className="hue-slider mt-2 w-full cursor-pointer"
                style={{
                  background: `linear-gradient(to right, hsl(${point.hue} 95% 18%), hsl(${point.hue} 90% 45%))`,
                }}
              />
            </div>
            <div className="flex h-6 overflow-hidden rounded">
              {SHADES.map((sh) => (
                <div key={sh} className="flex-1" style={{ backgroundColor: `rgb(var(--brand-${sh}))` }} />
              ))}
            </div>
          </div>
        </details>
        <p className="mt-3 text-sm font-medium">Appearance</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["system", "Match my device"],
              ["light", "Light"],
              ["dark", "Dark"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => chooseMode(key)}
              aria-pressed={mode === key}
              className={`rounded-full border px-4 py-1.5 text-sm ${
                mode === key
                  ? "border-brand-700 bg-brand-700 text-white"
                  : "border-gray-300 dark:border-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Press Save to keep your choices on every device.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={jumpscares}
          onChange={(e) => setJumpscares(e.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span>
          <span className="text-sm font-medium">Enable jump scares in tutor mode</span>
          <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
            Off by default. When on, a loud, sudden image and sound can very rarely appear while
            you study in tutor mode. It never happens in exam modes, and not if your device is set
            to reduce motion.
          </span>
        </span>
      </label>

      {msg && (
        <p
          className={`rounded p-3 text-sm ${
            msg.ok
              ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-200"
              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200"
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="border-t border-gray-200 pt-4 dark:border-gray-800">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("open-tutorial"))}
          className="text-sm text-gray-700 underline underline-offset-4 dark:text-gray-300"
        >
          Show the tutorial again
        </button>
      </div>

      <button
        onClick={save}
        disabled={busy}
        className="rounded-lg bg-black px-5 py-2.5 text-white disabled:opacity-40 dark:bg-white dark:text-black"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
