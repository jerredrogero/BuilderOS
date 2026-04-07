"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBuilder } from "@/lib/queries/builders";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const templateItemSchema = z.object({
  type: z.enum(["document", "warranty", "utility", "info", "punch_list"], {
    error: "Type must be one of: document, warranty, utility, info, punch_list",
  }),
  category: z.string().min(1, "Category is required"),
  title: z.string().min(1, "Title is required"),
});

function parseItemFields(formData: FormData) {
  const type = formData.get("type") as string;
  const category = formData.get("category") as string;
  const title = formData.get("title") as string;

  const parsed = templateItemSchema.safeParse({ type, category, title });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((e) => e.message).join(", "));
  }

  const description = (formData.get("description") as string) || null;
  const isCritical = formData.get("isCritical") === "on";
  const dueDateOffsetRaw = formData.get("dueDateOffset") as string;
  const dueDateOffset = dueDateOffsetRaw ? parseInt(dueDateOffsetRaw, 10) : null;

  const base: Record<string, unknown> = {
    type,
    category,
    title,
    description,
    is_critical: isCritical,
    due_date_offset: isNaN(dueDateOffset as number) ? null : dueDateOffset,
    manufacturer: null,
    registration_url: null,
    registration_deadline_offset: null,
    responsible_party: null,
    utility_type: null,
    metadata: {},
  };

  if (type === "warranty") {
    base.manufacturer = (formData.get("manufacturer") as string) || null;
    base.registration_url = (formData.get("registrationUrl") as string) || null;
    const regDeadlineRaw = formData.get("registrationDeadlineOffset") as string;
    const regDeadline = regDeadlineRaw ? parseInt(regDeadlineRaw, 10) : null;
    base.registration_deadline_offset = regDeadline && !isNaN(regDeadline) ? regDeadline : null;
    base.responsible_party = (formData.get("responsibleParty") as string) || null;
  } else if (type === "utility") {
    base.utility_type = (formData.get("utilityType") as string) || null;
    base.metadata = {
      providerName: (formData.get("providerName") as string) || null,
      providerPhone: (formData.get("providerPhone") as string) || null,
      providerUrl: (formData.get("providerUrl") as string) || null,
      transferInstructions: (formData.get("transferInstructions") as string) || null,
    };
  } else if (type === "info") {
    base.metadata = {
      content: (formData.get("content") as string) || null,
    };
  }

  return base;
}

export async function createTemplateItem(templateId: string, formData: FormData) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();

  if (!context || context.role !== "owner") {
    throw new Error("Unauthorized");
  }

  const fields = parseItemFields(formData);

  const { error } = await supabase
    .from("template_items")
    .insert({
      template_id: templateId,
      ...fields,
    });

  if (error) throw new Error("Failed to create template item");

  revalidatePath(`/templates/${templateId}`);
}

export async function updateTemplateItem(
  templateId: string,
  itemId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();

  if (!context || context.role !== "owner") {
    throw new Error("Unauthorized");
  }

  const fields = parseItemFields(formData);

  const { error } = await supabase
    .from("template_items")
    .update({
      ...fields,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("template_id", templateId);

  if (error) throw new Error("Failed to update template item");

  revalidatePath(`/templates/${templateId}`);
}

export async function getTemplateFiles(templateId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("files")
    .select("*")
    .eq("template_id", templateId)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function uploadTemplateFile(
  templateId: string,
  templateItemId: string | null,
  formData: FormData
) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context || context.role !== "owner") throw new Error("Unauthorized");

  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");

  if (file.size > 25 * 1024 * 1024) {
    throw new Error("File too large. Maximum 25MB.");
  }

  const storagePath = `${context.builder.id}/templates/${templateId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, file);

  if (uploadError) throw new Error("Failed to upload file");

  const { data: { user } } = await supabase.auth.getUser();

  const { error: dbError } = await supabase.from("files").insert({
    builder_id: context.builder.id,
    template_id: templateId,
    template_item_id: templateItemId,
    uploaded_by: user!.id,
    storage_path: storagePath,
    filename: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  });

  if (dbError) throw new Error("Failed to save file record");

  revalidatePath(`/templates/${templateId}`);
}

export async function deleteTemplateFile(templateId: string, fileId: string) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context || context.role !== "owner") throw new Error("Unauthorized");

  const { data: file } = await supabase
    .from("files")
    .select("storage_path")
    .eq("id", fileId)
    .eq("template_id", templateId)
    .single();

  if (!file) throw new Error("File not found");

  await supabase.storage.from("documents").remove([file.storage_path]);
  await supabase.from("files").delete().eq("id", fileId);

  revalidatePath(`/templates/${templateId}`);
}

export async function deleteTemplateItem(templateId: string, itemId: string) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();

  if (!context || context.role !== "owner") {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("template_items")
    .delete()
    .eq("id", itemId)
    .eq("template_id", templateId);

  if (error) throw new Error("Failed to delete template item");

  revalidatePath(`/templates/${templateId}`);
}
