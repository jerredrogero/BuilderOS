"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBuilder } from "@/lib/queries/builders";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const projectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(255, "Project name too long"),
  city: z.string().max(255).nullable(),
  state: z.string().max(255).nullable(),
  zipCode: z.string().max(20).nullable(),
  subdivision: z.string().max(255).nullable(),
  notes: z.string().max(2000).nullable(),
});

export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();

  if (!context || context.role !== "owner") {
    throw new Error("Unauthorized");
  }

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    city: (formData.get("city") as string) || null,
    state: (formData.get("state") as string) || null,
    zipCode: (formData.get("zipCode") as string) || null,
    subdivision: (formData.get("subdivision") as string) || null,
    notes: (formData.get("notes") as string) || null,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((e) => e.message).join(", "));
  }

  const { name, city, state, zipCode, subdivision, notes } = parsed.data;

  const { data, error } = await supabase
    .from("projects")
    .insert({
      builder_id: context.builder.id,
      name,
      city,
      state,
      zip_code: zipCode,
      subdivision,
      notes,
    })
    .select()
    .single();

  if (error) throw new Error("Failed to create project");

  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

export async function updateProject(projectId: string, formData: FormData) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();

  if (!context || context.role !== "owner") {
    throw new Error("Unauthorized");
  }

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    city: (formData.get("city") as string) || null,
    state: (formData.get("state") as string) || null,
    zipCode: (formData.get("zipCode") as string) || null,
    subdivision: (formData.get("subdivision") as string) || null,
    notes: (formData.get("notes") as string) || null,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((e) => e.message).join(", "));
  }

  const { name, city, state, zipCode, subdivision, notes } = parsed.data;

  const { error } = await supabase
    .from("projects")
    .update({
      name,
      city,
      state,
      zip_code: zipCode,
      subdivision,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .eq("builder_id", context.builder.id);

  if (error) throw new Error("Failed to update project");

  revalidatePath(`/projects/${projectId}`);
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();

  if (!context || context.role !== "owner") {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("builder_id", context.builder.id);

  if (error) throw new Error("Failed to delete project");

  redirect("/projects");
}
