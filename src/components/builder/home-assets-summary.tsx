import { getHomeAssetsWithCounts } from "@/lib/queries/home-assets";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export async function HomeAssetsSummary({ homeId }: { homeId: string }) {
  const assets = await getHomeAssetsWithCounts(homeId);

  if (assets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Assets</CardTitle>
            <Link
              href={`/homes/${homeId}/assets`}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Manage
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No assets yet.{" "}
            <Link
              href={`/homes/${homeId}/assets`}
              className="underline hover:text-foreground"
            >
              Add appliances, systems, and equipment.
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  const categories = assets.reduce(
    (acc: Record<string, any[]>, asset: any) => {
      const cat = asset.category || "Other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(asset);
      return acc;
    },
    {}
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Assets ({assets.length})
          </CardTitle>
          <Link
            href={`/homes/${homeId}/assets`}
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            View All
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(categories).map(([category, catAssets]) => (
          <div key={category}>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              {category}
            </p>
            <div className="space-y-1">
              {(catAssets as any[]).map((asset) => (
                <Link
                  key={asset.id}
                  href={`/homes/${homeId}/assets/${asset.id}`}
                  className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm font-medium">{asset.name}</span>
                  <div className="flex items-center gap-1.5">
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
                </Link>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
