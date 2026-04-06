type ProgressBarProps = {
  completed: number;
  total: number;
};

export function ProgressBar({ completed, total }: ProgressBarProps) {
  const pct = total === 0 ? 100 : Math.floor((completed / total) * 100);

  return (
    <div className="space-y-1.5">
      <p className="text-sm text-muted-foreground">
        {completed} of {total} critical items completed
      </p>
      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: "var(--brand-accent, #2563eb)",
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{pct}%</p>
    </div>
  );
}
