"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createDraftAsset(homeId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: assignment } = await supabase
    .from("home_assignments")
    .select("*")
    .eq("home_id", homeId)
    .eq("user_id", user.id)
    .single();

  if (!assignment) throw new Error("Access denied");

  const { data: home } = await supabase
    .from("homes")
    .select("builder_id")
    .eq("id", homeId)
    .single();

  if (!home) throw new Error("Home not found");

  const { data: asset, error } = await supabase
    .from("home_assets")
    .insert({
      home_id: homeId,
      builder_id: home.builder_id,
      category: formData.get("category") as string || "Other",
      name: formData.get("name") as string,
      manufacturer: formData.get("manufacturer") as string || null,
      model_number: formData.get("modelNumber") as string || null,
      serial_number: formData.get("serialNumber") as string || null,
      location: formData.get("location") as string || null,
    })
    .select()
    .single();

  if (error) throw new Error("Failed to create asset");

  await supabase.from("activity_log").insert({
    builder_id: home.builder_id,
    home_id: homeId,
    actor_type: "user",
    actor_id: user.id,
    action: "buyer_asset_created",
    metadata: { asset_id: asset.id, name: asset.name },
  });

  revalidatePath(`/home/${homeId}/assets`);
  redirect(`/home/${homeId}/assets/${asset.id}`);
}

export async function updateAssetFromBuyer(homeId: string, assetId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: assignment } = await supabase
    .from("home_assignments")
    .select("*")
    .eq("home_id", homeId)
    .eq("user_id", user.id)
    .single();

  if (!assignment) throw new Error("Access denied");

  const { error } = await supabase
    .from("home_assets")
    .update({
      manufacturer: formData.get("manufacturer") as string || null,
      model_number: formData.get("modelNumber") as string || null,
      serial_number: formData.get("serialNumber") as string || null,
      location: formData.get("location") as string || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assetId);

  if (error) throw new Error("Failed to update asset");

  revalidatePath(`/home/${homeId}/assets/${assetId}`);
}

export async function uploadBuyerAssetPhoto(homeId: string, assetId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: assignment } = await supabase
    .from("home_assignments")
    .select("*")
    .eq("home_id", homeId)
    .eq("user_id", user.id)
    .single();

  if (!assignment) throw new Error("Access denied");

  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");
  if (file.size > 25 * 1024 * 1024) throw new Error("File too large");

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

  if (uploadError) throw new Error("Failed to upload photo");

  await supabase.from("files").insert({
    builder_id: asset.builder_id,
    home_id: homeId,
    home_asset_id: assetId,
    uploaded_by: user.id,
    storage_path: storagePath,
    filename: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  });

  await supabase.from("activity_log").insert({
    builder_id: asset.builder_id,
    home_id: homeId,
    actor_type: "user",
    actor_id: user.id,
    action: "buyer_asset_photo_uploaded",
    metadata: { asset_id: assetId, filename: file.name },
  });

  revalidatePath(`/home/${homeId}/assets/${assetId}`);
}
