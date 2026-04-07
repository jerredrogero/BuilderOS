import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getHomeAssetsWithCounts } from "@/lib/queries/home-assets";
import { createDraftAsset } from "@/lib/actions/buyer-assets";
import { getThemeStyles } from "@/lib/utils/theme";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";

const CATEGORIES = [
  "HVAC", "Appliances", "Roofing", "Plumbing", "Electrical",
  "Water Heater", "Fixtures", "Garage", "Exterior", "Other",
];

export default async function BuyerAssetsPage({
  params,
}: {
  params: Promise<{ homeId: string }>;
}) {
  const { homeId } = await params;
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

  const { data: home } = await supabase
    .from("homes")
    .select("*, builders(*)")
    .eq("id", homeId)
    .single();

  if (!home) notFound();

  const assets = await getHomeAssetsWithCounts(homeId);
  const builder = home.builders;
  const themeStyles = getThemeStyles(builder);
  const createAction = createDraftAsset.bind(null, homeId);

  return (
    <div style={themeStyles}>
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href={`/home/${homeId}`} className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Dashboard
          </Link>
          <span className="font-semibold" style={{ color: "var(--brand-primary)" }}>
            {builder.name}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Home Assets</h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" style={{ background: "var(--brand-accent)" }}>Add Asset</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add an Appliance or System</DialogTitle>
              </DialogHeader>
              <form action={createAction} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">What is it?</Label>
                  <Input id="name" name="name" placeholder="Dishwasher, HVAC Unit, Water Heater..." required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select name="category" defaultValue="Appliances">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Where in the home?</Label>
                  <Input id="location" name="location" placeholder="Kitchen, Garage, Attic..." />
                </div>
                <p className="text-xs text-muted-foreground">
                  You can add manufacturer and model details later, or upload a photo of the label.
                </p>
                <Button type="submit" className="w-full">Add</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {assets.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No home assets recorded yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add your appliances and systems to track warranties, manuals, and service info.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {assets.map((asset: any) => (
              <Link key={asset.id} href={`/home/${homeId}/assets/${asset.id}`} className="block">
                <div className="flex items-center justify-between rounded-md border p-4 hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="font-medium text-sm">{asset.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {asset.category}
                      {asset.manufacturer && ` \u00b7 ${asset.manufacturer}`}
                      {asset.location && ` \u00b7 ${asset.location}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(!asset.manufacturer || !asset.model_number) && (
                      <Badge variant="secondary" className="text-xs">Needs details</Badge>
                    )}
                    {asset.home_items?.[0]?.count > 0 && (
                      <Badge variant="outline" className="text-xs">{asset.home_items[0].count} warranties</Badge>
                    )}
                    {asset.files?.[0]?.count > 0 && (
                      <Badge variant="outline" className="text-xs">{asset.files[0].count} photos</Badge>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
