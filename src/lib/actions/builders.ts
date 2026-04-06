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
