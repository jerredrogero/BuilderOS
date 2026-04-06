import { getActivityLog } from "@/lib/queries/activity-log";
import Link from "next/link";

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
          ← Back to Home
        </Link>
      </div>
      <h1 className="text-2xl font-bold">Activity Log</h1>
      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">No activity yet.</p>
      ) : (
        <div className="divide-y border rounded-lg">
          {entries.map((entry: any) => {
            const action = (entry.action || entry.event_type || "")
              .replace(/_/g, " ");
            const profile = (entry as any).profiles;
            const actor =
              profile?.full_name || profile?.email || "System";
            const timestamp = new Date(entry.created_at).toLocaleString();

            return (
              <div
                key={entry.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium capitalize">{action}</p>
                  <p className="text-xs text-muted-foreground">{actor}</p>
                </div>
                <span className="text-xs text-muted-foreground">{timestamp}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
