import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Avatar from "@/components/avatar";

type Entry = {
  place: number | string;
  display_name: string;
  avatar_path: string | null;
  total_questions: number | string;
  is_me: boolean;
};

export default async function Leaderboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data } = await supabase.rpc("leaderboard");
  const rows = (data ?? []) as Entry[];

  const { data: mine } = await supabase
    .from("student_profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  // pictures are private: show them through short-lived signed links
  const paths = rows.map((r) => r.avatar_path).filter((p): p is string => !!p);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("avatars").createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/" className="text-sm text-gray-500 hover:underline dark:text-gray-400">
        ← All banks
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Leaderboard</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Ranked by unique questions answered across all banks. Retaking a question doesn&apos;t
        count twice.
      </p>

      {!mine?.display_name && (
        <p className="mt-6 rounded-lg border border-indigo-300 bg-indigo-50 p-4 text-sm dark:border-indigo-800 dark:bg-indigo-950">
          You&apos;re not on the leaderboard yet.{" "}
          <Link href="/profile" className="font-medium underline">
            Choose a display name
          </Link>{" "}
          to appear.
        </p>
      )}

      <ol className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
        {rows.length === 0 && (
          <li className="p-4 text-sm text-gray-500 dark:text-gray-400">
            Nobody is on the board yet.
          </li>
        )}
        {rows.map((r, i) => {
          // the student's own row, when it sits below the top 50
          const detached = r.is_me && i > 0 && Number(r.place) > 50;
          return (
            <li
              key={`${r.place}-${r.display_name}`}
              className={`flex items-center gap-4 px-4 py-3 ${
                r.is_me ? "bg-indigo-50 dark:bg-indigo-950" : ""
              } ${detached ? "border-t-4 border-t-gray-200 dark:border-t-gray-800" : ""}`}
            >
              <span className="w-8 text-right text-sm font-semibold text-gray-500 dark:text-gray-400">
                {r.place}
              </span>
              <Avatar
                url={r.avatar_path ? urls.get(r.avatar_path) ?? null : null}
                name={r.display_name}
                size={36}
              />
              <span className="flex-1 truncate font-medium">
                {r.display_name}
                {r.is_me && <span className="ml-2 text-xs font-normal text-gray-500">you</span>}
              </span>
              <span className="text-sm tabular-nums">{r.total_questions}</span>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
