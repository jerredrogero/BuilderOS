import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SEVERITY_COLORS: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
  safety: "destructive",
  functional: "default",
  cosmetic: "secondary",
  informational: "outline",
};

interface FindingCardProps {
  finding: any;
  convertAction: (formData: FormData) => Promise<void>;
  resolveAction?: (formData: FormData) => Promise<void>;
}

export function FindingCard({ finding, convertAction, resolveAction }: FindingCardProps) {
  const isConverted = finding.status === "converted";
  const isResolved = finding.status === "resolved" || finding.status === "wont_fix";

  return (
    <div className={`rounded-md border p-4 space-y-3 ${isConverted || isResolved ? "bg-muted/50" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {finding.severity && (
              <Badge variant={SEVERITY_COLORS[finding.severity] || "outline"} className="text-xs">
                {finding.severity}
              </Badge>
            )}
            {finding.section && (
              <Badge variant="outline" className="text-xs">{finding.section}</Badge>
            )}
            {finding.home_assets && (
              <Badge variant="secondary" className="text-xs">{finding.home_assets.name}</Badge>
            )}
          </div>
          <p className="font-medium text-sm">{finding.title}</p>
          {finding.description && (
            <p className="text-xs text-muted-foreground mt-1">{finding.description}</p>
          )}
        </div>
        <Badge variant="outline" className="text-xs">{finding.status}</Badge>
      </div>

      {!isConverted && !isResolved && (
        <div className="flex items-end gap-3 flex-wrap">
          <form action={convertAction} className="flex items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Assign to</label>
              <Select name="assignedTo" defaultValue="builder">
                <SelectTrigger className="h-8 text-xs w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="builder">Builder</SelectItem>
                  <SelectItem value="subcontractor">Subcontractor</SelectItem>
                  <SelectItem value="buyer">Buyer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" size="sm" variant="outline">Create Task</Button>
          </form>
          {resolveAction && (
            <div className="flex gap-2">
              <form action={resolveAction}>
                <input type="hidden" name="resolution" value="resolved" />
                <Button type="submit" size="sm" variant="ghost">Resolve</Button>
              </form>
              <form action={resolveAction}>
                <input type="hidden" name="resolution" value="wont_fix" />
                <Button type="submit" size="sm" variant="ghost" className="text-muted-foreground">Won&apos;t Fix</Button>
              </form>
            </div>
          )}
        </div>
      )}

      {isConverted && (
        <p className="text-xs text-muted-foreground">Converted to punch list task</p>
      )}
      {isResolved && (
        <p className="text-xs text-muted-foreground">
          {finding.status === "wont_fix" ? "Marked as won\u2019t fix" : "Resolved"}
        </p>
      )}
    </div>
  );
}
