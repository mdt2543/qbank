import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./profile-form";

export default async function Profile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: prof } = await supabase
    .from("student_profiles")
    .select("display_name, avatar_path")
    .eq("user_id", user.id)
    .maybeSingle();

  // separate query so the page still works before the jumpscares column exists
  const { data: js } = await supabase
    .from("student_profiles")
    .select("jumpscares")
    .eq("user_id", user.id)
    .maybeSingle();

  let avatarUrl: string | null = null;
  if (prof?.avatar_path) {
    const { data } = await supabase.storage.from("avatars").createSignedUrl(prof.avatar_path, 3600);
    avatarUrl = data?.signedUrl ?? null;
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <Link href="/" className="text-sm text-gray-500 hover:underline dark:text-gray-400">
        ← All banks
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Your profile</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Your display name and picture appear on the{" "}
        <Link href="/leaderboard" className="underline">leaderboard</Link> next to your total
        questions answered. Nothing else about you is shown to other students.
      </p>
      <ProfileForm
        userId={user.id}
        email={user.email ?? ""}
        initialName={prof?.display_name ?? ""}
        initialPath={prof?.avatar_path ?? null}
        initialUrl={avatarUrl}
        initialJumpscares={js?.jumpscares ?? false}
      />
    </main>
  );
}
