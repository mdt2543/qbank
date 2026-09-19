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

  const { data: qbank } = await supabase
    .from("qbanks")
    .select("slug, title")
    .eq("slug", slug)
    .single();

  if (!qbank) notFound();

  return <Runner slug={qbank.slug} title={qbank.title} />;
}