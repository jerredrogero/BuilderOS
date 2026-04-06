"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBuilder } from "@/lib/queries/builders";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();

  if (!context || context.role !== "owner") {
    throw new Error("Unauthorized");
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      builder_id: context.builder.id,
      name: formData.get("name") as string,
      city: formData.get("city") as string || null,
      state: formData.get("state") as string || null,
      zip_code: formData.get("zipCode") as string || null,
      subdivision: formData.get("subdivision") as string || null,
      notes: formData.get("notes") as string || null,
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

  const { error } = await supabase
    .from("projects")
    .update({
      name: formData.get("name") as string,
      city: formData.get("city") as string || null,
      state: formData.get("state") as string || null,
      zip_code: formData.get("zipCode") as string || null,
      subdivision: formData.get("subdivision") as string || null,
      notes: formData.get("notes") as string || null,
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
