"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBuilder } from "@/lib/queries/builders";
import { calculateCompletion } from "@/lib/utils/completion";
import { revalidatePath } from "next/cache";

export async function updateHomeItemStatus(
  homeId: string,
  itemId: string,
  status: string
) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context) throw new Error("Unauthorized");

  // Fetch item to check type
  const { data: item, error: fetchError } = await supabase
    .from("home_items")
    .select("type")
    .eq("id", itemId)
    .eq("home_id", homeId)
    .single();

  if (fetchError || !item) throw new Error("Item not found");

  const updates: Record<string, unknown> = { status };
  if (item.type === "warranty" && status === "complete") {
    updates.registration_status = "registered";
  }

  const { error: updateError } = await supabase
    .from("home_items")
    .update(updates)
    .eq("id", itemId)
    .eq("home_id", homeId);

  if (updateError) throw new Error("Failed to update item status");

  // Recalculate completion
  const { data: allItems } = await supabase
    .from("home_items")
    .select("is_critical, status")
    .eq("home_id", homeId);

  const completion = calculateCompletion(allItems || []);

  const homeUpdates: Record<string, unknown> = { completion_pct: completion };
  if (completion === 100) {
    homeUpdates.handoff_status = "completed";
  }

  await supabase
    .from("homes")
    .update(homeUpdates)
    .eq("id", homeId)
    .eq("builder_id", context.builder.id);

  // Log activity
  await supabase.from("activity_log").insert({
    builder_id: context.builder.id,
    home_id: homeId,
    home_item_id: itemId,
    actor_type: "user",
    actor_id: context.userId,
    action: "item_status_changed",
    metadata: { status },
  });

  revalidatePath(`/homes/${homeId}`);
}

export async function updateHomeItem(
  homeId: string,
  itemId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context || context.role !== "owner") throw new Error("Unauthorized");

  // Fetch item to check type
  const { data: item, error: fetchError } = await supabase
    .from("home_items")
    .select("type")
    .eq("id", itemId)
    .eq("home_id", homeId)
    .single();

  if (fetchError || !item) throw new Error("Item not found");

  const updates: Record<string, unknown> = {
    title: formData.get("title") as string,
    description: formData.get("description") as string,
    category: formData.get("category") as string,
    is_critical: formData.get("is_critical") === "true",
  };

  if (item.type === "warranty") {
    updates.manufacturer = formData.get("manufacturer") as string;
    updates.model_number = formData.get("model_number") as string;
    updates.serial_number = formData.get("serial_number") as string;
    updates.registration_url = formData.get("registration_url") as string;
  }

  const { error } = await supabase
    .from("home_items")
    .update(updates)
    .eq("id", itemId)
    .eq("home_id", homeId);

  if (error) throw new Error("Failed to update item");

  revalidatePath(`/homes/${homeId}`);
}

export async function deleteHomeItem(homeId: string, itemId: string) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context || context.role !== "owner") throw new Error("Unauthorized");

  const { error } = await supabase
    .from("home_items")
    .delete()
    .eq("id", itemId)
    .eq("home_id", homeId);

  if (error) throw new Error("Failed to delete item");

  revalidatePath(`/homes/${homeId}`);
}
