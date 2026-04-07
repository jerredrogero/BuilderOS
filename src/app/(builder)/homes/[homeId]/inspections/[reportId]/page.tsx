import { getInspectionReport } from "@/lib/queries/inspection-reports";
import { getHomeAssets } from "@/lib/queries/home-assets";
import { createFinding, convertFindingToTask } from "@/lib/actions/inspection-reports";
import { FindingCard } from "@/components/builder/finding-card";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ homeId: string; reportId: string }>;
}) {
  const { homeId, reportId } = await params;
  const report = await getInspectionReport(reportId);
  if (!report) notFound();

  const assets = await getHomeAssets(homeId);
  const findings = report.inspection_findings || [];
  const addFindingAction = createFinding.bind(null, homeId, reportId);

  const openFindings = findings.filter((f: any) => f.status === "open" || f.status === "acknowledged");
  const convertedFindings = findings.filter((f: any) => f.status === "converted");
  const resolvedFindings = findings.filter((f: any) => f.status === "resolved" || f.status === "wont_fix");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/homes/${homeId}/inspections`} className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Reports
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{report.title}</h1>
            <p className="text-sm text-muted-foreground">
              {report.inspector_name && `${report.inspector_name} \u00b7 `}
              {report.inspection_date || "No date"} \u00b7 {findings.length} findings
            </p>
          </div>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>Add Finding</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Inspection Finding</DialogTitle>
            </DialogHeader>
            <form action={addFindingAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Finding</Label>
                <Input id="title" name="title" placeholder="Condensation on HVAC supply line" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Details</Label>
                <Textarea id="description" name="description" placeholder="Inspector notes..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="section">Section</Label>
                  <Input id="section" name="section" placeholder="HVAC, Plumbing, Electrical..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="severity">Severity</Label>
                  <Select name="severity" defaultValue="functional">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cosmetic">Cosmetic</SelectItem>
                      <SelectItem value="functional">Functional</SelectItem>
                      <SelectItem value="safety">Safety</SelectItem>
                      <SelectItem value="informational">Informational</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {assets.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="assetId">Related Asset (optional)</Label>
                  <Select name="assetId">
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      {assets.map((asset: any) => (
                        <SelectItem key={asset.id} value={asset.id}>
                          {asset.name} ({asset.category})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button type="submit" className="w-full">Add Finding</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {openFindings.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Open ({openFindings.length})</h2>
          {openFindings.map((finding: any) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              convertAction={convertFindingToTask.bind(null, homeId, finding.id)}
            />
          ))}
        </div>
      )}

      {convertedFindings.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">Converted to Tasks ({convertedFindings.length})</h2>
          {convertedFindings.map((finding: any) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              convertAction={convertFindingToTask.bind(null, homeId, finding.id)}
            />
          ))}
        </div>
      )}

      {resolvedFindings.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">Resolved ({resolvedFindings.length})</h2>
          {resolvedFindings.map((finding: any) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              convertAction={convertFindingToTask.bind(null, homeId, finding.id)}
            />
          ))}
        </div>
      )}

      {findings.length === 0 && (
        <p className="text-muted-foreground">No findings yet. Add findings from the inspection report.</p>
      )}
    </div>
  );
}
