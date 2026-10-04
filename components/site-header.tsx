"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/avatar";

export default function SiteHeader({
  email,
  displayName,
  avatarUrl,
  isAdmin,
}: {
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  async function logout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  if (!email) return null;
  const shownName = displayName ?? email.split("@")[0];

  return (
    <header className="border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-sm font-semibold">Qbank</Link>
        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <Link href="/performance" className="hover:underline">Performance</Link>
          <Link href="/leaderboard" className="hover:underline">Leaderboard</Link>
          {isAdmin && <Link href="/admin" className="hover:underline">Admin</Link>}
          <Link href="/profile" className="flex items-center gap-2 hover:underline" title="Your profile">
            <Avatar url={avatarUrl} name={shownName} size={28} />
            <span className="hidden sm:inline">{shownName}</span>
          </Link>
          <button
            onClick={logout}
            className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}