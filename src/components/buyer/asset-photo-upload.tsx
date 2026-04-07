"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useRef } from "react";

interface AssetPhotoUploadProps {
  uploadAction: (formData: FormData) => Promise<void>;
}

export function AssetPhotoUpload({ uploadAction }: AssetPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setUploading(true);
    setError(null);
    setSuccess(false);
    try {
      await uploadAction(formData);
      setSuccess(true);
      formRef.current?.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="file">Take a photo of the appliance label, serial number plate, or model tag</Label>
        <Input
          id="file"
          name="file"
          type="file"
          accept="image/*"
          capture="environment"
          required
          onChange={() => { setError(null); setSuccess(false); }}
        />
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600">Photo uploaded successfully.</p>
      )}
      <Button type="submit" disabled={uploading} className="w-full">
        {uploading ? "Uploading..." : "Upload Photo"}
      </Button>
    </form>
  );
}
