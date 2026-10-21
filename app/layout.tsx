import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import TutorialGate from "@/components/tutorial-gate";
import ThemeSync from "@/components/theme-sync";
import { asAppearance, asColorTheme, DEFAULT_COLOR_THEME } from "@/lib/color-themes";
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Qbank",
  description: "Practice question banks",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isAdmin = false;
  let showTutorial = false;
  let displayName: string | null = null;
  let avatarUrl: string | null = null;
  let colorTheme: string = DEFAULT_COLOR_THEME;
  let appearance: "light" | "dark" | null = null;
  if (user) {
    // the Admin link is only ever rendered for admins
    const { data: admin } = await supabase.rpc("is_site_admin");
    isAdmin = admin === true;
    // only an explicit "no" shows the tour; an error (e.g. SQL not run yet) means "don't"
    const { data: seen } = await supabase.rpc("has_seen_tutorial");
    showTutorial = seen === false;
    const { data: prof } = await supabase
      .from("student_profiles")
      .select("display_name, avatar_path")
      .eq("user_id", user.id)
      .maybeSingle();
    displayName = prof?.display_name ?? null;
    // separate query: if the columns don't exist yet the defaults apply
    const { data: look } = await supabase
      .from("student_profiles")
      .select("color_theme, appearance")
      .eq("user_id", user.id)
      .maybeSingle();
    colorTheme = asColorTheme(look?.color_theme);
    appearance = asAppearance(look?.appearance);
    if (prof?.avatar_path) {
      const { data: signed } = await supabase.storage
        .from("avatars")
        .createSignedUrl(prof.avatar_path, 3600);
      avatarUrl = signed?.signedUrl ?? null;
    }
  }
  return (
    <html lang="en" data-theme={colorTheme} suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ThemeSync appearance={appearance} />
          <SiteHeader email={user?.email ?? null} displayName={displayName} avatarUrl={avatarUrl} isAdmin={isAdmin} />
          {children}
          {user && <TutorialGate show={showTutorial} />}
        </ThemeProvider>
      </body>
    </html>
  );
}
