"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadLogo } from "@/lib/actions/builders";

interface LogoUploadProps {
  currentLogoUrl: string | null;
}

export function LogoUpload({ currentLogoUrl }: LogoUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentLogoUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(formData: FormData) {
    setError(null);
    setUploading(true);
    try {
      await uploadLogo(formData);
      const file = formData.get("logo") as File;
      if (file) {
        setPreview(URL.createObjectURL(file));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("File too large. Maximum 5MB.");
        return;
      }
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file.");
        return;
      }
      setPreview(URL.createObjectURL(file));
      setError(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Label>Company Logo</Label>
      {preview && (
        <div className="border rounded-lg p-4 bg-muted/30 flex items-center justify-center">
          <img
            src={preview}
            alt="Company logo"
            className="max-h-24 max-w-full object-contain"
          />
        </div>
      )}
      <form action={handleUpload} className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          name="logo"
          accept="image/*"
          onChange={handleFileChange}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div>
          <Button type="submit" size="sm" disabled={uploading}>
            {uploading ? "Uploading..." : "Upload Logo"}
          </Button>
        </div>
      </form>
    </div>
  );
}
