import { createClient } from "@/lib/supabase/server";
import { getCurrentBuilder } from "@/lib/queries/builders";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RESOLVED_STATUSES = new Set(["complete", "skipped", "not_applicable"]);

function severityVariant(
  severity: string | null
): "default" | "secondary" | "destructive" | "outline" {
  switch (severity) {
    case "safety":
      return "destructive";
    case "functional":
      return "default";
    case "cosmetic":
      return "secondary";
    default:
      return "outline";
  }
}

async function createPunchListItem(homeId: string, formData: FormData) {
  "use server";

  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context) throw new Error("Unauthorized");

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const severity = formData.get("severity") as string;
  const assignedTo = formData.get("assignedTo") as string;

  if (!title) throw new Error("Title is required");

  const { error } = await supabase.from("home_items").insert({
    home_id: homeId,
    builder_id: context.builder.id,
    type: "punch_list",
    title,
    description: description || null,
    severity: severity || "cosmetic",
    assigned_to: assignedTo || "builder",
    status: "pending",
    is_critical: severity === "safety",
  });

  if (error) throw new Error("Failed to create punch list item");

  await supabase.from("activity_log").insert({
    builder_id: context.builder.id,
    home_id: homeId,
    actor_type: "user",
    actor_id: context.userId,
    action: "punch_list_item_created",
    metadata: { title, severity, assigned_to: assignedTo },
  });

  revalidatePath(`/homes/${homeId}/punch-list`);
}

export default async function PunchListPage({
  params,
}: {
  params: Promise<{ homeId: string }>;
}) {
  const { homeId } = await params;
  const context = await getCurrentBuilder();
  if (!context) redirect("/login");

  const supabase = await createClient();

  const { data: home } = await supabase
    .from("homes")
    .select("id, address, lot_number")
    .eq("id", homeId)
    .eq("builder_id", context.builder.id)
    .single();

  if (!home) notFound();

  const { data: items } = await supabase
    .from("home_items")
    .select("*")
    .eq("home_id", homeId)
    .eq("type", "punch_list")
    .order("created_at", { ascending: false });

  const punchItems = items ?? [];
  const openItems = punchItems.filter((i) => !RESOLVED_STATUSES.has(i.status));
  const resolvedItems = punchItems.filter((i) => RESOLVED_STATUSES.has(i.status));

  const createAction = createPunchListItem.bind(null, homeId);

  const lotLabel = home.lot_number
    ? `Lot ${home.lot_number} — ${home.address}`
    : home.address;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/homes/${homeId}`} className="hover:text-foreground">
          {lotLabel}
        </Link>
        <span>/</span>
        <span>Punch List</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Punch List</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {openItems.length} open &middot; {resolvedItems.length} resolved
          </p>
        </div>
      </div>

      {/* Create form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Punch List Item</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAction} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="Describe the issue..."
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  name="description"
                  placeholder="Additional details, location, etc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="severity">Severity</Label>
                <Select name="severity" defaultValue="cosmetic">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cosmetic">Cosmetic</SelectItem>
                    <SelectItem value="functional">Functional</SelectItem>
                    <SelectItem value="safety">Safety</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignedTo">Assigned To</Label>
                <Select name="assignedTo" defaultValue="builder">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="builder">Builder</SelectItem>
                    <SelectItem value="subcontractor">Subcontractor</SelectItem>
                    <SelectItem value="buyer">Buyer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit">Add Item</Button>
          </form>
        </CardContent>
      </Card>

      {/* Open items */}
      {openItems.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">Open Items</h2>
          <div className="space-y-2">
            {openItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {item.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <Badge variant={severityVariant(item.severity)} className="capitalize text-xs">
                    {item.severity ?? "unknown"}
                  </Badge>
                  {item.assigned_to && (
                    <Badge variant="outline" className="capitalize text-xs">
                      {item.assigned_to}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Resolved items */}
      {resolvedItems.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-muted-foreground">
            Resolved ({resolvedItems.length})
          </h2>
          <div className="space-y-2">
            {resolvedItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3 opacity-60"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium line-through">{item.title}</p>
                  {item.resolution_notes && (
                    <p className="text-xs text-muted-foreground truncate">
                      {item.resolution_notes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <Badge variant="outline" className="capitalize text-xs">
                    {item.severity ?? "unknown"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-xs text-green-600 border-green-200"
                  >
                    Resolved
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {punchItems.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">No punch list items yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Use the form above to add items that need attention before or
              after closing.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
