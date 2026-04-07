import { getInspectionReports } from "@/lib/queries/inspection-reports";
import { createInspectionReport } from "@/lib/actions/inspection-reports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import Link from "next/link";

export default async function InspectionsPage({
  params,
}: {
  params: Promise<{ homeId: string }>;
}) {
  const { homeId } = await params;
  const reports = await getInspectionReports(homeId);
  const uploadAction = createInspectionReport.bind(null, homeId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/homes/${homeId}`} className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Home
          </Link>
          <h1 className="text-2xl font-bold">Inspection Reports</h1>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>Upload Report</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Inspection Report</DialogTitle>
            </DialogHeader>
            <form action={uploadAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Report Title</Label>
                <Input id="title" name="title" placeholder="Pre-Closing Inspection" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inspectorName">Inspector Name</Label>
                  <Input id="inspectorName" name="inspectorName" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inspectionDate">Inspection Date</Label>
                  <Input id="inspectionDate" name="inspectionDate" type="date" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">Report File (PDF)</Label>
                <Input id="file" name="file" type="file" accept=".pdf,.doc,.docx" />
              </div>
              <Button type="submit" className="w-full">Upload</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {reports.length === 0 ? (
        <p className="text-muted-foreground">No inspection reports yet. Upload one to start tracking findings.</p>
      ) : (
        <div className="space-y-2">
          {reports.map((report: any) => (
            <Link key={report.id} href={`/homes/${homeId}/inspections/${report.id}`} className="block">
              <div className="flex items-center justify-between rounded-md border p-4 hover:bg-muted/50 transition-colors">
                <div>
                  <p className="font-medium text-sm">{report.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {report.inspector_name && `${report.inspector_name} \u00b7 `}
                    {report.inspection_date || "No date"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {report.inspection_findings?.[0]?.count || 0} findings
                  </Badge>
                  <Badge variant="secondary" className="text-xs">{report.status}</Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
