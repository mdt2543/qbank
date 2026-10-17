import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Runner from "./runner";

export default async function QbankPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  let { data: qbank } = await supabase
    .from("qbanks")
    .select("slug, title")
    .eq("slug", slug)
    .single();

  // Hidden banks are not readable by students. An admin can still open them: this
  // function returns nothing for anyone else.
  let hidden = false;
  if (!qbank) {
    const { data: info } = await supabase.rpc("admin_bank_info", { p_slug: slug });
    const row = (info as { slug: string; title: string; is_published: boolean }[] | null)?.[0];
    if (row) {
      qbank = { slug: row.slug, title: row.title };
      hidden = !row.is_published;
    }
  }

  if (!qbank) notFound();

  // opt-in setting; any error (e.g. column not created yet) means "off"
  const { data: prefs } = await supabase
    .from("student_profiles")
    .select("jumpscares")
    .eq("user_id", user.id)
    .maybeSingle();

  return <Runner
      slug={qbank.slug}
      title={qbank.title}
      userId={user.id}
      jumpscares={prefs?.jumpscares ?? false}
      hidden={hidden}
    />;
}