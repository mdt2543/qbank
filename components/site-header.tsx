"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/avatar";
import { ChartColumn, LogOut, ShieldCheck, Trophy } from "lucide-react";

export default function SiteHeader({
  email,
  displayName,
  avatarUrl,
  avatarAnimal = null,
  isAdmin,
}: {
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  avatarAnimal?: string | null;
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
  const item = "rounded p-2 hover:bg-gray-100 sm:p-0 sm:hover:bg-transparent sm:hover:underline dark:hover:bg-gray-800 sm:dark:hover:bg-transparent";

  return (
    <header className="border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="text-sm font-semibold">teterqbank</Link>
        {/* phones show icons only; the words come back on wider screens */}
        <div className="flex items-center gap-1 text-sm text-gray-500 sm:gap-3 dark:text-gray-400">
          <Link href="/performance" className={item} title="Performance">
            <ChartColumn size={18} className="sm:hidden" />
            <span className="hidden sm:inline">Performance</span>
          </Link>
          <Link href="/leaderboard" className={item} title="Leaderboard">
            <Trophy size={18} className="sm:hidden" />
            <span className="hidden sm:inline">Leaderboard</span>
          </Link>
          {isAdmin && (
            <Link href="/admin" className={item} title="Admin">
              <ShieldCheck size={18} className="sm:hidden" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
          <Link href="/profile" className="flex items-center gap-2 p-1 hover:underline sm:p-0" title="Your profile">
            <Avatar url={avatarUrl} animal={avatarAnimal} size={28} />
            <span className="hidden sm:inline">{shownName}</span>
          </Link>
          <button
            onClick={logout}
            title="Log out"
            className="ml-1 rounded border border-gray-300 p-1.5 hover:bg-gray-50 sm:ml-0 sm:px-3 sm:py-1 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <LogOut size={16} className="sm:hidden" />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </div>
    </header>
  );
}