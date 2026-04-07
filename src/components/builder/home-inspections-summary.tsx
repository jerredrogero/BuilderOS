import { getInspectionReports } from "@/lib/queries/inspection-reports";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export async function HomeInspectionsSummary({ homeId }: { homeId: string }) {
  const reports = await getInspectionReports(homeId);

  if (reports.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inspections</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No inspection reports yet.</p>
          <Link
            href={`/homes/${homeId}/inspections`}
            className="mt-2 inline-block text-sm text-primary hover:underline"
          >
            Upload a report
          </Link>
        </CardContent>
      </Card>
    );
  }

  const totalFindings = reports.reduce(
    (sum: number, r: any) => sum + (r.inspection_findings?.[0]?.count || 0),
    0
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Inspections</CardTitle>
        <Link
          href={`/homes/${homeId}/inspections`}
          className="text-sm text-primary hover:underline"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div>
            <p className="text-2xl font-bold">{reports.length}</p>
            <p className="text-xs text-muted-foreground">
              {reports.length === 1 ? "report" : "reports"}
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold">{totalFindings}</p>
            <p className="text-xs text-muted-foreground">
              {totalFindings === 1 ? "finding" : "findings"}
            </p>
          </div>
        </div>
        <div className="mt-3 space-y-1">
          {reports.slice(0, 3).map((report: any) => (
            <Link
              key={report.id}
              href={`/homes/${homeId}/inspections/${report.id}`}
              className="flex items-center justify-between text-sm hover:bg-muted/50 rounded px-2 py-1 -mx-2 transition-colors"
            >
              <span className="truncate">{report.title}</span>
              <Badge variant="secondary" className="text-xs ml-2 shrink-0">
                {report.inspection_findings?.[0]?.count || 0}
              </Badge>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
