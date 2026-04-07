import { getHomeAsset } from "@/lib/queries/home-assets";
import { updateHomeAsset, deleteHomeAsset, uploadAssetPhoto } from "@/lib/actions/home-assets";
import { AssetForm } from "@/components/builder/asset-form";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ homeId: string; assetId: string }>;
}) {
  const { homeId, assetId } = await params;
  const asset = await getHomeAsset(assetId);

  if (!asset) notFound();

  const updateAction = updateHomeAsset.bind(null, homeId, assetId);
  const deleteAction = deleteHomeAsset.bind(null, homeId, assetId);
  const uploadAction = uploadAssetPhoto.bind(null, homeId, assetId);

  const warranties = (asset.home_items || []).filter((i: any) => i.type === "warranty");
  const documents = (asset.home_items || []).filter((i: any) => i.type === "document");
  const otherItems = (asset.home_items || []).filter((i: any) => !["warranty", "document"].includes(i.type));
  const photos = asset.files || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/homes/${homeId}/assets`} className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Assets
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{asset.name}</h1>
            <p className="text-sm text-muted-foreground">
              {[asset.manufacturer, asset.model_number, asset.serial_number].filter(Boolean).join(" \u00b7 ")}
              {asset.location && ` \u00b7 ${asset.location}`}
            </p>
          </div>
        </div>
        <form action={deleteAction}>
          <Button variant="destructive" size="sm" type="submit">Delete Asset</Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Asset Details</CardTitle>
        </CardHeader>
        <CardContent>
          <AssetForm action={updateAction} defaultValues={asset} submitLabel="Save Changes" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Photos ({photos.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={uploadAction} className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="file">Upload photo (label, installation, serial number plate)</Label>
              <Input id="file" name="file" type="file" accept="image/*" required />
            </div>
            <Button type="submit">Upload</Button>
          </form>
          {photos.length > 0 && (
            <div className="space-y-2">
              {photos.map((photo: any) => (
                <div key={photo.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">{photo.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {photo.size_bytes ? `${Math.round(photo.size_bytes / 1024)}KB` : ""} · {new Date(photo.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">{photo.mime_type?.split("/")[1] || "file"}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {warranties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Warranties ({warranties.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {warranties.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm font-medium">{item.title}</span>
                <div className="flex items-center gap-2">
                  {item.registration_deadline && (
                    <span className="text-xs text-muted-foreground">Due: {item.registration_deadline}</span>
                  )}
                  <Badge variant={item.registration_status === "registered" ? "default" : "secondary"} className="text-xs">
                    {item.registration_status || item.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documents ({documents.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {documents.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm font-medium">{item.title}</span>
                <Badge variant="outline" className="text-xs">{item.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {otherItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Other Items ({otherItems.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {otherItems.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{item.type}</Badge>
                  <span className="text-sm font-medium">{item.title}</span>
                </div>
                <Badge variant="outline" className="text-xs">{item.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
