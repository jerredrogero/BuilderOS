import { createClient } from "@/lib/supabase/server";
import { getCurrentBuilder } from "./builders";

export async function getHomes(filters?: { projectId?: string; status?: string }) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context) return [];

  let query = supabase
    .from("homes")
    .select("*, projects(name), invitations(status)")
    .eq("builder_id", context.builder.id)
    .order("created_at", { ascending: false });

  if (filters?.projectId) {
    query = query.eq("project_id", filters.projectId);
  }

  if (filters?.status) {
    query = query.eq("handoff_status", filters.status);
  }

  const { data } = await query;
  return data || [];
}

export async function getHome(homeId: string) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context) return null;

  const { data } = await supabase
    .from("homes")
    .select("*, projects(name), home_items(*), invitations(*), home_assignments(*, profiles(full_name, email))")
    .eq("id", homeId)
    .eq("builder_id", context.builder.id)
    .single();

  return data;
}
