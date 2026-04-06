import Link from "next/link";
import { getHomes } from "@/lib/queries/homes";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";

const STATUSES = ["draft", "ready", "invited", "activated", "engaged", "completed"] as const;
type HandoffStatus = (typeof STATUSES)[number];

const STATUS_LABELS: Record<HandoffStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  invited: "Invited",
  activated: "Activated",
  engaged: "Engaged",
  completed: "Completed",
};

const STATUS_BADGE_VARIANTS: Record<HandoffStatus, "outline" | "secondary" | "default"> = {
  draft: "outline",
  ready: "secondary",
  invited: "secondary",
  activated: "default",
  engaged: "default",
  completed: "default",
};

export default async function DashboardPage() {
  const homes = await getHomes();

  const statusCounts = STATUSES.reduce(
    (acc, status) => {
      acc[status] = homes.filter((h: any) => h.handoff_status === status).length;
      return acc;
    },
    {} as Record<HandoffStatus, number>
  );

  const recentHomes = homes.slice(0, 10);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Status summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STATUSES.map((status) => (
          <Card key={status} size="sm">
            <CardContent className="flex flex-col items-center justify-center py-4 gap-1">
              <span className="text-3xl font-bold">{statusCounts[status]}</span>
              <span className="text-xs text-muted-foreground">{STATUS_LABELS[status]}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent homes */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Homes</CardTitle>
          <CardAction>
            <Badge asChild variant="default">
              <Link href="/homes/new">+ New Home</Link>
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="pt-2">
          {recentHomes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No homes yet. Create your first home from a template.
            </p>
          ) : (
            <ul className="divide-y">
              {recentHomes.map((home: any) => {
                const totalItems = home.home_items?.length ?? 0;
                const completedItems =
                  home.home_items?.filter((i: any) => i.status === "completed").length ?? 0;
                const completionPct =
                  totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

                return (
                  <li key={home.id}>
                    <Link
                      href={`/homes/${home.id}`}
                      className="flex items-center justify-between gap-4 py-3 hover:bg-muted/40 px-2 rounded-lg transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-sm">
                          {home.lot_number ? `Lot ${home.lot_number} — ` : ""}
                          {home.address ?? "No address"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {home.projects?.name ?? "No project"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-muted-foreground">{completionPct}%</span>
                        <Badge variant={STATUS_BADGE_VARIANTS[home.handoff_status as HandoffStatus] ?? "outline"}>
                          {STATUS_LABELS[home.handoff_status as HandoffStatus] ?? home.handoff_status}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Placeholder sections */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Action Needed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="py-6 text-center text-sm text-muted-foreground">No data yet.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Upcoming Deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="py-6 text-center text-sm text-muted-foreground">No data yet.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
