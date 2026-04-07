import { getHome } from "@/lib/queries/homes";
import { getHomeFiles } from "@/lib/queries/files";
import { updateHomeStatus } from "@/lib/actions/homes";
import { uploadFile } from "@/lib/actions/files";
import { updateHomeItemStatus, updateHomeItem, deleteHomeItem } from "@/lib/actions/home-items";
import { calculateCompletion } from "@/lib/utils/completion";
import { ReadinessChecklist, computeReadinessChecks } from "@/components/builder/readiness-checklist";
import { EditItemDialog } from "@/components/builder/item-form";
import { FileRow } from "@/components/file-row";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { notFound } from "next/navigation";

import { sendInvitation, resendInvitation } from "@/lib/actions/invitations";
import { HomeAssetsSummary } from "@/components/builder/home-assets-summary";
import { HomeInspectionsSummary } from "@/components/builder/home-inspections-summary";
import { PunchListSummary } from "@/components/builder/punch-list-summary";

function statusVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "draft":
      return "secondary";
    case "ready":
      return "default";
    case "invited":
      return "outline";
    case "completed":
      return "outline";
    default:
      return "secondary";
  }
}

function itemTypeVariant(
  type: string
): "default" | "secondary" | "outline" | "destructive" {
  switch (type) {
    case "warranty":
      return "default";
    case "utility":
      return "secondary";
    case "checklist":
    case "punch_list":
      return "outline";
    default:
      return "outline";
  }
}

function itemStatusVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "complete":
      return "default";
    case "not_applicable":
      return "outline";
    case "pending":
      return "secondary";
    default:
      return "secondary";
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function HomeDetailPage({
  params,
}: {
  params: Promise<{ homeId: string }>;
}) {
  const { homeId } = await params;
  const home = await getHome(homeId);
  if (!home) notFound();

  const files = await getHomeFiles(homeId);
  const items: any[] = (home as any).home_items ?? [];
  const invitations: any[] = (home as any).invitations ?? [];
  const completion = calculateCompletion(items);
  const handoffStatus = home.handoff_status ?? "draft";
  const project = (home as any).projects;

  const lotLabel = home.lot_number
    ? `Lot ${home.lot_number} — ${home.address}`
    : home.address;

  const hasDocuments = files.length > 0;
  const { allPassed: readinessAllPassed } = computeReadinessChecks(items, hasDocuments);

  // Group items by category
  const byCategory: Record<string, any[]> = {};
  for (const item of items) {
    const cat = item.category || "Uncategorized";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{lotLabel}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            {project && <span>{project.name}</span>}
            {home.close_date && (
              <span>
                Closes {new Date(home.close_date).toLocaleDateString()}
              </span>
            )}
            <span>{completion}% complete</span>
            <Badge variant={statusVariant(handoffStatus)}>{handoffStatus}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/homes/${homeId}/assets`}>Assets</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/homes/${homeId}/inspections`}>Inspections</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/homes/${homeId}/activity`}>Activity Log</Link>
          </Button>
        </div>
      </div>

      {/* Status controls */}
      {handoffStatus === "draft" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Readiness Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ReadinessChecklist items={items} hasDocuments={hasDocuments} />
            <form
              action={async () => {
                "use server";
                await updateHomeStatus(homeId, "ready");
              }}
            >
              <Button type="submit" disabled={!readinessAllPassed}>
                Mark Ready
              </Button>
              {!readinessAllPassed && (
                <p className="text-xs text-muted-foreground mt-1">
                  All readiness checks must pass before marking this home as ready.
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {handoffStatus === "ready" && (
        <div className="flex gap-2">
          <form
            action={async () => {
              "use server";
              await updateHomeStatus(homeId, "draft");
            }}
          >
            <Button type="submit" variant="outline">
              Back to Draft
            </Button>
          </form>
          <Button asChild>
            <a href="#invite">Invite Buyer</a>
          </Button>
        </div>
      )}

      {/* Invite section */}
      {(handoffStatus === "ready" || handoffStatus === "invited") && (
        <Card id="invite">
          <CardHeader>
            <CardTitle className="text-base">Invite Buyer</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={sendInvitation.bind(null, homeId)} className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="invite-email" className="sr-only">
                  Email
                </Label>
                <Input
                  id="invite-email"
                  name="email"
                  type="email"
                  placeholder="buyer@example.com"
                />
              </div>
              <Button type="submit">Send Invitation</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Invitation status */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invitations</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {invitations.map((inv: any) => (
              <div
                key={inv.id}
                className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
              >
                <span className="text-sm">{inv.email}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(inv.status)}>{inv.status}</Badge>
                  <form action={resendInvitation.bind(null, homeId, inv.id)}>
                    <Button type="submit" variant="outline" size="sm">
                      Resend
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Document upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={uploadFile.bind(null, homeId, null)} className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="doc-upload" className="sr-only">
                File
              </Label>
              <Input id="doc-upload" name="file" type="file" />
            </div>
            <Button type="submit">Upload</Button>
          </form>
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f: any) => (
                <FileRow key={f.id} file={f} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assets, Inspections & Punch List summaries */}
      <HomeAssetsSummary homeId={homeId} />
      <HomeInspectionsSummary homeId={homeId} />
      <PunchListSummary homeId={homeId} />

      {/* Items by category */}
      {Object.entries(byCategory).map(([category, catItems]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-base">{category}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {catItems.map((item: any) => (
              <div key={item.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <Badge variant={itemTypeVariant(item.type)}>{item.type}</Badge>
                    <span className="text-sm font-medium truncate">{item.title}</span>
                    {item.is_critical && (
                      <Badge variant="destructive">Critical</Badge>
                    )}
                    {item.due_date && (
                      <span className="text-xs text-muted-foreground">
                        Due {new Date(item.due_date).toLocaleDateString()}
                      </span>
                    )}
                    <Badge variant={itemStatusVariant(item.status)}>
                      {item.status}
                    </Badge>
                    {item.type === "warranty" && item.registration_status && (
                      <Badge variant="outline">{item.registration_status}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <EditItemDialog
                      item={item}
                      action={updateHomeItem.bind(null, homeId, item.id)}
                    />
                    <form
                      action={async () => {
                        "use server";
                        await updateHomeItemStatus(homeId, item.id, "complete");
                      }}
                    >
                      <Button type="submit" size="sm" variant="outline">
                        Done
                      </Button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await updateHomeItemStatus(
                          homeId,
                          item.id,
                          "not_applicable"
                        );
                      }}
                    >
                      <Button type="submit" size="sm" variant="outline">
                        N/A
                      </Button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await deleteHomeItem(homeId, item.id);
                      }}
                    >
                      <Button
                        type="submit"
                        size="sm"
                        variant="destructive"
                      >
                        Remove
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
