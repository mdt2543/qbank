// Drawn animal icons used as the profile picture for students without a photo. Everyone starts
// as a platypus until they pick another animal (saved as student_profiles.avatar_animal).

export const ANIMALS = [
  { key: "platypus", label: "Platypus" },
  { key: "koala", label: "Koala" },
  { key: "fox", label: "Fox" },
  { key: "wolf", label: "Wolf" },
  { key: "panda", label: "Panda" },
  { key: "owl", label: "Owl" },
  { key: "penguin", label: "Penguin" },
  { key: "frog", label: "Frog" },
  { key: "tiger", label: "Tiger" },
  { key: "bunny", label: "Bunny" },
] as const;

export type AnimalKey = (typeof ANIMALS)[number]["key"];
export const DEFAULT_ANIMAL: AnimalKey = "platypus";

export function asAnimal(v: string | null | undefined): AnimalKey {
  return ANIMALS.some((a) => a.key === v) ? (v as AnimalKey) : DEFAULT_ANIMAL;
}

export function animalLabel(v: string | null | undefined) {
  return ANIMALS.find((a) => a.key === asAnimal(v))!.label;
}

// each face is drawn on a 64x64 canvas over its own background circle
const FACES: Record<AnimalKey, { bg: string; face: React.ReactNode }> = {
  platypus: {
    bg: "#BFE6E0",
    face: (
      <>
        {/* our own med-student platypus, side view: beaver tail, round brown body in a white
            coat, flat smiling bill, big shiny eye and a rosy cheek */}
        <g transform="translate(1 -2)">
          <ellipse cx="8" cy="46" rx="9" ry="5.5" transform="rotate(-20 8 46)" fill="#6E4329" />
          <path d="M3 44 L13 41 M4 48 L14 45" stroke="#5A3622" strokeWidth="1" strokeLinecap="round" />
          <ellipse cx="17" cy="51" rx="4.5" ry="2.6" fill="#3A2618" />
          <ellipse cx="31" cy="51.5" rx="4.5" ry="2.6" fill="#3A2618" />
          <ellipse cx="24" cy="37" rx="17.5" ry="15" fill="#9C6642" />
          {/* white coat over the shoulders and body, open at the front in a V */}
          <path
            d="M7.5 34 Q24 39 41 33 Q43.5 40 40.5 46 Q34.5 53.5 24 53 Q11 52.5 7.5 45.5 Q5.5 39.5 7.5 34 Z"
            fill="#F7F8FA"
            stroke="#C9CED6"
            strokeWidth="1"
          />
          <path d="M33 35.5 L37.5 44 L41 34.5 Z" fill="#9C6642" />
          <path d="M33 35.5 L37.5 44 M41 34.5 L37.5 44" stroke="#AEB5C0" strokeWidth="1.3" strokeLinecap="round" />
          <rect x="15" y="42.5" width="7" height="5" rx="1" fill="none" stroke="#AEB5C0" strokeWidth="1.1" />
          <path d="M17.5 40.5 L17.5 44" stroke="#3B6FD8" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M35 29 Q47 25 57 28 Q64 31 62 37 Q60 43 49 42 Q41 42 36 40 Z" fill="#454C5C" />
          <path d="M37 30.5 Q47 27 57 29.5 Q61 31 60.5 33.5 Q48 30.5 37 34 Z" fill="#646D80" />
          <path d="M40 39.5 Q49 41.5 58 38.5" stroke="#2C313B" strokeWidth="1.1" fill="none" strokeLinecap="round" />
          <ellipse cx="56.5" cy="30.8" rx="1.2" ry="0.8" fill="#23272F" />
          <circle cx="29.5" cy="28.5" r="4" fill="#fff" />
          <circle cx="30.4" cy="29" r="2.7" fill="#1F1A17" />
          <circle cx="31.3" cy="27.9" r="0.95" fill="#fff" />
          <ellipse cx="31" cy="36.5" rx="2.8" ry="1.8" fill="#F29BA6" opacity="0.7" />
        </g>
      </>
    ),
  },
  fox: {
    bg: "#FFE0C2",
    face: (
      <>
        <path d="M14 14 L26 22 L18 30 Z" fill="#E8742A" />
        <path d="M50 14 L38 22 L46 30 Z" fill="#E8742A" />
        <path d="M16.5 17 L23 22 L19 26 Z" fill="#3A2A22" />
        <path d="M47.5 17 L41 22 L45 26 Z" fill="#3A2A22" />
        <path d="M14 26 Q32 14 50 26 L32 52 Z" fill="#E8742A" />
        <path d="M18 32 Q25 38 32 52 Q39 38 46 32 Q39 40 32 40 Q25 40 18 32 Z" fill="#FFF7EE" />
        <circle cx="25" cy="31" r="2" fill="#1F1A17" />
        <circle cx="39" cy="31" r="2" fill="#1F1A17" />
        <ellipse cx="32" cy="48" rx="3" ry="2.2" fill="#1F1A17" />
      </>
    ),
  },
  wolf: {
    bg: "#D6E0F0",
    face: (
      <>
        <path d="M13 10 L27 22 L16 31 Z" fill="#6E7685" />
        <path d="M51 10 L37 22 L48 31 Z" fill="#6E7685" />
        <path d="M16 15 L24 22 L18 27 Z" fill="#E9D7CF" />
        <path d="M48 15 L40 22 L46 27 Z" fill="#E9D7CF" />
        <path d="M12 28 Q14 17 32 17 Q50 17 52 28 L48 42 L32 54 L16 42 Z" fill="#7D8594" />
        <path d="M32 26 L25 38 Q24 48 32 54 Q40 48 39 38 Z" fill="#F1EEEA" />
        <path d="M16 36 Q22 40 26 44 L22 46 Z M48 36 Q42 40 38 44 L42 46 Z" fill="#F1EEEA" />
        <path d="M21 29 Q25 27 28 30 Q25 32 21 29 Z" fill="#F2B33D" />
        <path d="M43 29 Q39 27 36 30 Q39 32 43 29 Z" fill="#F2B33D" />
        <circle cx="25" cy="29.5" r="1.3" fill="#1F1A17" />
        <circle cx="39" cy="29.5" r="1.3" fill="#1F1A17" />
        <ellipse cx="32" cy="46" rx="3.4" ry="2.4" fill="#2A2C31" />
      </>
    ),
  },
  panda: {
    bg: "#D9EDD0",
    face: (
      <>
        <circle cx="18" cy="17" r="7" fill="#1F1F22" />
        <circle cx="46" cy="17" r="7" fill="#1F1F22" />
        <circle cx="32" cy="33" r="19" fill="#FAFAF7" />
        <ellipse cx="24" cy="31" rx="5" ry="6.5" transform="rotate(-25 24 31)" fill="#1F1F22" />
        <ellipse cx="40" cy="31" rx="5" ry="6.5" transform="rotate(25 40 31)" fill="#1F1F22" />
        <circle cx="24.5" cy="30.5" r="1.8" fill="#fff" />
        <circle cx="39.5" cy="30.5" r="1.8" fill="#fff" />
        <ellipse cx="32" cy="40" rx="3.2" ry="2.3" fill="#1F1F22" />
        <path d="M28.5 44 Q32 47 35.5 44" stroke="#1F1F22" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  owl: {
    bg: "#E6DDF5",
    face: (
      <>
        <path d="M16 18 L22 26 L14 28 Z" fill="#7A5236" />
        <path d="M48 18 L42 26 L50 28 Z" fill="#7A5236" />
        <ellipse cx="32" cy="36" rx="18" ry="19" fill="#9A6A45" />
        <ellipse cx="32" cy="44" rx="10" ry="9" fill="#D9B48C" />
        <circle cx="24" cy="31" r="7.5" fill="#fff" stroke="#F2A93B" strokeWidth="2" />
        <circle cx="40" cy="31" r="7.5" fill="#fff" stroke="#F2A93B" strokeWidth="2" />
        <circle cx="24" cy="31" r="3.4" fill="#1F1A17" />
        <circle cx="40" cy="31" r="3.4" fill="#1F1A17" />
        <circle cx="25.2" cy="29.8" r="1.1" fill="#fff" />
        <circle cx="41.2" cy="29.8" r="1.1" fill="#fff" />
        <path d="M29 37 L35 37 L32 42 Z" fill="#F2A93B" />
      </>
    ),
  },
  penguin: {
    bg: "#CFE5F7",
    face: (
      <>
        <circle cx="32" cy="33" r="20" fill="#23262E" />
        <path d="M32 24 Q22 18 18 28 Q16 40 32 50 Q48 40 46 28 Q42 18 32 24 Z" fill="#FAFAF7" />
        <circle cx="25.5" cy="31" r="2.2" fill="#23262E" />
        <circle cx="38.5" cy="31" r="2.2" fill="#23262E" />
        <path d="M27 37 Q32 34 37 37 Q32 42 27 37 Z" fill="#F2A33A" />
        <circle cx="21" cy="38" r="2.4" fill="#F7B6C2" opacity="0.8" />
        <circle cx="43" cy="38" r="2.4" fill="#F7B6C2" opacity="0.8" />
      </>
    ),
  },
  frog: {
    bg: "#FFF1B8",
    face: (
      <>
        <circle cx="21" cy="22" r="8" fill="#5DB353" />
        <circle cx="43" cy="22" r="8" fill="#5DB353" />
        <ellipse cx="32" cy="37" rx="21" ry="15" fill="#5DB353" />
        <circle cx="21" cy="21" r="5" fill="#fff" />
        <circle cx="43" cy="21" r="5" fill="#fff" />
        <circle cx="21.5" cy="21.5" r="2.6" fill="#1F1A17" />
        <circle cx="43.5" cy="21.5" r="2.6" fill="#1F1A17" />
        <path d="M20 39 Q32 48 44 39" stroke="#2F6B2A" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <circle cx="17" cy="36" r="3" fill="#F49BA8" opacity="0.75" />
        <circle cx="47" cy="36" r="3" fill="#F49BA8" opacity="0.75" />
        <circle cx="29" cy="33" r="0.9" fill="#2F6B2A" />
        <circle cx="35" cy="33" r="0.9" fill="#2F6B2A" />
      </>
    ),
  },
  koala: {
    bg: "#DCEBDD",
    face: (
      <>
        <circle cx="15" cy="24" r="10" fill="#9EA3A8" />
        <circle cx="49" cy="24" r="10" fill="#9EA3A8" />
        <circle cx="15" cy="24" r="5.5" fill="#F2C9CF" />
        <circle cx="49" cy="24" r="5.5" fill="#F2C9CF" />
        <ellipse cx="32" cy="35" rx="17" ry="16" fill="#B4B9BE" />
        <circle cx="25" cy="31" r="2.2" fill="#1F1F22" />
        <circle cx="39" cy="31" r="2.2" fill="#1F1F22" />
        <ellipse cx="32" cy="38" rx="5" ry="6.5" fill="#3A3C40" />
        <ellipse cx="30.5" cy="35.5" rx="1.2" ry="1.8" fill="#6B6E73" />
      </>
    ),
  },
  tiger: {
    bg: "#FFE7B3",
    face: (
      <>
        <circle cx="18" cy="18" r="6" fill="#EE8A2B" />
        <circle cx="46" cy="18" r="6" fill="#EE8A2B" />
        <circle cx="18" cy="18" r="3" fill="#FFF3E2" />
        <circle cx="46" cy="18" r="3" fill="#FFF3E2" />
        <circle cx="32" cy="34" r="19" fill="#EE8A2B" />
        <path d="M32 16 L30 22 L34 22 Z M27 17 L27 22 L29.5 21 Z M37 17 L37 22 L34.5 21 Z" fill="#2B211B" />
        <path d="M13 31 L20 32 L14 34 Z M13 37 L20 37 L14 39.5 Z M51 31 L44 32 L50 34 Z M51 37 L44 37 L50 39.5 Z" fill="#2B211B" />
        <ellipse cx="32" cy="42" rx="10" ry="8" fill="#FFF3E2" />
        <circle cx="25" cy="31" r="2.2" fill="#2B211B" />
        <circle cx="39" cy="31" r="2.2" fill="#2B211B" />
        <path d="M29.5 38 L34.5 38 L32 41 Z" fill="#E86F7E" />
        <path d="M32 41 L32 43.5 M32 43.5 Q29.5 45.5 28 44 M32 43.5 Q34.5 45.5 36 44" stroke="#2B211B" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  bunny: {
    bg: "#FBD9E2",
    face: (
      <>
        <ellipse cx="24" cy="16" rx="5" ry="13" fill="#F4F1EE" />
        <ellipse cx="40" cy="16" rx="5" ry="13" fill="#F4F1EE" />
        <ellipse cx="24" cy="17" rx="2.4" ry="9" fill="#F5B5C4" />
        <ellipse cx="40" cy="17" rx="2.4" ry="9" fill="#F5B5C4" />
        <ellipse cx="32" cy="38" rx="17" ry="15" fill="#F4F1EE" />
        <circle cx="25.5" cy="35" r="2.2" fill="#1F1A17" />
        <circle cx="38.5" cy="35" r="2.2" fill="#1F1A17" />
        <path d="M30 40 L34 40 L32 42.5 Z" fill="#E8879C" />
        <path d="M32 42.5 Q30 45 28.5 44 M32 42.5 Q34 45 35.5 44" stroke="#8C7F7A" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <circle cx="21" cy="41" r="2.6" fill="#F5B5C4" opacity="0.8" />
        <circle cx="43" cy="41" r="2.6" fill="#F5B5C4" opacity="0.8" />
      </>
    ),
  },
};

export default function AnimalIcon({
  animal,
  size = 32,
  className = "",
}: {
  animal: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const key = asAnimal(animal);
  const { bg, face } = FACES[key];
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label={animalLabel(key)}
      className={`shrink-0 rounded-full ${className}`}
    >
      <clipPath id={`animal-clip-${key}`}>
        <circle cx="32" cy="32" r="32" />
      </clipPath>
      <g clipPath={`url(#animal-clip-${key})`}>
        <rect width="64" height="64" fill={bg} />
        {face}
      </g>
    </svg>
  );
}
