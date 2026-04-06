"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

// setupBuilderTenant is called from the client-side signup page
// AFTER the auth user is created client-side (so cookies are set properly).
// It creates the builder tenant, owner membership, and starter template.
export async function setupBuilderTenant(companyName: string, email: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  // 1. Create builder tenant
  const { data: builder, error: builderError } = await supabase
    .from("builders")
    .insert({
      name: companyName,
      slug: generateSlug(companyName),
      contact_email: email,
    })
    .select()
    .single();

  if (builderError) {
    throw new Error("Failed to create builder account");
  }

  // 2. Create owner membership
  const { error: membershipError } = await supabase
    .from("memberships")
    .insert({
      user_id: user.id,
      builder_id: builder.id,
      role: "owner",
    });

  if (membershipError) {
    throw new Error("Failed to create membership");
  }

  // 3. Create starter template
  await createStarterTemplate(supabase, builder.id);
}

async function createStarterTemplate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  builderId: string
) {
  const { data: template, error: templateError } = await supabase
    .from("templates")
    .insert({
      builder_id: builderId,
      name: "Standard Home Handoff",
      description:
        "Pre-loaded template for single-family home handoffs. Customize to fit your process.",
      is_starter: true,
    })
    .select()
    .single();

  if (templateError) {
    throw new Error("Failed to create starter template");
  }

  const t = template.id;

  const { error: itemsError } = await supabase.from("template_items").insert([
    // HVAC
    {
      template_id: t,
      type: "warranty",
      category: "HVAC",
      title: "HVAC System Warranty",
      is_critical: true,
      registration_deadline_offset: 30,
      responsible_party: "buyer",
      sort_order: 1,
    },
    {
      template_id: t,
      type: "document",
      category: "HVAC",
      title: "HVAC Owner's Manual",
      is_critical: false,
      sort_order: 2,
    },
    // Appliances
    {
      template_id: t,
      type: "warranty",
      category: "Appliances",
      title: "Dishwasher Warranty",
      is_critical: true,
      registration_deadline_offset: 30,
      responsible_party: "buyer",
      sort_order: 3,
    },
    {
      template_id: t,
      type: "warranty",
      category: "Appliances",
      title: "Refrigerator Warranty",
      is_critical: true,
      registration_deadline_offset: 30,
      responsible_party: "buyer",
      sort_order: 4,
    },
    {
      template_id: t,
      type: "warranty",
      category: "Appliances",
      title: "Range/Oven Warranty",
      is_critical: true,
      registration_deadline_offset: 30,
      responsible_party: "buyer",
      sort_order: 5,
    },
    // Roofing
    {
      template_id: t,
      type: "warranty",
      category: "Roofing",
      title: "Roof Warranty",
      is_critical: true,
      registration_deadline_offset: 60,
      responsible_party: "buyer",
      sort_order: 6,
    },
    // Plumbing
    {
      template_id: t,
      type: "warranty",
      category: "Plumbing",
      title: "Water Heater Warranty",
      is_critical: true,
      registration_deadline_offset: 30,
      responsible_party: "buyer",
      sort_order: 7,
    },
    // Utilities
    {
      template_id: t,
      type: "utility",
      category: "Utilities",
      title: "Electric Service Transfer",
      utility_type: "electric",
      is_critical: true,
      due_date_offset: 7,
      sort_order: 8,
    },
    {
      template_id: t,
      type: "utility",
      category: "Utilities",
      title: "Gas Service Transfer",
      utility_type: "gas",
      is_critical: true,
      due_date_offset: 7,
      sort_order: 9,
    },
    {
      template_id: t,
      type: "utility",
      category: "Utilities",
      title: "Water Service Transfer",
      utility_type: "water",
      is_critical: true,
      due_date_offset: 7,
      sort_order: 10,
    },
    {
      template_id: t,
      type: "utility",
      category: "Utilities",
      title: "Internet Service Setup",
      utility_type: "internet",
      is_critical: false,
      due_date_offset: 14,
      sort_order: 11,
    },
    // Paint & Finishes
    {
      template_id: t,
      type: "info",
      category: "Paint & Finishes",
      title: "Interior Paint Colors",
      is_critical: false,
      sort_order: 12,
    },
    // Fixtures
    {
      template_id: t,
      type: "info",
      category: "Fixtures",
      title: "Fixture & Appliance Model Numbers",
      is_critical: false,
      sort_order: 13,
    },
    // Move-In
    {
      template_id: t,
      type: "checklist",
      category: "Move-In",
      title: "Test smoke and CO detectors",
      is_critical: true,
      due_date_offset: 3,
      sort_order: 14,
    },
    {
      template_id: t,
      type: "checklist",
      category: "Move-In",
      title: "Locate water shut-off valve",
      is_critical: true,
      due_date_offset: 3,
      sort_order: 15,
    },
    {
      template_id: t,
      type: "checklist",
      category: "Move-In",
      title: "Locate electrical panel",
      is_critical: true,
      due_date_offset: 3,
      sort_order: 16,
    },
    // Closing
    {
      template_id: t,
      type: "document",
      category: "Closing",
      title: "Closing Documents",
      is_critical: false,
      sort_order: 17,
    },
    // Home
    {
      template_id: t,
      type: "document",
      category: "Home",
      title: "Home Maintenance Guide",
      is_critical: false,
      sort_order: 18,
    },
  ]);

  if (itemsError) {
    throw new Error("Failed to create starter template items");
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
