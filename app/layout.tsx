import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
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

  let displayName: string | null = null;
  let avatarUrl: string | null = null;
  if (user) {
    const { data: prof } = await supabase
      .from("student_profiles")
      .select("display_name, avatar_path")
      .eq("user_id", user.id)
      .maybeSingle();
    displayName = prof?.display_name ?? null;
    if (prof?.avatar_path) {
      const { data: signed } = await supabase.storage
        .from("avatars")
        .createSignedUrl(prof.avatar_path, 3600);
      avatarUrl = signed?.signedUrl ?? null;
    }
  }
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SiteHeader email={user?.email ?? null} displayName={displayName} avatarUrl={avatarUrl} />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
