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
}

export function FindingCard({ finding, convertAction }: FindingCardProps) {
  const isConverted = finding.status === "converted";
  const isResolved = finding.status === "resolved" || finding.status === "wont_fix";

  return (
    <div className={`rounded-md border p-4 space-y-3 ${isConverted ? "bg-muted/50" : ""}`}>
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
      )}

      {isConverted && (
        <p className="text-xs text-muted-foreground">Converted to punch list task</p>
      )}
    </div>
  );
}
