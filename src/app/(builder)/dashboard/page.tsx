import Link from "next/link";
import { getHomes } from "@/lib/queries/homes";
import { getCurrentBuilder } from "@/lib/queries/builders";
import { createClient } from "@/lib/supabase/server";
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
  const [homes, builderCtx] = await Promise.all([getHomes(), getCurrentBuilder()]);

  const builderId = (builderCtx?.builder as any)?.id as string | undefined;

  const statusCounts = STATUSES.reduce(
    (acc, status) => {
      acc[status] = homes.filter((h: any) => h.handoff_status === status).length;
      return acc;
    },
    {} as Record<HandoffStatus, number>
  );

  const recentHomes = homes.slice(0, 10);

  // Dates for queries
  const today = new Date();
  const todayIso = today.toISOString();
  const in14Days = new Date(today);
  in14Days.setDate(in14Days.getDate() + 14);
  const in14DaysIso = in14Days.toISOString();
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const threeDaysAgoIso = threeDaysAgo.toISOString();

  type OverdueItem = { id: string; title: string; registration_deadline: string; homes: { address: string } | null };
  type StuckBuyer = { email: string; sent_at: string; homes: { address: string } | null };
  type DeadlineItem = { id: string; title: string; registration_deadline: string; homes: { address: string } | null };

  let overdueItems: OverdueItem[] = [];
  let stuckBuyers: StuckBuyer[] = [];
  let upcomingDeadlines: DeadlineItem[] = [];

  if (builderId) {
    const supabase = await createClient();

    const [overdueRes, stuckRes, deadlinesRes] = await Promise.all([
      supabase
        .from("home_items")
        .select("id, title, registration_deadline, homes(address)")
        .eq("builder_id", builderId)
        .eq("type", "warranty")
        .eq("registration_status", "not_started")
        .lt("registration_deadline", todayIso)
        .limit(10),
      supabase
        .from("invitations")
        .select("email, sent_at, homes(address)")
        .eq("builder_id", builderId)
        .eq("status", "sent")
        .lt("sent_at", threeDaysAgoIso)
        .limit(10),
      supabase
        .from("home_items")
        .select("id, title, registration_deadline, homes(address)")
        .eq("builder_id", builderId)
        .eq("type", "warranty")
        .eq("registration_status", "not_started")
        .gte("registration_deadline", todayIso)
        .lte("registration_deadline", in14DaysIso)
        .order("registration_deadline", { ascending: true })
        .limit(10),
    ]);

    overdueItems = (overdueRes.data as OverdueItem[] | null) ?? [];
    stuckBuyers = (stuckRes.data as StuckBuyer[] | null) ?? [];
    upcomingDeadlines = (deadlinesRes.data as DeadlineItem[] | null) ?? [];
  }

  function daysLeft(deadline: string): number {
    const diff = new Date(deadline).getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  const actionCount = overdueItems.length + stuckBuyers.length;

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

      {/* Action Needed & Upcoming Deadlines */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>
              Action Needed
              {actionCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {actionCount}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {actionCount === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nothing needs attention right now.
              </p>
            ) : (
              <ul className="divide-y">
                {overdueItems.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-3 px-2">
                    <span className="text-sm truncate min-w-0">
                      {item.homes?.address ?? "Unknown address"}: {item.title}
                    </span>
                    <Badge variant="destructive" className="shrink-0">
                      overdue
                    </Badge>
                  </li>
                ))}
                {stuckBuyers.map((inv, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-3 px-2">
                    <span className="text-sm truncate min-w-0">
                      {inv.email} at {inv.homes?.address ?? "Unknown address"}
                    </span>
                    <Badge variant="secondary" className="shrink-0">
                      not activated
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Upcoming Deadlines</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {upcomingDeadlines.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No deadlines in the next 14 days.
              </p>
            ) : (
              <ul className="divide-y">
                {upcomingDeadlines.map((item) => {
                  const days = daysLeft(item.registration_deadline);
                  return (
                    <li key={item.id} className="flex items-center justify-between gap-3 py-3 px-2">
                      <span className="text-sm truncate min-w-0">
                        {item.homes?.address ?? "Unknown address"}: {item.title}
                      </span>
                      <Badge
                        variant={days <= 3 ? "destructive" : "outline"}
                        className="shrink-0"
                      >
                        {days}d left
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
