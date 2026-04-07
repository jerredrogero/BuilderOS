import { inngest } from "@/lib/inngest/client";
import { createClient } from "@supabase/supabase-js";
import { render } from "@react-email/render";
import { BuilderEscalationEmail } from "@/lib/email/templates/builder-escalation";
import { sendEmail } from "@/lib/email/client";

export const builderEscalation = inngest.createFunction(
  { id: "builder-escalation", name: "Builder Escalation Digest", triggers: [{ cron: "0 8 * * 1" }] },
  async ({ step }) => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all builders with a contact_email
    const builders = await step.run("fetch-builders", async () => {
      const { data, error } = await supabase
        .from("builders")
        .select("id, name, contact_email, primary_color")
        .not("contact_email", "is", null);

      if (error) throw error;
      return data || [];
    });

    const results = [];

    for (const builder of builders) {
      if (!builder.contact_email) continue;

      const digest = await step.run(`build-digest-${builder.id}`, async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const in7Days = new Date(today);
        in7Days.setDate(today.getDate() + 7);
        const threeDaysAgo = new Date(today);
        threeDaysAgo.setDate(today.getDate() - 3);

        // Overdue warranty items for this builder
        const { data: overdueData } = await supabase
          .from("home_items")
          .select(
            `
            id,
            title,
            registration_deadline,
            homes!inner (
              id,
              address,
              builder_id
            )
          `
          )
          .eq("type", "warranty")
          .eq("registration_status", "not_started")
          .lt("registration_deadline", today.toISOString().split("T")[0])
          .eq("homes.builder_id", builder.id);

        const overdueItems = (overdueData || []).map((item) => {
          const home = item.homes as any;
          const deadline = new Date(item.registration_deadline);
          const daysOverdue = Math.ceil(
            (today.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24)
          );
          return {
            title: item.title,
            homeAddress: home?.address || "Unknown",
            daysOverdue,
          };
        });

        // Stuck invitations (sent > 3 days ago, still 'sent' status)
        const { data: inviteData } = await supabase
          .from("invitations")
          .select(
            `
            id,
            buyer_email,
            sent_at,
            homes!inner (
              id,
              address,
              builder_id
            )
          `
          )
          .eq("status", "sent")
          .lt("sent_at", threeDaysAgo.toISOString())
          .eq("homes.builder_id", builder.id);

        const stuckBuyers = (inviteData || []).map((inv) => {
          const home = inv.homes as any;
          const sentAt = new Date(inv.sent_at);
          const daysSinceInvite = Math.ceil(
            (today.getTime() - sentAt.getTime()) / (1000 * 60 * 60 * 24)
          );
          return {
            email: inv.buyer_email,
            homeAddress: home?.address || "Unknown",
            daysSinceInvite,
          };
        });

        // Upcoming deadlines (next 7 days)
        const { data: upcomingData } = await supabase
          .from("home_items")
          .select(
            `
            id,
            title,
            registration_deadline,
            homes!inner (
              id,
              address,
              builder_id
            )
          `
          )
          .eq("type", "warranty")
          .eq("registration_status", "not_started")
          .gte("registration_deadline", today.toISOString().split("T")[0])
          .lte("registration_deadline", in7Days.toISOString().split("T")[0])
          .eq("homes.builder_id", builder.id);

        const upcomingDeadlines = (upcomingData || []).map((item) => {
          const home = item.homes as any;
          const deadline = new Date(item.registration_deadline);
          const daysLeft = Math.ceil(
            (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
          return {
            title: item.title,
            homeAddress: home?.address || "Unknown",
            daysLeft,
          };
        });

        return { overdueItems, stuckBuyers, upcomingDeadlines };
      });

      // Skip if nothing actionable
      if (
        digest.overdueItems.length === 0 &&
        digest.stuckBuyers.length === 0 &&
        digest.upcomingDeadlines.length === 0
      ) {
        continue;
      }

      const sent = await step.run(`send-escalation-${builder.id}`, async () => {
        const html = await render(
          BuilderEscalationEmail({
            builderName: builder.name,
            overdueItems: digest.overdueItems,
            stuckBuyers: digest.stuckBuyers,
            upcomingDeadlines: digest.upcomingDeadlines,
          }) as React.ReactElement
        );

        const result = await sendEmail({
          from: "BuilderOS <digest@builderos.com>",
          to: builder.contact_email,
          subject: `${builder.name} — Weekly Action Digest`,
          html,
        });

        if (!result.success) {
          // Log failure so it's visible in the system
          await supabase.from("activity_log").insert({
            builder_id: builder.id,
            action: "email_send_failed",
            metadata: {
              template: "builder_escalation",
              recipient_email: builder.contact_email,
              error: result.error,
            },
          });
          return false;
        }
        return true;
      });

      if (sent) {
        results.push({
          builderId: builder.id,
          builderName: builder.name,
          overdueCount: digest.overdueItems.length,
          stuckCount: digest.stuckBuyers.length,
          upcomingCount: digest.upcomingDeadlines.length,
        });
      }
    }

    return { digestsSent: results.length, results };
  }
);
