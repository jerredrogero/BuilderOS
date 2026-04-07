import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const RESOLVED_STATUSES = new Set(["complete", "skipped", "not_applicable"]);

export async function PunchListSummary({ homeId }: { homeId: string }) {
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("home_items")
    .select("id, severity, status")
    .eq("home_id", homeId)
    .eq("type", "punch_list");

  const punchItems = items ?? [];
  if (punchItems.length === 0) return null;

  const open = punchItems.filter((i) => !RESOLVED_STATUSES.has(i.status));
  const safety = open.filter((i) => i.severity === "safety").length;
  const functional = open.filter((i) => i.severity === "functional").length;
  const cosmetic = open.filter((i) => i.severity === "cosmetic").length;
  const resolved = punchItems.length - open.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Punch List</h3>
        <Link
          href={`/homes/${homeId}/punch-list`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          View all &rarr;
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {safety > 0 && (
          <Badge variant="destructive" className="text-xs">
            {safety} safety
          </Badge>
        )}
        {functional > 0 && (
          <Badge variant="default" className="text-xs">
            {functional} functional
          </Badge>
        )}
        {cosmetic > 0 && (
          <Badge variant="secondary" className="text-xs">
            {cosmetic} cosmetic
          </Badge>
        )}
        {resolved > 0 && (
          <Badge variant="outline" className="text-xs text-green-600 border-green-200">
            {resolved} resolved
          </Badge>
        )}
      </div>
      {open.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {open.length} open item{open.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
