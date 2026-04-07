"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBuilder } from "@/lib/queries/builders";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createHome(formData: FormData) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();

  if (!context || context.role !== "owner") {
    throw new Error("Unauthorized");
  }

  const templateId = (formData.get("templateId") as string) || null;
  const rawProjectId = formData.get("projectId") as string;
  const projectId = rawProjectId && rawProjectId !== "none" ? rawProjectId : null;
  const address = formData.get("address") as string;
  const lotNumber = (formData.get("lotNumber") as string) || null;
  const closeDate = formData.get("closeDate") as string;

  const { data: home, error: homeError } = await supabase
    .from("homes")
    .insert({
      builder_id: context.builder.id,
      template_id: templateId,
      project_id: projectId || null,
      address,
      lot_number: lotNumber,
      close_date: closeDate,
      handoff_status: "draft",
    })
    .select()
    .single();

  if (homeError) throw new Error("Failed to create home");

  if (templateId) {
    const { data: templateItems } = await supabase
      .from("template_items")
      .select("*")
      .eq("template_id", templateId);

    if (templateItems && templateItems.length > 0) {
      const closeDateObj = new Date(closeDate);

      const homeItems = templateItems.map((item) => {
        const dueDate =
          item.due_date_offset != null
            ? new Date(closeDateObj.getTime() + item.due_date_offset * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0]
            : null;

        const base: Record<string, unknown> = {
          home_id: home.id,
          builder_id: context.builder.id,
          template_item_id: item.id,
          source: "template",
          type: item.type,
          category: item.category,
          title: item.title,
          description: item.description,
          sort_order: item.sort_order,
          is_critical: item.is_critical,
          metadata: item.metadata,
          status: "pending",
          due_date: dueDate,
        };

        if (item.type === "warranty") {
          base.manufacturer = item.manufacturer;
          base.registration_url = item.registration_url;
          base.responsible_party = item.responsible_party;
          base.registration_status = "not_started";
          base.registration_deadline =
            item.registration_deadline_offset != null
              ? new Date(
                  closeDateObj.getTime() +
                    item.registration_deadline_offset * 24 * 60 * 60 * 1000
                )
                  .toISOString()
                  .split("T")[0]
              : null;
        } else if (item.type === "utility") {
          base.utility_type = item.utility_type;
        }

        return base;
      });

      const { error: itemsError } = await supabase.from("home_items").insert(homeItems);
      if (itemsError) throw new Error("Failed to clone template items");
    }
  }

  await supabase.from("activity_log").insert({
    builder_id: context.builder.id,
    home_id: home.id,
    action: "home_created",
    payload: { address, lot_number: lotNumber },
  });

  revalidatePath("/homes");
  redirect(`/homes/${home.id}`);
}

export async function updateHomeStatus(homeId: string, status: string) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();

  if (!context || context.role !== "owner") {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("homes")
    .update({ handoff_status: status, updated_at: new Date().toISOString() })
    .eq("id", homeId)
    .eq("builder_id", context.builder.id);

  if (error) throw new Error("Failed to update home status");

  await supabase.from("activity_log").insert({
    builder_id: context.builder.id,
    home_id: homeId,
    action: "status_changed",
    payload: { status },
  });

  revalidatePath(`/homes/${homeId}`);
  revalidatePath("/homes");
}
