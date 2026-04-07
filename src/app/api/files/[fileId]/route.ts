import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get file record (RLS will enforce access)
  const { data: file } = await supabase
    .from("files")
    .select("storage_path, filename")
    .eq("id", fileId)
    .single();

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Check if download is requested
  const download = request.nextUrl.searchParams.get("download") === "true";

  // Generate signed URL (with download option if requested)
  const { data } = await supabase.storage
    .from("documents")
    .createSignedUrl(file.storage_path, 3600, {
      download: download ? file.filename : undefined,
    });

  if (!data?.signedUrl) {
    return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
