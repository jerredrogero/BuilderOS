import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { warrantyReminders } from "@/lib/inngest/functions/warranty-reminders";
import { activationNudge } from "@/lib/inngest/functions/activation-nudge";
import { builderEscalation } from "@/lib/inngest/functions/builder-escalation";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [warrantyReminders, activationNudge, builderEscalation],
});
