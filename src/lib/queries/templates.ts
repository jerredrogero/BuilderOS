import { createClient } from "@/lib/supabase/server";
import { getCurrentBuilder } from "@/lib/queries/builders";

export async function getTemplates() {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context) return null;

  const { data, error } = await supabase
    .from("templates")
    .select("*, template_items(count)")
    .eq("builder_id", context.builder.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Failed to fetch templates");
  return data;
}

export async function getTemplate(templateId: string) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context) return null;

  const { data, error } = await supabase
    .from("templates")
    .select("*, template_items(*)")
    .eq("id", templateId)
    .eq("builder_id", context.builder.id)
    .order("sort_order", { ascending: true, referencedTable: "template_items" })
    .single();

  if (error) throw new Error("Failed to fetch template");
  return data;
}
