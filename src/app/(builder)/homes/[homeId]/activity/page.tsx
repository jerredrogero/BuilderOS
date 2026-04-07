import { getActivityLog } from "@/lib/queries/activity-log";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const ACTION_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  home_created: { label: "Home created", variant: "default" },
  status_changed: { label: "Status changed", variant: "secondary" },
  invitation_sent: { label: "Invitation sent", variant: "default" },
  invitation_accepted: { label: "Invitation accepted", variant: "default" },
  invitation_expired: { label: "Invitation expired", variant: "destructive" },
  file_uploaded: { label: "File uploaded", variant: "secondary" },
  item_status_changed: { label: "Item updated", variant: "secondary" },
  inspection_report_uploaded: { label: "Inspection report uploaded", variant: "default" },
  finding_resolved: { label: "Finding resolved", variant: "secondary" },
  finding_converted_to_task: { label: "Finding converted to task", variant: "default" },
  buyer_item_completed: { label: "Buyer completed item", variant: "default" },
  buyer_proof_uploaded: { label: "Buyer uploaded proof", variant: "secondary" },
  buyer_asset_created: { label: "Buyer added asset", variant: "secondary" },
  buyer_asset_photo_uploaded: { label: "Buyer uploaded asset photo", variant: "secondary" },
  asset_created: { label: "Asset created", variant: "secondary" },
  asset_photo_uploaded: { label: "Asset photo uploaded", variant: "secondary" },
  reminder_sent: { label: "Reminder sent", variant: "outline" },
  email_send_failed: { label: "Email delivery failed", variant: "destructive" },
};

function formatMetadata(action: string, metadata: any): string | null {
  if (!metadata || typeof metadata !== "object") return null;

  switch (action) {
    case "status_changed":
      if (metadata.from && metadata.to) return `${metadata.from} → ${metadata.to}`;
      if (metadata.status) return `Set to ${metadata.status}`;
      return null;
    case "invitation_sent":
      return metadata.email ? `To: ${metadata.email}` : null;
    case "item_status_changed":
      if (metadata.title) return metadata.title;
      return null;
    case "inspection_report_uploaded":
      return metadata.title || null;
    case "finding_resolved":
      return metadata.resolution === "wont_fix" ? "Won\u2019t fix" : "Resolved";
    case "finding_converted_to_task":
      return metadata.title || null;
    case "email_send_failed":
      return metadata.template ? `Template: ${metadata.template}` : null;
    case "reminder_sent":
      return metadata.reminder_type || null;
    case "file_uploaded":
      return metadata.filename || null;
    default:
      return null;
  }
}

export default async function ActivityLogPage({
  params,
}: {
  params: Promise<{ homeId: string }>;
}) {
  const { homeId } = await params;
  const entries = await getActivityLog(homeId);

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/homes/${homeId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Home
        </Link>
      </div>
      <h1 className="text-2xl font-bold">Activity Log</h1>
      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">No activity yet.</p>
      ) : (
        <div className="divide-y border rounded-lg">
          {entries.map((entry: any) => {
            const actionKey = entry.action || entry.event_type || "";
            const config = ACTION_LABELS[actionKey];
            const label = config?.label || actionKey.replace(/_/g, " ");
            const variant = config?.variant || "outline";
            const profile = entry.profiles;
            const actor =
              entry.actor_type === "system"
                ? "System"
                : profile?.full_name || profile?.email || "Unknown";
            const detail = formatMetadata(actionKey, entry.metadata);
            const timestamp = new Date(entry.created_at).toLocaleString();

            return (
              <div
                key={entry.id}
                className="flex items-center justify-between px-4 py-3 gap-4"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={variant} className="text-xs shrink-0">
                      {label}
                    </Badge>
                    {detail && (
                      <span className="text-xs text-muted-foreground truncate">
                        {detail}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{actor}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {timestamp}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
