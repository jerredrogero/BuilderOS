"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBuilder } from "@/lib/queries/builders";
import { calculateCompletion } from "@/lib/utils/completion";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ITEM_TYPES } from "@/lib/types/database";

const ITEM_STATUSES = [
  "pending",
  "in_progress",
  "complete",
  "skipped",
  "not_applicable",
] as const;

// Postgres-compatible UUID format (8-4-4-4-12 hex). Zod v4's `.uuid()` enforces
// RFC 4122 version/variant bits, which rejects valid Postgres UUIDs (including
// the demo seed data).
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidSchema = z.string().regex(UUID_REGEX, "Invalid UUID");

const statusUpdateSchema = z.object({
  homeId: uuidSchema,
  itemId: uuidSchema,
  status: z.enum(ITEM_STATUSES, {
    error:
      "Status must be one of: pending, in_progress, complete, skipped, not_applicable",
  }),
});

const homeItemSchema = z.object({
  type: z.enum(ITEM_TYPES, {
    error:
      "Type must be one of: checklist, document, warranty, utility, info, punch_list",
  }),
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable(),
  category: z.string().min(1, "Category is required"),
  isCritical: z.boolean(),
});

const warrantyFieldsSchema = z.object({
  manufacturer: z.string().nullable(),
  responsibleParty: z.string().nullable(),
  registrationUrl: z.string().nullable(),
});

const utilityFieldsSchema = z.object({
  utilityType: z.string().nullable(),
  providerName: z.string().nullable(),
  providerPhone: z.string().nullable(),
  providerUrl: z.string().nullable(),
  transferInstructions: z.string().nullable(),
});

function parseHomeItemFields(formData: FormData) {
  const raw = {
    type: formData.get("type") as string,
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || null,
    category: formData.get("category") as string,
    isCritical: formData.has("isCritical"),
  };

  const parsed = homeItemSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((e) => e.message).join(", "));
  }

  const { type, title, description, category, isCritical } = parsed.data;

  const updates: Record<string, unknown> = {
    type,
    title,
    description,
    category,
    is_critical: isCritical,
  };

  if (type === "warranty") {
    const warrantyRaw = {
      manufacturer: (formData.get("manufacturer") as string) || null,
      responsibleParty: (formData.get("responsibleParty") as string) || null,
      registrationUrl: (formData.get("registrationUrl") as string) || null,
    };
    const warrantyParsed = warrantyFieldsSchema.safeParse(warrantyRaw);
    if (!warrantyParsed.success) {
      throw new Error(
        warrantyParsed.error.issues.map((e) => e.message).join(", ")
      );
    }
    updates.manufacturer = warrantyParsed.data.manufacturer;
    updates.responsible_party = warrantyParsed.data.responsibleParty;
    updates.registration_url = warrantyParsed.data.registrationUrl;
  }

  if (type === "utility") {
    const utilityRaw = {
      utilityType: (formData.get("utilityType") as string) || null,
      providerName: (formData.get("providerName") as string) || null,
      providerPhone: (formData.get("providerPhone") as string) || null,
      providerUrl: (formData.get("providerUrl") as string) || null,
      transferInstructions:
        (formData.get("transferInstructions") as string) || null,
    };
    const utilityParsed = utilityFieldsSchema.safeParse(utilityRaw);
    if (!utilityParsed.success) {
      throw new Error(
        utilityParsed.error.issues.map((e) => e.message).join(", ")
      );
    }
    updates.utility_type = utilityParsed.data.utilityType;
    updates.metadata = {
      provider_name: utilityParsed.data.providerName,
      provider_phone: utilityParsed.data.providerPhone,
      provider_url: utilityParsed.data.providerUrl,
      transfer_instructions: utilityParsed.data.transferInstructions,
    };
  }

  return updates;
}

export async function updateHomeItemStatus(
  homeId: string,
  itemId: string,
  status: string
) {
  const parsed = statusUpdateSchema.safeParse({ homeId, itemId, status });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((e) => e.message).join(", "));
  }

  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context) throw new Error("Unauthorized");

  // Fetch item to check type
  const { data: item, error: fetchError } = await supabase
    .from("home_items")
    .select("type")
    .eq("id", parsed.data.itemId)
    .eq("home_id", parsed.data.homeId)
    .single();

  if (fetchError || !item) throw new Error("Item not found");

  const updates: Record<string, unknown> = { status: parsed.data.status };
  if (item.type === "warranty" && parsed.data.status === "complete") {
    updates.registration_status = "registered";
  }

  const { error: updateError } = await supabase
    .from("home_items")
    .update(updates)
    .eq("id", parsed.data.itemId)
    .eq("home_id", parsed.data.homeId);

  if (updateError) throw new Error("Failed to update item status");

  // Recalculate completion
  const { data: allItems } = await supabase
    .from("home_items")
    .select("is_critical, status")
    .eq("home_id", parsed.data.homeId);

  const completion = calculateCompletion(allItems || []);

  const homeUpdates: Record<string, unknown> = {
    completion_pct: completion,
  };
  if (completion === 100) {
    homeUpdates.handoff_status = "completed";
  }

  await supabase
    .from("homes")
    .update(homeUpdates)
    .eq("id", parsed.data.homeId)
    .eq("builder_id", context.builder.id);

  // Log activity
  await supabase.from("activity_log").insert({
    builder_id: context.builder.id,
    home_id: parsed.data.homeId,
    home_item_id: parsed.data.itemId,
    actor_type: "user",
    actor_id: context.userId,
    action: "item_status_changed",
    metadata: { status: parsed.data.status },
  });

  revalidatePath(`/homes/${parsed.data.homeId}`);
}

export async function updateHomeItem(
  homeId: string,
  itemId: string,
  formData: FormData
) {
  const idParsed = z
    .object({ homeId: uuidSchema, itemId: uuidSchema })
    .safeParse({ homeId, itemId });
  if (!idParsed.success) {
    throw new Error(idParsed.error.issues.map((e) => e.message).join(", "));
  }

  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context || context.role !== "owner") throw new Error("Unauthorized");

  // Fetch item to verify it exists
  const { data: item, error: fetchError } = await supabase
    .from("home_items")
    .select("type")
    .eq("id", idParsed.data.itemId)
    .eq("home_id", idParsed.data.homeId)
    .single();

  if (fetchError || !item) throw new Error("Item not found");

  const updates = parseHomeItemFields(formData);

  const { error } = await supabase
    .from("home_items")
    .update(updates)
    .eq("id", idParsed.data.itemId)
    .eq("home_id", idParsed.data.homeId);

  if (error) throw new Error("Failed to update item");

  revalidatePath(`/homes/${idParsed.data.homeId}`);
}

export async function deleteHomeItem(homeId: string, itemId: string) {
  const idParsed = z
    .object({ homeId: uuidSchema, itemId: uuidSchema })
    .safeParse({ homeId, itemId });
  if (!idParsed.success) {
    throw new Error(idParsed.error.issues.map((e) => e.message).join(", "));
  }

  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context || context.role !== "owner") throw new Error("Unauthorized");

  const { error } = await supabase
    .from("home_items")
    .delete()
    .eq("id", idParsed.data.itemId)
    .eq("home_id", idParsed.data.homeId);

  if (error) throw new Error("Failed to delete item");

  revalidatePath(`/homes/${idParsed.data.homeId}`);
}
