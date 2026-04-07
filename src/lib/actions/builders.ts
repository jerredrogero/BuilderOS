"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBuilder } from "@/lib/queries/builders";
import { revalidatePath } from "next/cache";

export async function updateBuilderSettings(formData: FormData) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();

  if (!context || context.role !== "owner") {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("builders")
    .update({
      name: formData.get("name") as string,
      primary_color: formData.get("primaryColor") as string,
      accent_color: formData.get("accentColor") as string,
      contact_email: formData.get("contactEmail") as string,
      contact_phone: formData.get("contactPhone") as string,
      welcome_message: formData.get("welcomeMessage") as string,
      updated_at: new Date().toISOString(),
    })
    .eq("id", context.builder.id);

  if (error) {
    throw new Error("Failed to update settings");
  }

  revalidatePath("/settings");
}

export async function uploadLogo(formData: FormData) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();

  if (!context || context.role !== "owner") {
    throw new Error("Unauthorized");
  }

  const file = formData.get("logo") as File;
  if (!file || file.size === 0) throw new Error("No file provided");

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("File too large. Maximum 5MB.");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image file.");
  }

  const ext = file.name.split(".").pop() ?? "png";
  const storagePath = `${context.builder.id}/logo-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, file, { upsert: true });

  if (uploadError) {
    throw new Error("Failed to upload logo");
  }

  const { data: urlData } = supabase.storage
    .from("documents")
    .getPublicUrl(storagePath);

  const { error: dbError } = await supabase
    .from("builders")
    .update({
      logo_url: urlData.publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", context.builder.id);

  if (dbError) {
    throw new Error("Failed to save logo");
  }

  revalidatePath("/settings");
}
