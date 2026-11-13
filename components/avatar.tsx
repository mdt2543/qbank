/* eslint-disable @next/next/no-img-element */
import AnimalIcon from "@/components/animal-icon";

// A student's picture: their uploaded photo, or else their chosen animal (a platypus until they pick one).
export default function Avatar({
  url,
  animal = null,
  size = 32,
}: {
  url: string | null;
  animal?: string | null;
  name?: string;
  size?: number;
}) {
  const box = { width: size, height: size };
  return url ? (
    <img src={url} alt="" style={box} className="shrink-0 rounded-full object-cover" />
  ) : (
    <AnimalIcon animal={animal} size={size} />
  );
}
