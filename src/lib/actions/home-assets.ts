"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBuilder } from "@/lib/queries/builders";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createHomeAsset(homeId: string, formData: FormData) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context || context.role !== "owner") throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("home_assets")
    .insert({
      home_id: homeId,
      builder_id: context.builder.id,
      category: formData.get("category") as string,
      name: formData.get("name") as string,
      manufacturer: formData.get("manufacturer") as string || null,
      model_number: formData.get("modelNumber") as string || null,
      serial_number: formData.get("serialNumber") as string || null,
      install_date: formData.get("installDate") as string || null,
      location: formData.get("location") as string || null,
    })
    .select()
    .single();

  if (error) throw new Error("Failed to create asset");

  await supabase.from("activity_log").insert({
    builder_id: context.builder.id,
    home_id: homeId,
    actor_type: "user",
    actor_id: context.userId,
    action: "asset_created",
    metadata: { asset_id: data.id, name: data.name },
  });

  revalidatePath(`/homes/${homeId}/assets`);
  redirect(`/homes/${homeId}/assets/${data.id}`);
}

export async function updateHomeAsset(homeId: string, assetId: string, formData: FormData) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context || context.role !== "owner") throw new Error("Unauthorized");

  const { error } = await supabase
    .from("home_assets")
    .update({
      category: formData.get("category") as string,
      name: formData.get("name") as string,
      manufacturer: formData.get("manufacturer") as string || null,
      model_number: formData.get("modelNumber") as string || null,
      serial_number: formData.get("serialNumber") as string || null,
      install_date: formData.get("installDate") as string || null,
      location: formData.get("location") as string || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assetId)
    .eq("builder_id", context.builder.id);

  if (error) throw new Error("Failed to update asset");

  revalidatePath(`/homes/${homeId}/assets/${assetId}`);
  revalidatePath(`/homes/${homeId}/assets`);
}

export async function deleteHomeAsset(homeId: string, assetId: string) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context || context.role !== "owner") throw new Error("Unauthorized");

  const { error } = await supabase
    .from("home_assets")
    .delete()
    .eq("id", assetId)
    .eq("builder_id", context.builder.id);

  if (error) throw new Error("Failed to delete asset");

  revalidatePath(`/homes/${homeId}/assets`);
  redirect(`/homes/${homeId}/assets`);
}

export async function linkItemToAsset(homeId: string, itemId: string, assetId: string) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context || context.role !== "owner") throw new Error("Unauthorized");

  const { error } = await supabase
    .from("home_items")
    .update({ home_asset_id: assetId, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("home_id", homeId);

  if (error) throw new Error("Failed to link item to asset");

  revalidatePath(`/homes/${homeId}/assets/${assetId}`);
}

export async function uploadAssetPhoto(homeId: string, assetId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");
  if (file.size > 25 * 1024 * 1024) throw new Error("File too large. Maximum 25MB.");

  const { data: asset } = await supabase
    .from("home_assets")
    .select("builder_id")
    .eq("id", assetId)
    .single();

  if (!asset) throw new Error("Asset not found");

  const storagePath = `${asset.builder_id}/${homeId}/assets/${assetId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, file);

  if (uploadError) throw new Error("Failed to upload file");

  const { error: dbError } = await supabase
    .from("files")
    .insert({
      builder_id: asset.builder_id,
      home_id: homeId,
      home_asset_id: assetId,
      uploaded_by: user.id,
      storage_path: storagePath,
      filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    });

  if (dbError) throw new Error("Failed to save file record");

  await supabase.from("activity_log").insert({
    builder_id: asset.builder_id,
    home_id: homeId,
    actor_type: "user",
    actor_id: user.id,
    action: "asset_photo_uploaded",
    metadata: { asset_id: assetId, filename: file.name },
  });

  revalidatePath(`/homes/${homeId}/assets/${assetId}`);
  revalidatePath(`/home/${homeId}/assets/${assetId}`);
}
