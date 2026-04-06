import { createClient } from "@/lib/supabase/server";

export async function getHomeFiles(homeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("files")
    .select("*")
    .eq("home_id", homeId)
    .order("created_at", { ascending: false });
  return data || [];
}
