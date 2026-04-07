import { deleteFile } from "@/lib/actions/files";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface FileRowProps {
  file: {
    id: string;
    filename: string;
    mime_type?: string | null;
    size_bytes?: number | null;
    created_at: string;
  };
  showDelete?: boolean;
}

const VIEWABLE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "text/plain",
]);

function isViewable(mimeType: string | null | undefined, filename: string): boolean {
  if (mimeType && VIEWABLE_TYPES.has(mimeType)) return true;
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext ? ["pdf", "png", "jpg", "jpeg", "gif", "webp", "svg", "txt"].includes(ext) : false;
}

export function FileRow({ file, showDelete = true }: FileRowProps) {
  const deleteAction = deleteFile.bind(null, file.id);
  const sizeKB = file.size_bytes ? Math.round(file.size_bytes / 1024) : null;
  const ext = file.mime_type?.split("/")[1] || file.filename.split(".").pop() || "file";
  const canView = isViewable(file.mime_type, file.filename);

  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="flex items-center gap-3 min-w-0">
        <Badge variant="outline" className="text-xs shrink-0">{ext}</Badge>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{file.filename}</p>
          <p className="text-xs text-muted-foreground">
            {sizeKB !== null && `${sizeKB}KB · `}
            {new Date(file.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {canView && (
          <a href={`/api/files/${file.id}`} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm">View</Button>
          </a>
        )}
        <a href={`/api/files/${file.id}?download=true`} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm">Download</Button>
        </a>
        {showDelete && (
          <form action={deleteAction}>
            <Button variant="ghost" size="sm" type="submit">Remove</Button>
          </form>
        )}
      </div>
    </div>
  );
}
