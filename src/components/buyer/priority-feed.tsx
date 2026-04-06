import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type PriorityFeedProps = {
  items: any[];
  homeId: string;
};

function getDaysLabel(dueDateStr: string | null): { label: string; className: string } | null {
  if (!dueDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dueDateStr);
  target.setHours(0, 0, 0, 0);
  const days = Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return { label: `${Math.abs(days)}d overdue`, className: "text-destructive font-medium" };
  }
  if (days === 0) {
    return { label: "Due today", className: "text-destructive font-medium" };
  }
  if (days <= 7) {
    return { label: `${days}d left`, className: "text-amber-600 font-medium" };
  }
  return { label: `${days}d left`, className: "text-muted-foreground" };
}

export function PriorityFeed({ items, homeId }: PriorityFeedProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 px-6 py-10 text-center">
        <p className="text-lg font-semibold">You&apos;re all set!</p>
        <p className="mt-1 text-sm text-muted-foreground">
          No pending actions right now. Check back after your builder updates your home items.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const daysInfo = getDaysLabel(item.due_date);
        const isFirst = index === 0;

        return (
          <Link
            key={item.id}
            href={`/home/${homeId}/items/${item.id}`}
            className={`flex items-center justify-between rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/50 ${
              isFirst ? "border-2 border-[var(--brand-accent,#2563eb)]" : "border-border"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              {item.type && (
                <Badge variant="outline" className="shrink-0 capitalize">
                  {item.type}
                </Badge>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.title}</p>
                {item.category && (
                  <p className="truncate text-xs text-muted-foreground">{item.category}</p>
                )}
              </div>
              {item.is_critical && (
                <Badge variant="destructive" className="shrink-0">
                  Critical
                </Badge>
              )}
            </div>
            {daysInfo && (
              <span className={`ml-4 shrink-0 text-xs ${daysInfo.className}`}>
                {daysInfo.label}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
