import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { JobDetailClient } from "./job-detail-client";
import type { Job } from "@/lib/types";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const { data: job, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !job) redirect("/dashboard");

  return <JobDetailClient job={job as Job} />;
}
