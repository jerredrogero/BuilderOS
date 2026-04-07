"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBuilder } from "@/lib/queries/builders";
import { resend } from "@/lib/email/client";
import { InvitationEmail } from "@/lib/email/templates/invitation";
import { revalidatePath } from "next/cache";

export async function sendInvitation(homeId: string, formData: FormData) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();

  if (!context || context.role !== "owner") {
    throw new Error("Unauthorized");
  }

  const email = formData.get("email") as string;
  if (!email) throw new Error("Email is required");
  const role = "primary_buyer";

  // Get home details
  const { data: home, error: homeError } = await supabase
    .from("homes")
    .select("*, projects(name)")
    .eq("id", homeId)
    .eq("builder_id", context.builder.id)
    .single();

  if (homeError || !home) throw new Error("Home not found");

  // Create invitation record
  const { data: invitation, error: invError } = await supabase
    .from("invitations")
    .insert({
      home_id: homeId,
      builder_id: context.builder.id,
      email,
      role,
      status: "pending",
    })
    .select()
    .single();

  if (invError || !invitation) throw new Error("Failed to create invitation");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const acceptUrl = `${appUrl}/accept-invite?token=${invitation.token}`;

  const builderName = context.builder.name ?? "Your builder";
  const primaryColor = context.builder.primary_color ?? "#000000";

  // Send email
  const { error: emailError } = await resend.emails.send({
    from: `${builderName} <onboarding@resend.dev>`,
    to: email,
    subject: `Your new home is ready — ${home.address}`,
    react: InvitationEmail({
      builderName,
      homeAddress: home.address,
      acceptUrl,
      primaryColor,
    }),
  });

  if (emailError) {
    // Don't throw — invitation exists, builder can resend
    console.error("Failed to send invitation email:", emailError);
  } else {
    // Update invitation status to sent
    await supabase
      .from("invitations")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    // If home is ready, advance to invited
    if (home.handoff_status === "ready") {
      await supabase
        .from("homes")
        .update({ handoff_status: "invited", updated_at: new Date().toISOString() })
        .eq("id", homeId);
    }
  }

  // Log activity
  await supabase.from("activity_log").insert({
    builder_id: context.builder.id,
    home_id: homeId,
    action: "invitation_sent",
    metadata: { email, invitation_id: invitation.id },
  });

  revalidatePath(`/homes/${homeId}`);
}

export async function resendInvitation(homeId: string, invitationId: string) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();

  if (!context) throw new Error("Unauthorized");

  // Fetch invitation with home address
  const { data: invitation, error: invError } = await supabase
    .from("invitations")
    .select("*, homes(address)")
    .eq("id", invitationId)
    .eq("builder_id", context.builder.id)
    .single();

  if (invError || !invitation) throw new Error("Invitation not found");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const acceptUrl = `${appUrl}/accept-invite?token=${invitation.token}`;

  const builderName = context.builder.name ?? "Your builder";
  const primaryColor = context.builder.primary_color ?? "#000000";
  const homeAddress = (invitation.homes as any)?.address ?? "";

  const { error: emailError } = await resend.emails.send({
    from: `${builderName} <onboarding@resend.dev>`,
    to: invitation.email,
    subject: `Your new home is ready — ${homeAddress}`,
    react: InvitationEmail({
      builderName,
      homeAddress,
      acceptUrl,
      primaryColor,
    }),
  });

  if (emailError) {
    console.error("Failed to resend invitation email:", emailError);
  } else {
    await supabase
      .from("invitations")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        resend_count: (invitation.resend_count ?? 0) + 1,
      })
      .eq("id", invitationId);
  }

  revalidatePath(`/homes/${homeId}`);
}
