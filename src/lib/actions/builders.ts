"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBuilder } from "@/lib/queries/builders";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const builderSettingsSchema = z.object({
  name: z.string().min(1, "Company name is required").max(255, "Company name too long"),
  primaryColor: z.string().max(20).nullable(),
  accentColor: z.string().max(20).nullable(),
  contactEmail: z
    .string()
    .nullable()
    .refine(
      (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      "Invalid email format"
    ),
  contactPhone: z.string().max(30).nullable(),
  welcomeMessage: z.string().max(2000, "Welcome message too long").nullable(),
});

export async function updateBuilderSettings(formData: FormData) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();

  if (!context || context.role !== "owner") {
    throw new Error("Unauthorized");
  }

  const parsed = builderSettingsSchema.safeParse({
    name: formData.get("name"),
    primaryColor: (formData.get("primaryColor") as string) || null,
    accentColor: (formData.get("accentColor") as string) || null,
    contactEmail: (formData.get("contactEmail") as string) || null,
    contactPhone: (formData.get("contactPhone") as string) || null,
    welcomeMessage: (formData.get("welcomeMessage") as string) || null,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((e) => e.message).join(", "));
  }

  const { name, primaryColor, accentColor, contactEmail, contactPhone, welcomeMessage } =
    parsed.data;

  const { error } = await supabase
    .from("builders")
    .update({
      name,
      primary_color: primaryColor,
      accent_color: accentColor,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      welcome_message: welcomeMessage,
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
