import { createClient } from "@/lib/supabase/server";

export async function getInspectionReports(homeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inspection_reports")
    .select("*, inspection_findings(count)")
    .eq("home_id", homeId)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function getInspectionReport(reportId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inspection_reports")
    .select("*, inspection_findings(*, home_assets(name, category))")
    .eq("id", reportId)
    .single();
  return data;
}
