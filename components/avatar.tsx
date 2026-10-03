/* eslint-disable @next/next/no-img-element */
export default function Avatar({
  url,
  name,
  size = 32,
}: {
  url: string | null;
  name: string;
  size?: number;
}) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";
  const box = { width: size, height: size };

  return url ? (
    <img src={url} alt="" style={box} className="shrink-0 rounded-full object-cover" />
  ) : (
    <span
      style={{ ...box, fontSize: size * 0.4 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-indigo-600 font-medium text-white"
    >
      {initials}
    </span>
  );
}
