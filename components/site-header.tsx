"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SiteHeader({ email }: { email: string | null }) {
  const router = useRouter();
  const supabase = createClient();

  async function logout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  if (!email) return null;

  return (
    <header className="border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-sm font-semibold">Qbank</Link>
        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <Link href="/performance" className="hover:underline">Performance</Link>
          <span className="hidden sm:inline">{email}</span>
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