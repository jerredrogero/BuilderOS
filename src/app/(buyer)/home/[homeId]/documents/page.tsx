import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getThemeStyles } from "@/lib/utils/theme";
import { uploadFile } from "@/lib/actions/files";
import { getHomeFiles } from "@/lib/queries/files";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function BuyerDocumentsPage({
  params,
}: {
  params: Promise<{ homeId: string }>;
}) {
  const { homeId } = await params;

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

  const builder = (home as any).builders;
  const themeStyles = builder
    ? getThemeStyles({
        primary_color: builder.primary_color ?? null,
        accent_color: builder.accent_color ?? null,
      })
    : {};

  const files = await getHomeFiles(homeId);

  const uploadAction = uploadFile.bind(null, homeId, null);

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
        <h1 className="text-2xl font-bold">Documents</h1>

        {/* Upload form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload a Document</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={uploadAction} className="flex items-center gap-3">
              <input
                type="file"
                name="file"
                className="block flex-1 text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted/80"
              />
              <button
                type="submit"
                className="inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Upload
              </button>
            </form>
          </CardContent>
        </Card>

        {/* File list */}
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents yet.</p>
        ) : (
          <Card>
            <CardContent className="pt-6 space-y-2">
              {files.map((f: any) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm"
                >
                  <span className="truncate font-medium">{f.filename}</span>
                  <div className="ml-4 shrink-0 flex items-center gap-4 text-muted-foreground">
                    <span>{formatBytes(f.size_bytes)}</span>
                    <span>
                      {new Date(f.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
