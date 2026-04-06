import { createClient } from "@/lib/supabase/server";
import { getCurrentBuilder } from "@/lib/queries/builders";

export async function getProjects() {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context) return null;

  const { data, error } = await supabase
    .from("projects")
    .select("*, homes(count)")
    .eq("builder_id", context.builder.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Failed to fetch projects");
  return data;
}

export async function getProject(projectId: string) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context) return null;

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("builder_id", context.builder.id)
    .single();

  if (error) throw new Error("Failed to fetch project");
  return data;
}
