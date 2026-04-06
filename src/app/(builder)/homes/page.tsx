import { getHomes } from "@/lib/queries/homes";
import { calculateCompletion } from "@/lib/utils/completion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "draft":
      return "secondary";
    case "active":
      return "default";
    case "complete":
      return "outline";
    default:
      return "secondary";
  }
}

export default async function HomesPage() {
  const homes = await getHomes();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Homes</h1>
        <Button asChild>
          <Link href="/homes/new">New Home</Link>
        </Button>
      </div>

      {homes.length === 0 ? (
        <p className="text-muted-foreground">
          No homes yet. Create one to get started.
        </p>
      ) : (
        <div className="divide-y border rounded-lg">
          {homes.map((home) => {
            const items = (home as any).home_items ?? [];
            const completion = calculateCompletion(items);
            const project = (home as any).projects;
            const lotLabel = home.lot_number
              ? `Lot ${home.lot_number} — ${home.address}`
              : home.address;

            return (
              <Link
                key={home.id}
                href={`/homes/${home.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="space-y-0.5">
                  <p className="font-medium text-sm">{lotLabel}</p>
                  {project && (
                    <p className="text-xs text-muted-foreground">{project.name}</p>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {home.close_date && (
                    <span>Closes {new Date(home.close_date).toLocaleDateString()}</span>
                  )}
                  <span>{completion}% complete</span>
                  <Badge variant={statusVariant(home.handoff_status ?? "draft")}>
                    {home.handoff_status ?? "draft"}
                  </Badge>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
