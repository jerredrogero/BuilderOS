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

export function FileRow({ file, showDelete = true }: FileRowProps) {
  const deleteAction = deleteFile.bind(null, file.id);
  const sizeKB = file.size_bytes ? Math.round(file.size_bytes / 1024) : null;
  const ext = file.mime_type?.split("/")[1] || file.filename.split(".").pop() || "file";

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
        <a href={`/api/files/${file.id}`} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm">View</Button>
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
