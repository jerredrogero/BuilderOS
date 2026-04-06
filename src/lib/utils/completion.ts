type ItemForCompletion = {
  is_critical: boolean;
  status: string;
};

const RESOLVED_STATUSES = new Set(["complete", "skipped", "not_applicable"]);

export function calculateCompletion(items: ItemForCompletion[]): number {
  const criticalItems = items.filter((item) => item.is_critical);
  if (criticalItems.length === 0) return 100;
  const resolved = criticalItems.filter((item) => RESOLVED_STATUSES.has(item.status)).length;
  return Math.floor((resolved / criticalItems.length) * 100);
}
