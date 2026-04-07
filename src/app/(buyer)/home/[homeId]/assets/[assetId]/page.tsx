import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getHomeAsset } from "@/lib/queries/home-assets";
import { updateAssetFromBuyer, uploadBuyerAssetPhoto } from "@/lib/actions/buyer-assets";
import { AssetPhotoUpload } from "@/components/buyer/asset-photo-upload";
import { getThemeStyles } from "@/lib/utils/theme";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function BuyerAssetDetailPage({
  params,
}: {
  params: Promise<{ homeId: string; assetId: string }>;
}) {
  const { homeId, assetId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: assignment } = await supabase
    .from("home_assignments")
    .select("*")
    .eq("home_id", homeId)
    .eq("user_id", user.id)
    .single();

  if (!assignment) notFound();

  const asset = await getHomeAsset(assetId);
  if (!asset) notFound();

  const { data: home } = await supabase
    .from("homes")
    .select("builders(*)")
    .eq("id", homeId)
    .single();

  const builder = home?.builders as any;
  const themeStyles = getThemeStyles(builder || { primary_color: null, accent_color: null });

  const updateAction = updateAssetFromBuyer.bind(null, homeId, assetId);
  const uploadAction = uploadBuyerAssetPhoto.bind(null, homeId, assetId);

  const warranties = (asset.home_items || []).filter((i: any) => i.type === "warranty");
  const photos = asset.files || [];
  const needsDetails = !asset.manufacturer || !asset.model_number || !asset.serial_number;

  return (
    <div style={themeStyles}>
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href={`/home/${homeId}/assets`} className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Assets
          </Link>
          <span className="font-semibold" style={{ color: "var(--brand-primary)" }}>
            {builder?.name}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div>
          <Badge variant="outline" className="mb-2">{asset.category}</Badge>
          <h1 className="text-2xl font-bold">{asset.name}</h1>
          {asset.location && (
            <p className="text-muted-foreground text-sm">{asset.location}</p>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Photos ({photos.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AssetPhotoUpload uploadAction={uploadAction} />
            {photos.length > 0 && (
              <div className="space-y-2">
                {photos.map((photo: any) => (
                  <div key={photo.id} className="flex items-center justify-between rounded-md border p-3">
                    <p className="text-sm">{photo.filename}</p>
                    <span className="text-xs text-muted-foreground">
                      {new Date(photo.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Details
              {needsDetails && (
                <Badge variant="secondary" className="ml-2 text-xs">Incomplete</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateAction} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Input id="manufacturer" name="manufacturer" defaultValue={asset.manufacturer || ""} placeholder="Carrier, Bosch..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modelNumber">Model Number</Label>
                  <Input id="modelNumber" name="modelNumber" defaultValue={asset.model_number || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serialNumber">Serial Number</Label>
                  <Input id="serialNumber" name="serialNumber" defaultValue={asset.serial_number || ""} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location in Home</Label>
                <Input id="location" name="location" defaultValue={asset.location || ""} />
              </div>
              <Button type="submit" style={{ background: "var(--brand-accent)" }}>Save Details</Button>
            </form>
          </CardContent>
        </Card>

        {warranties.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Warranties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {warranties.map((item: any) => (
                <Link key={item.id} href={`/home/${homeId}/items/${item.id}`} className="block">
                  <div className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50">
                    <span className="text-sm font-medium">{item.title}</span>
                    <Badge variant={item.registration_status === "registered" ? "default" : "secondary"} className="text-xs">
                      {item.registration_status || item.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
