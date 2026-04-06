"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBuilder } from "@/lib/queries/builders";
import { revalidatePath } from "next/cache";

function parseItemFields(formData: FormData) {
  const type = formData.get("type") as string;
  const category = formData.get("category") as string;
  const title = formData.get("title") as string;
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
