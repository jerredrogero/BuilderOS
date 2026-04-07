"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBuilder } from "@/lib/queries/builders";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const templateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(255, "Template name is too long"),
  description: z.string().max(1000, "Description is too long").nullable(),
});

export async function createTemplate(formData: FormData) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();

  if (!context || context.role !== "owner") {
    throw new Error("Unauthorized");
  }

  const parsed = templateSchema.safeParse({
    name: formData.get("name"),
    description: (formData.get("description") as string) || null,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((e) => e.message).join(", "));
  }

  const { data, error } = await supabase
    .from("templates")
    .insert({
      builder_id: context.builder.id,
      name: parsed.data.name,
      description: parsed.data.description,
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

  const parsed = templateSchema.safeParse({
    name: formData.get("name"),
    description: (formData.get("description") as string) || null,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((e) => e.message).join(", "));
  }

  const { error } = await supabase
    .from("templates")
    .update({
      name: parsed.data.name,
      description: parsed.data.description,
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
