"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBuilder } from "@/lib/queries/builders";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createInspectionReport(homeId: string, formData: FormData) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context || context.role !== "owner") throw new Error("Unauthorized");

  const file = formData.get("file") as File | null;
  let fileId: string | null = null;

  if (file && file.size > 0) {
    const storagePath = `${context.builder.id}/${homeId}/inspections/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, file);

    if (uploadError) throw new Error("Failed to upload report file");

    const { data: fileRecord } = await supabase
      .from("files")
      .insert({
        builder_id: context.builder.id,
        home_id: homeId,
        uploaded_by: context.userId,
        storage_path: storagePath,
        filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      })
      .select()
      .single();

    fileId = fileRecord?.id || null;
  }

  const { data, error } = await supabase
    .from("inspection_reports")
    .insert({
      home_id: homeId,
      builder_id: context.builder.id,
      title: formData.get("title") as string || "Inspection Report",
      inspector_name: formData.get("inspectorName") as string || null,
      inspection_date: formData.get("inspectionDate") as string || null,
      source: "manual_upload",
      file_id: fileId,
      status: "uploaded",
    })
    .select()
    .single();

  if (error) throw new Error("Failed to create inspection report");

  await supabase.from("activity_log").insert({
    builder_id: context.builder.id,
    home_id: homeId,
    actor_type: "user",
    actor_id: context.userId,
    action: "inspection_report_uploaded",
    metadata: { report_id: data.id, title: data.title },
  });

  revalidatePath(`/homes/${homeId}/inspections`);
  redirect(`/homes/${homeId}/inspections/${data.id}`);
}

export async function createFinding(homeId: string, reportId: string, formData: FormData) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context || context.role !== "owner") throw new Error("Unauthorized");

  const assetId = formData.get("assetId") as string || null;

  const { error } = await supabase
    .from("inspection_findings")
    .insert({
      inspection_report_id: reportId,
      home_id: homeId,
      builder_id: context.builder.id,
      home_asset_id: assetId || null,
      section: formData.get("section") as string || null,
      title: formData.get("title") as string,
      description: formData.get("description") as string || null,
      severity: formData.get("severity") as string || null,
      status: "open",
    });

  if (error) throw new Error("Failed to create finding");

  revalidatePath(`/homes/${homeId}/inspections/${reportId}`);
}

export async function convertFindingToTask(homeId: string, findingId: string, formData: FormData) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context || context.role !== "owner") throw new Error("Unauthorized");

  const { data: finding } = await supabase
    .from("inspection_findings")
    .select("*")
    .eq("id", findingId)
    .single();

  if (!finding) throw new Error("Finding not found");

  const { error: itemError } = await supabase
    .from("home_items")
    .insert({
      home_id: homeId,
      builder_id: context.builder.id,
      type: "punch_list",
      category: finding.section || "Inspection",
      title: finding.title,
      description: finding.description,
      status: "pending",
      source: "inspection",
      source_finding_id: findingId,
      home_asset_id: finding.home_asset_id,
      is_critical: finding.severity === "safety",
      severity: finding.severity,
      assigned_to: formData.get("assignedTo") as string || "builder",
    });

  if (itemError) throw new Error("Failed to create task from finding");

  await supabase
    .from("inspection_findings")
    .update({ status: "converted", updated_at: new Date().toISOString() })
    .eq("id", findingId);

  await supabase.from("activity_log").insert({
    builder_id: context.builder.id,
    home_id: homeId,
    actor_type: "user",
    actor_id: context.userId,
    action: "finding_converted_to_task",
    metadata: { finding_id: findingId, title: finding.title },
  });

  const reportId = finding.inspection_report_id;
  revalidatePath(`/homes/${homeId}/inspections/${reportId}`);
  revalidatePath(`/homes/${homeId}`);
}
