"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBuilder } from "@/lib/queries/builders";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createTemplate(formData: FormData) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();

  if (!context || context.role !== "owner") {
    throw new Error("Unauthorized");
  }

  const { data, error } = await supabase
    .from("templates")
    .insert({
      builder_id: context.builder.id,
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
    })
    .select()
    .single();

  if (error) throw new Error("Failed to create template");

  revalidatePath("/templates");
  redirect(`/templates/${data.id}`);
}

export async function updateTemplate(templateId: string, formData: FormData) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();

  if (!context || context.role !== "owner") {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("templates")
    .update({
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId)
    .eq("builder_id", context.builder.id);

  if (error) throw new Error("Failed to update template");

  revalidatePath(`/templates/${templateId}`);
}

export async function deleteTemplate(templateId: string) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();

  if (!context || context.role !== "owner") {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("templates")
    .delete()
    .eq("id", templateId)
    .eq("builder_id", context.builder.id);

  if (error) throw new Error("Failed to delete template");

  redirect("/templates");
}
