"use server";

import { createClient } from "@/lib/supabase/server";
import { calculateCompletion } from "@/lib/utils/completion";
import { revalidatePath } from "next/cache";

export async function markItemComplete(homeId: string, itemId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Verify buyer has home_assignment for this home
  const { data: assignment } = await supabase
    .from("home_assignments")
    .select("id")
    .eq("home_id", homeId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!assignment) throw new Error("Access denied");

  // Get item type
  const { data: item, error: itemError } = await supabase
    .from("home_items")
    .select("type")
    .eq("id", itemId)
    .eq("home_id", homeId)
    .single();

  if (itemError || !item) throw new Error("Item not found");

  const updates: Record<string, unknown> = { status: "complete" };
  if (item.type === "warranty") {
    updates.registration_status = "registered";
  }

  const { error: updateError } = await supabase
    .from("home_items")
    .update(updates)
    .eq("id", itemId)
    .eq("home_id", homeId);

  if (updateError) throw new Error("Failed to update item");

  // Recalculate completion
  const { data: allItems } = await supabase
    .from("home_items")
    .select("is_critical, status")
    .eq("home_id", homeId);

  const completion = calculateCompletion(allItems || []);

  // Get current handoff_status
  const { data: home } = await supabase
    .from("homes")
    .select("handoff_status, builder_id")
    .eq("id", homeId)
    .single();

  if (!home) throw new Error("Home not found");

  const homeUpdates: Record<string, unknown> = { completion_pct: completion };
  if (completion === 100) {
    homeUpdates.handoff_status = "completed";
  } else if (home.handoff_status === "activated") {
    homeUpdates.handoff_status = "engaged";
  }

  await supabase.from("homes").update(homeUpdates).eq("id", homeId);

  // Log activity
  await supabase.from("activity_log").insert({
    builder_id: home.builder_id,
    home_id: homeId,
    home_item_id: itemId,
    actor_type: "user",
    actor_id: user.id,
    action: "item_completed",
    metadata: { item_type: item.type },
  });

  revalidatePath(`/home/${homeId}`);
  revalidatePath(`/home/${homeId}/items/${itemId}`);
}

export async function uploadProofFile(
  homeId: string,
  itemId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Verify buyer has home_assignment for this home
  const { data: assignment } = await supabase
    .from("home_assignments")
    .select("id")
    .eq("home_id", homeId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!assignment) throw new Error("Access denied");

  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");

  if (file.size > 25 * 1024 * 1024) {
    throw new Error("File too large. Maximum 25MB.");
  }

  // Get builder_id from home
  const { data: home } = await supabase
    .from("homes")
    .select("builder_id")
    .eq("id", homeId)
    .single();

  if (!home) throw new Error("Home not found");

  const storagePath = `${home.builder_id}/${homeId}/${itemId}/proof-${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, file);

  if (uploadError) throw new Error("Failed to upload file");

  // Create file record
  const { data: fileRecord, error: dbError } = await supabase
    .from("files")
    .insert({
      builder_id: home.builder_id,
      home_id: homeId,
      home_item_id: itemId,
      uploaded_by: user.id,
      storage_path: storagePath,
      filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select("id")
    .single();

  if (dbError || !fileRecord) throw new Error("Failed to save file record");

  // Link proof file to home_item
  await supabase
    .from("home_items")
    .update({ proof_file_id: fileRecord.id })
    .eq("id", itemId)
    .eq("home_id", homeId);

  // Log activity
  await supabase.from("activity_log").insert({
    builder_id: home.builder_id,
    home_id: homeId,
    home_item_id: itemId,
    actor_type: "user",
    actor_id: user.id,
    action: "proof_uploaded",
    metadata: { filename: file.name },
  });

  revalidatePath(`/home/${homeId}`);
  revalidatePath(`/home/${homeId}/items/${itemId}`);
}
