import { getHomeAssetsWithCounts } from "@/lib/queries/home-assets";
import { createHomeAsset } from "@/lib/actions/home-assets";
import { AssetForm } from "@/components/builder/asset-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import Link from "next/link";

export default async function AssetsPage({
  params,
}: {
  params: Promise<{ homeId: string }>;
}) {
  const { homeId } = await params;
  const assets = await getHomeAssetsWithCounts(homeId);
  const createAction = createHomeAsset.bind(null, homeId);

  const categories = assets.reduce((acc: Record<string, any[]>, asset: any) => {
    const cat = asset.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(asset);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/homes/${homeId}`} className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Home
          </Link>
          <h1 className="text-2xl font-bold">Assets ({assets.length})</h1>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>Add Asset</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Home Asset</DialogTitle>
            </DialogHeader>
            <AssetForm action={createAction} submitLabel="Create Asset" />
          </DialogContent>
        </Dialog>
      </div>

      {assets.length === 0 ? (
        <p className="text-muted-foreground">No assets yet. Add appliances, systems, and equipment for this home.</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(categories).map(([category, catAssets]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-base">{category}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(catAssets as any[]).map((asset) => (
                  <Link key={asset.id} href={`/homes/${homeId}/assets/${asset.id}`} className="block">
                    <div className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="font-medium text-sm">{asset.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[asset.manufacturer, asset.model_number].filter(Boolean).join(" \u00b7 ") || "No details yet"}
                          {asset.location && ` \u00b7 ${asset.location}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {asset.home_items?.[0]?.count > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {asset.home_items[0].count} items
                          </Badge>
                        )}
                        {asset.files?.[0]?.count > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {asset.files[0].count} photos
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
