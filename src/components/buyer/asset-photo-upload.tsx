"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface AssetPhotoUploadProps {
  uploadAction: (formData: FormData) => Promise<void>;
}

export function AssetPhotoUpload({ uploadAction }: AssetPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setUploading(true);
    try {
      await uploadAction(formData);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="file">Take a photo of the appliance label, serial number plate, or model tag</Label>
        <Input
          id="file"
          name="file"
          type="file"
          accept="image/*"
          capture="environment"
          required
        />
      </div>
      <Button type="submit" disabled={uploading} className="w-full">
        {uploading ? "Uploading..." : "Upload Photo"}
      </Button>
    </form>
  );
}
