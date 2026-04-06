import { getCurrentBuilder } from "@/lib/queries/builders";
import { updateBuilderSettings } from "@/lib/actions/builders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default async function SettingsPage() {
  const context = await getCurrentBuilder();
  const builder = context?.builder;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Company Info</CardTitle>
          <CardDescription>
            This information appears on your buyer-facing pages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateBuilderSettings} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Company Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                defaultValue={builder?.name ?? ""}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input
                id="contactEmail"
                name="contactEmail"
                type="email"
                defaultValue={builder?.contact_email ?? ""}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                name="contactPhone"
                type="text"
                defaultValue={builder?.contact_phone ?? ""}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="welcomeMessage">Welcome Message</Label>
              <Textarea
                id="welcomeMessage"
                name="welcomeMessage"
                placeholder="Congratulations on your new home! Here's everything you need to get settled in."
                defaultValue={builder?.welcome_message ?? ""}
                rows={4}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="primaryColor"
                  name="primaryColor"
                  type="color"
                  defaultValue={builder?.primary_color ?? "#000000"}
                  className="w-12 h-9 cursor-pointer p-1"
                />
                <Input
                  type="text"
                  disabled
                  defaultValue={builder?.primary_color ?? "#000000"}
                  className="w-32 font-mono text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="accentColor">Accent Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="accentColor"
                  name="accentColor"
                  type="color"
                  defaultValue={builder?.accent_color ?? "#000000"}
                  className="w-12 h-9 cursor-pointer p-1"
                />
                <Input
                  type="text"
                  disabled
                  defaultValue={builder?.accent_color ?? "#000000"}
                  className="w-32 font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
