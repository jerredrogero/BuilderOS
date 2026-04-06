type RankableItem = {
  id: string;
  due_date: string | null;
  is_critical: boolean;
  status: string;
};

const RESOLVED_STATUSES = new Set(["complete", "skipped", "not_applicable"]);

export function rankItems(items: RankableItem[], today: Date = new Date()): RankableItem[] {
  const active = items.filter((item) => !RESOLVED_STATUSES.has(item.status));

  return active.sort((a, b) => {
    const aDays = daysUntil(a.due_date, today);
    const bDays = daysUntil(b.due_date, today);

    if (aDays !== null && bDays === null) return -1;
    if (aDays === null && bDays !== null) return 1;

    if (aDays !== null && bDays !== null) {
      if (aDays !== bDays) return aDays - bDays;
    }

    if (a.is_critical !== b.is_critical) return a.is_critical ? -1 : 1;

    return 0;
  });
}

function daysUntil(dateStr: string | null, today: Date): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const diffMs = target.getTime() - today.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
