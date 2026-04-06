"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function uploadFile(homeId: string, itemId: string | null, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

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

  const storagePath = `${home.builder_id}/${homeId}/${itemId || "general"}/${Date.now()}-${file.name}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, file);

  if (uploadError) {
    throw new Error("Failed to upload file");
  }

  // Create file record
  const { error: dbError } = await supabase
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
    });

  if (dbError) {
    throw new Error("Failed to save file record");
  }

  // Log activity
  await supabase.from("activity_log").insert({
    builder_id: home.builder_id,
    home_id: homeId,
    home_item_id: itemId,
    actor_type: "user",
    actor_id: user.id,
    action: "file_uploaded",
    metadata: { filename: file.name },
  });

  revalidatePath(`/homes/${homeId}`);
  revalidatePath(`/home/${homeId}`);
  revalidatePath(`/home/${homeId}/documents`);
}

export async function getFileUrl(storagePath: string) {
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("documents")
    .createSignedUrl(storagePath, 3600);
  return data?.signedUrl || null;
}
