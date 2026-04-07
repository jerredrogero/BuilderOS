import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getThemeStyles } from "@/lib/utils/theme";
import { markItemComplete, uploadProofFile } from "@/lib/actions/buyer-items";
import { FileRow } from "@/components/file-row";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const RESOLVED_STATUSES = new Set(["complete", "skipped", "not_applicable"]);

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function daysUntil(dateStr: string): number {
  const due = new Date(dateStr);
  const now = new Date();
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function BuyerItemDetailPage({
  params,
}: {
  params: Promise<{ homeId: string; itemId: string }>;
}) {
  const { homeId, itemId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verify assignment
  const { data: assignment } = await supabase
    .from("home_assignments")
    .select("id")
    .eq("home_id", homeId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!assignment) notFound();

  // Fetch home with builder
  const { data: home } = await supabase
    .from("homes")
    .select("*, builders(*)")
    .eq("id", homeId)
    .single();

  if (!home) notFound();

  // Fetch item with files
  const { data: item } = await supabase
    .from("home_items")
    .select("*, files(*)")
    .eq("id", itemId)
    .eq("home_id", homeId)
    .single();

  if (!item) notFound();

  // Fetch proof file if it exists
  let proofFile: { filename: string; size_bytes: number } | null = null;
  if (item.proof_file_id) {
    const { data: pf } = await supabase
      .from("files")
      .select("filename, size_bytes")
      .eq("id", item.proof_file_id)
      .single();
    proofFile = pf ?? null;
  }

  const builder = (home as any).builders;
  const themeStyles = builder
    ? getThemeStyles({
        primary_color: builder.primary_color ?? null,
        accent_color: builder.accent_color ?? null,
      })
    : {};

  const isResolved = RESOLVED_STATUSES.has(item.status);
  const files: any[] = Array.isArray(item.files) ? item.files : [];

  // Days countdown
  let daysLeft: number | null = null;
  if (item.due_date) {
    daysLeft = daysUntil(item.due_date);
  }

  // Server action bindings
  const markComplete = markItemComplete.bind(null, homeId, itemId);
  const uploadProof = uploadProofFile.bind(null, homeId, itemId);

  return (
    <div style={themeStyles} className="min-h-screen bg-background">
      {/* Header */}
      <header
        className="border-b"
        style={{ backgroundColor: "var(--brand-primary, #1a1a1a)", color: "#fff" }}
      >
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Link
            href={`/home/${homeId}`}
            className="text-sm opacity-80 hover:opacity-100 mr-4"
          >
            ← Back
          </Link>
          {builder?.name && (
            <span className="font-semibold">{builder.name}</span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        {/* Badges row */}
        <div className="flex flex-wrap gap-2">
          {item.type && (
            <Badge variant="secondary" className="capitalize">
              {item.type}
            </Badge>
          )}
          {item.category && (
            <Badge variant="outline" className="capitalize">
              {item.category}
            </Badge>
          )}
          {item.is_critical && (
            <Badge variant="destructive">Critical</Badge>
          )}
        </div>

        {/* Title & description */}
        <div>
          <h1 className="text-2xl font-bold">{item.title}</h1>
          {item.description && (
            <p className="mt-2 text-muted-foreground">{item.description}</p>
          )}
        </div>

        {/* Days countdown */}
        {daysLeft !== null && (
          <div className="flex items-baseline gap-2">
            <span
              className={`text-5xl font-bold tabular-nums ${
                daysLeft < 0 ? "text-destructive" : "text-foreground"
              }`}
            >
              {Math.abs(daysLeft)}
            </span>
            <span className="text-lg text-muted-foreground">
              {daysLeft < 0 ? "days overdue" : "days left"}
            </span>
          </div>
        )}

        {/* Resolved banner */}
        {isResolved && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800 font-medium">
            Completed
          </div>
        )}

        {/* ── Warranty ── */}
        {item.type === "warranty" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Warranty Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {item.manufacturer && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Manufacturer</span>
                    <span>{item.manufacturer}</span>
                  </div>
                )}
                {item.model_number && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Model</span>
                    <span>{item.model_number}</span>
                  </div>
                )}
                {item.serial_number && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Serial Number</span>
                    <span className="font-mono">{item.serial_number}</span>
                  </div>
                )}
                {item.due_date && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Registration Deadline
                    </span>
                    <span>{new Date(item.due_date).toLocaleDateString()}</span>
                  </div>
                )}
                {item.registration_status && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Registration Status
                    </span>
                    <Badge
                      variant={
                        item.registration_status === "registered"
                          ? "default"
                          : "secondary"
                      }
                      className="capitalize"
                    >
                      {item.registration_status}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {!isResolved && (
              <div className="space-y-4">
                {/* Register Now */}
                {item.registration_url && (
                  <a
                    href={item.registration_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
                  >
                    Register Now ↗
                  </a>
                )}

                {/* Mark as Registered */}
                <form action={markComplete}>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
                    style={{ backgroundColor: "var(--brand-accent, #2563eb)" }}
                  >
                    Mark as Registered
                  </button>
                </form>

                {/* Proof upload */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Upload Proof</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form action={uploadProof} className="space-y-3">
                      <label className="block text-sm text-muted-foreground">
                        Upload proof of registration (screenshot, confirmation
                        email, etc.)
                      </label>
                      <input
                        type="file"
                        name="file"
                        accept="image/*,.pdf,.png,.jpg,.jpeg"
                        className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted/80"
                      />
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
                      >
                        Upload Proof
                      </button>
                    </form>

                    {proofFile && (
                      <div className="mt-4 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                        <span className="font-medium">Proof uploaded:</span>
                        <span>{proofFile.filename}</span>
                        <span className="text-green-600">
                          ({formatBytes(proofFile.size_bytes)})
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {isResolved && proofFile && (
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                <span className="font-medium">Proof uploaded:</span>
                <span>{proofFile.filename}</span>
                <span className="text-green-600">
                  ({formatBytes(proofFile.size_bytes)})
                </span>
              </div>
            )}
          </>
        )}

        {/* ── Utility ── */}
        {item.type === "utility" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Transfer Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {item.metadata?.provider_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Provider</span>
                    <span>{item.metadata.provider_name}</span>
                  </div>
                )}
                {item.metadata?.provider_phone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone</span>
                    <a
                      href={`tel:${item.metadata.provider_phone}`}
                      className="text-[var(--brand-accent,#2563eb)] hover:underline"
                    >
                      {item.metadata.provider_phone}
                    </a>
                  </div>
                )}
                {item.metadata?.provider_website && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Website</span>
                    <a
                      href={item.metadata.provider_website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--brand-accent,#2563eb)] hover:underline"
                    >
                      Visit site ↗
                    </a>
                  </div>
                )}
                {item.metadata?.transfer_instructions && (
                  <div>
                    <p className="text-muted-foreground mb-1">Instructions</p>
                    <pre className="whitespace-pre-wrap font-sans text-sm">
                      {item.metadata.transfer_instructions}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>

            {!isResolved && (
              <form action={markComplete}>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
                  style={{ backgroundColor: "var(--brand-accent, #2563eb)" }}
                >
                  Mark as Transferred
                </button>
              </form>
            )}
          </>
        )}

        {/* ── Checklist ── */}
        {item.type === "checklist" && !isResolved && (
          <form action={markComplete}>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: "var(--brand-accent, #2563eb)" }}
            >
              Mark Complete
            </button>
          </form>
        )}

        {/* ── Info ── */}
        {item.type === "info" && item.metadata?.content && (
          <Card>
            <CardContent className="pt-6">
              <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">
                {item.metadata.content}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* ── Document type ── */}
        {item.type === "document" && files.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {files.map((f: any) => (
                <FileRow key={f.id} file={f} showDelete={false} />
              ))}
            </CardContent>
          </Card>
        )}

        {/* ── Related documents (all types) ── */}
        {item.type !== "document" && files.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {files.map((f: any) => (
                <FileRow key={f.id} file={f} showDelete={false} />
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
