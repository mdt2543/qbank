"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

// Applies the light/dark choice saved on the student's profile (so it follows them to any
// device). With no saved choice it does nothing and the device setting applies.
export default function ThemeSync({ appearance }: { appearance: "light" | "dark" | null }) {
  const { setTheme } = useTheme();
  useEffect(() => {
    if (appearance) setTheme(appearance);
  }, [appearance, setTheme]);
  return null;
}
