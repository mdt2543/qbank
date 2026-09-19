import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function Home() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: qbanks } = await supabase
    .from("qbanks")
    .select("slug, title, description");

  const { count } = await supabase
    .from("v_question")
    .select("*", { count: "exact", head: true });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Question banks</h1>

      <div className="mt-8 space-y-3">
        {qbanks?.length ? (
          qbanks.map((qb) => (
            <Link
              key={qb.slug}
              href={`/qbank/${qb.slug}`}
              className="block rounded-lg border border-gray-200 p-5 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
            >
              <div className="font-medium">{qb.title}</div>
              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {count ?? 0} questions
              </div>
            </Link>
          ))
        ) : (
          <p className="text-sm text-gray-500">No published question banks found.</p>
        )}
      </div>
    </main>
  );
}