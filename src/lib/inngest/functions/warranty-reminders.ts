import { inngest } from "@/lib/inngest/client";
import { createClient } from "@supabase/supabase-js";
import { render } from "@react-email/render";
import { WarrantyReminderEmail } from "@/lib/email/templates/warranty-reminder";
import { Resend } from "resend";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

type ReminderType = "overdue" | "deadline_3d" | "deadline_14d";

export const warrantyReminders = inngest.createFunction(
  { id: "warranty-reminders", name: "Warranty Reminders", triggers: [{ cron: "0 9 * * *" }] },
  async ({ step }) => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const resend = new Resend(process.env.RESEND_API_KEY);

    // Fetch all warranty items that are not started and have a deadline within 14 days or overdue
    const items = await step.run("fetch-warranty-items", async () => {
      const today = new Date();
      const in14Days = new Date(today);
      in14Days.setDate(today.getDate() + 14);

      const { data, error } = await supabase
        .from("home_items")
        .select(
          `
          id,
          title,
          registration_deadline,
          home_id,
          homes (
            id,
            address,
            builder_id,
            builders (
              name,
              primary_color,
              contact_email
            ),
            home_assignments (
              buyer_email,
              buyer_id,
              profiles (
                id,
                email,
                full_name
              )
            )
          )
        `
        )
        .eq("type", "warranty")
        .eq("registration_status", "not_started")
        .lte("registration_deadline", in14Days.toISOString().split("T")[0]);

      if (error) throw error;
      return data || [];
    });

    const results = [];

    for (const item of items) {
      const home = item.homes as any;
      if (!home) continue;

      const builder = home.builders as any;
      const assignments = home.home_assignments as any[];
      if (!assignments || assignments.length === 0) continue;

      const deadline = new Date(item.registration_deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffMs = deadline.getTime() - today.getTime();
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      let reminderType: ReminderType;
      if (daysLeft < 0) {
        reminderType = "overdue";
      } else if (daysLeft <= 3) {
        reminderType = "deadline_3d";
      } else {
        reminderType = "deadline_14d";
      }

      for (const assignment of assignments) {
        const profile = assignment.profiles as any;
        const buyerEmail = profile?.email || assignment.buyer_email;
        const recipientId = profile?.id || null;

        if (!buyerEmail) continue;

        // Check for duplicate reminder
        const alreadySent = await step.run(
          `check-dupe-${item.id}-${reminderType}-${buyerEmail}`,
          async () => {
            const { data } = await supabase
              .from("reminders_sent")
              .select("id")
              .eq("home_item_id", item.id)
              .eq("reminder_type", reminderType)
              .eq("recipient_email", buyerEmail)
              .maybeSingle();
            return !!data;
          }
        );

        if (alreadySent) continue;

        const dashboardUrl =
          process.env.NEXT_PUBLIC_APP_URL
            ? `${process.env.NEXT_PUBLIC_APP_URL}/buyer/homes/${home.id}/items/${item.id}`
            : `https://app.builderos.com/buyer/homes/${home.id}/items/${item.id}`;

        await step.run(
          `send-warranty-reminder-${item.id}-${reminderType}-${buyerEmail}`,
          async () => {
            const html = await render(
              WarrantyReminderEmail({
                builderName: builder?.name || "Your Builder",
                itemTitle: item.title,
                daysLeft,
                homeAddress: home.address,
                dashboardUrl,
                primaryColor: builder?.primary_color || "#2563eb",
              })
            );

            await resend.emails.send({
              from: "BuilderOS <reminders@builderos.com>",
              to: buyerEmail,
              subject:
                daysLeft < 0
                  ? `Overdue: Warranty Registration for ${item.title}`
                  : `Warranty Registration Reminder: ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`,
              html,
            });

            // Record in reminders_sent
            await supabase.from("reminders_sent").insert({
              home_item_id: item.id,
              reminder_type: reminderType,
              recipient_email: buyerEmail,
              recipient_id: recipientId,
              sent_at: new Date().toISOString(),
            });

            // Log activity
            await supabase.from("activity_log").insert({
              home_id: home.id,
              action: "reminder_sent",
              metadata: {
                reminder_type: reminderType,
                item_id: item.id,
                item_title: item.title,
                recipient_email: buyerEmail,
                days_left: daysLeft,
              },
            });
          }
        );

        results.push({ itemId: item.id, reminderType, buyerEmail });
      }
    }

    return { sent: results.length, results };
  }
);
