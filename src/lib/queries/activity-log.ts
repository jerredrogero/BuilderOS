import { createClient } from "@/lib/supabase/server";

export async function getActivityLog(homeId: string, limit = 50) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_log")
    .select("*, profiles(full_name, email)")
    .eq("home_id", homeId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data || [];
}
