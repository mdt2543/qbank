import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function Home() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: qbanks, error } = await supabase
    .from("qbanks")
    .select("slug, title, description");

  const { count } = await supabase
    .from("v_question")
    .select("*", { count: "exact", head: true });

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Question banks</h1>
      <p className="mt-1 text-sm text-gray-500">Signed in as {user.email}</p>

      {error && (
        <p className="mt-6 rounded bg-red-50 p-3 text-sm text-red-700">
          {error.message}
        </p>
      )}

      <div className="mt-8 space-y-3">
        {qbanks?.length ? (
          qbanks.map((qb) => (
            <Link
              key={qb.slug}
              href={`/qbank/${qb.slug}`}
              className="block rounded-lg border p-5 hover:bg-gray-50"
            >
              <div className="font-medium">{qb.title}</div>
              <div className="mt-1 text-sm text-gray-500">
                {count ?? 0} questions
              </div>
            </Link>
          ))
        ) : (
          <p className="text-sm text-gray-500">
            No published question banks found.
          </p>
        )}
      </div>
    </main>
  );
}