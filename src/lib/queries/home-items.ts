import { createClient } from "@/lib/supabase/server";

export async function getHomeItems(homeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("home_items")
    .select("*, files(*)")
    .eq("home_id", homeId)
    .order("sort_order");
  return data || [];
}
