import { CheckCircle, Circle } from "lucide-react";

interface ReadinessChecklistProps {
  items: any[];
  hasDocuments: boolean;
}

/** Compute readiness checks for a home. Reusable in server components. */
export function computeReadinessChecks(items: any[], hasDocuments: boolean) {
  const warrantyItems = items.filter((i) => i.type === "warranty");
  const utilityItems = items.filter((i) => i.type === "utility");

  const warrantyReviewed =
    warrantyItems.length === 0 ||
    warrantyItems.every(
      (i) => i.manufacturer || i.status === "not_applicable"
    );

  const utilitiesConfirmed =
    utilityItems.length === 0 ||
    utilityItems.every(
      (i) => i.metadata?.provider_name || i.status === "not_applicable"
    );

  const checks = [
    {
      label: "At least one document uploaded or confirmed none",
      passed: hasDocuments,
    },
    {
      label: "Warranty entries reviewed",
      passed: warrantyReviewed,
    },
    {
      label: "Utility providers confirmed",
      passed: utilitiesConfirmed,
    },
  ];

  const allPassed = checks.every((c) => c.passed);

  return { checks, allPassed };
}

export function ReadinessChecklist({ items, hasDocuments }: ReadinessChecklistProps) {
  const { checks, allPassed } = computeReadinessChecks(items, hasDocuments);

  return (
    <div className="space-y-2">
      {checks.map((check) => (
        <div key={check.label} className="flex items-center gap-2 text-sm">
          {check.passed ? (
            <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
          ) : (
            <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className={check.passed ? "text-foreground" : "text-muted-foreground"}>
            {check.label}
          </span>
        </div>
      ))}
      {!allPassed && (
        <p className="text-xs text-muted-foreground pt-1">
          Complete all checks above before marking this home as ready.
        </p>
      )}
    </div>
  );
}
