"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBuilder } from "@/lib/queries/builders";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const createHomeSchema = z.object({
  address: z.string().min(1, "Address is required"),
  closeDate: z.string().min(1, "Close date is required").refine(
    (val) => !isNaN(Date.parse(val)),
    "Close date must be a valid date"
  ),
  templateId: z.string().uuid("Invalid template").nullable(),
  projectId: z.string().uuid("Invalid project").nullable(),
  lotNumber: z.string().nullable(),
});

const updateStatusSchema = z.object({
  status: z.enum(["draft", "ready", "activated", "completed"], {
    error: "Invalid handoff status",
  }),
});

export async function createHome(formData: FormData) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();

  if (!context || context.role !== "owner") {
    throw new Error("Unauthorized");
  }

  const rawTemplateId = (formData.get("templateId") as string) || null;
  const rawProjectId = formData.get("projectId") as string;

  const parsed = createHomeSchema.safeParse({
    address: formData.get("address"),
    closeDate: formData.get("closeDate"),
    templateId: rawTemplateId || null,
    projectId: rawProjectId && rawProjectId !== "none" ? rawProjectId : null,
    lotNumber: (formData.get("lotNumber") as string) || null,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((e) => e.message).join(", "));
  }

  const { address, closeDate, templateId, projectId, lotNumber } = parsed.data;

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

    // Clone template files to the new home
    const { data: templateFiles } = await supabase
      .from("files")
      .select("*")
      .eq("template_id", templateId);

    if (templateFiles && templateFiles.length > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      for (const tf of templateFiles) {
        const newPath = `${context.builder.id}/${home.id}/general/${Date.now()}-${tf.filename}`;
        const { error: copyError } = await supabase.storage
          .from("documents")
          .copy(tf.storage_path, newPath);

        if (!copyError) {
          await supabase.from("files").insert({
            builder_id: context.builder.id,
            home_id: home.id,
            home_item_id: null,
            uploaded_by: user!.id,
            storage_path: newPath,
            filename: tf.filename,
            mime_type: tf.mime_type,
            size_bytes: tf.size_bytes,
          });
        }
      }
    }
  }

  await supabase.from("activity_log").insert({
    builder_id: context.builder.id,
    home_id: home.id,
    action: "home_created",
    metadata: { address, lot_number: lotNumber },
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

  const parsed = updateStatusSchema.safeParse({ status });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((e) => e.message).join(", "));
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
    metadata: { status },
  });

  revalidatePath(`/homes/${homeId}`);
  revalidatePath("/homes");
}
