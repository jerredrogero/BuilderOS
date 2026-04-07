import { inngest } from "@/lib/inngest/client";
import { createClient } from "@supabase/supabase-js";
import { render } from "@react-email/render";
import { ActivationNudgeEmail } from "@/lib/email/templates/activation-nudge";
import { sendEmail } from "@/lib/email/client";

export const activationNudge = inngest.createFunction(
  { id: "activation-nudge", name: "Activation Nudge", triggers: [{ cron: "0 10 * * *" }] },
  async ({ step }) => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find invitations sent more than 3 days ago that are still in 'sent' status
    const invitations = await step.run("fetch-stuck-invitations", async () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const { data, error } = await supabase
        .from("invitations")
        .select(
          `
          id,
          home_id,
          email,
          token,
          sent_at,
          expires_at,
          homes (
            id,
            address,
            builder_id,
            builders (
              name,
              primary_color
            )
          )
        `
        )
        .eq("status", "sent")
        .lt("sent_at", threeDaysAgo.toISOString());

      if (error) throw error;
      return data || [];
    });

    const results = [];

    for (const invitation of invitations) {
      const home = invitation.homes as any;
      if (!home) continue;

      const builder = home.builders as any;
      const buyerEmail = invitation.email;

      if (!buyerEmail) continue;

      // Skip expired invitations using the expires_at column
      if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) continue;

      // Dedup using home_id + reminder_type + recipient_email (stable — no dependency on recipient_id)
      const alreadySent = await step.run(
        `check-nudge-dupe-${invitation.home_id}-${buyerEmail}`,
        async () => {
          const { data } = await supabase
            .from("reminders_sent")
            .select("id")
            .eq("home_id", invitation.home_id)
            .eq("reminder_type", "activation_nudge")
            .eq("recipient_email", buyerEmail)
            .maybeSingle();
          return !!data;
        }
      );

      if (alreadySent) continue;

      const acceptUrl = process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite?token=${invitation.token}`
        : `https://app.builderos.com/accept-invite?token=${invitation.token}`;

      await step.run(
        `send-activation-nudge-${invitation.home_id}-${buyerEmail}`,
        async () => {
          const html = await render(
            ActivationNudgeEmail({
              builderName: builder?.name || "Your Builder",
              homeAddress: home.address,
              acceptUrl,
              primaryColor: builder?.primary_color || "#2563eb",
            })
          );

          const result = await sendEmail({
            from: "BuilderOS <reminders@builderos.com>",
            to: buyerEmail,
            subject: "Your home information is waiting — activate your account",
            html,
          });

          if (!result.success) {
            await supabase.from("activity_log").insert({
              home_id: invitation.home_id,
              action: "email_send_failed",
              metadata: {
                template: "activation_nudge",
                recipient_email: buyerEmail,
                invitation_id: invitation.id,
                error: result.error,
              },
            });
            return;
          }

          // Record in reminders_sent
          await supabase.from("reminders_sent").insert({
            home_id: invitation.home_id,
            home_item_id: null,
            reminder_type: "activation_nudge",
            recipient_email: buyerEmail,
            recipient_id: null,
            sent_at: new Date().toISOString(),
          });

          // Log activity
          await supabase.from("activity_log").insert({
            home_id: invitation.home_id,
            action: "activation_nudge_sent",
            metadata: {
              reminder_type: "activation_nudge",
              recipient_email: buyerEmail,
              invitation_id: invitation.id,
            },
          });
        }
      );

      results.push({ homeId: invitation.home_id, buyerEmail });
    }

    return { sent: results.length, results };
  }
);
