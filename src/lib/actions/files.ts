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

  // Verify user has access: must be a builder member OR an assigned buyer
  const { data: builderMember } = await supabase
    .from("memberships")
    .select("role")
    .eq("builder_id", home.builder_id)
    .eq("user_id", user.id)
    .single();

  if (!builderMember) {
    // Check if user is an assigned buyer for this home
    const { data: assignment } = await supabase
      .from("home_assignments")
      .select("id")
      .eq("home_id", homeId)
      .eq("user_id", user.id)
      .single();

    if (!assignment) {
      throw new Error("You do not have access to upload files for this home");
    }
  }

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Verify user has access to this file via RLS-protected query
  const { data: file } = await supabase
    .from("files")
    .select("id")
    .eq("storage_path", storagePath)
    .single();

  if (!file) throw new Error("File not found or access denied");

  const { data } = await supabase.storage
    .from("documents")
    .createSignedUrl(storagePath, 3600);
  return data?.signedUrl || null;
}

export async function deleteFile(fileId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // RLS on files table enforces that only authorized users can see this record
  const { data: file } = await supabase
    .from("files")
    .select("storage_path, home_id, builder_id")
    .eq("id", fileId)
    .single();

  if (!file) throw new Error("File not found or access denied");

  // Verify user is a builder owner (only owners can delete)
  const { data: member } = await supabase
    .from("memberships")
    .select("role")
    .eq("builder_id", file.builder_id)
    .eq("user_id", user.id)
    .single();

  if (!member || member.role !== "owner") {
    throw new Error("Only builder owners can delete files");
  }

  // Delete from storage
  await supabase.storage.from("documents").remove([file.storage_path]);

  // Delete DB record
  await supabase.from("files").delete().eq("id", fileId);

  if (file.home_id) {
    revalidatePath(`/homes/${file.home_id}`);
    revalidatePath(`/home/${file.home_id}`);
    revalidatePath(`/home/${file.home_id}/documents`);
  }
}
