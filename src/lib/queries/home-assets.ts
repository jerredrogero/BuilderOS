import { createClient } from "@/lib/supabase/server";

export async function getHomeAssets(homeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("home_assets")
    .select("*")
    .eq("home_id", homeId)
    .order("category", { ascending: true });
  return data || [];
}

export async function getHomeAsset(assetId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("home_assets")
    .select(`
      *,
      home_items(id, type, title, status, is_critical, registration_status, registration_deadline, due_date),
      files(id, filename, mime_type, size_bytes, storage_path, created_at)
    `)
    .eq("id", assetId)
    .single();
  return data;
}

export async function getHomeAssetsWithCounts(homeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("home_assets")
    .select("*, home_items(count), files(count)")
    .eq("home_id", homeId)
    .order("category", { ascending: true });
  return data || [];
}
