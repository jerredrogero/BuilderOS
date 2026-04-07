import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getThemeStyles } from "@/lib/utils/theme";
import { rankItems } from "@/lib/utils/priority";
import { calculateCompletion } from "@/lib/utils/completion";
import { ProgressBar } from "@/components/buyer/progress-bar";
import { PriorityFeed } from "@/components/buyer/priority-feed";
import { Badge } from "@/components/ui/badge";

const RESOLVED_STATUSES = new Set(["complete", "skipped", "not_applicable"]);

export default async function BuyerHomePage({
  params,
}: {
  params: Promise<{ homeId: string }>;
}) {
  const { homeId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch all home assignments for this user (for multi-home nav)
  const { data: allAssignments } = await supabase
    .from("home_assignments")
    .select("id, home_id, homes(address, lot_number)")
    .eq("user_id", user.id);

  const assignments = allAssignments ?? [];
  const assignment = assignments.find((a) => a.home_id === homeId);
  if (!assignment) notFound();

  const hasMultipleHomes = assignments.length > 1;
  const otherHomes = assignments.filter((a) => a.home_id !== homeId);

  // Fetch home with builder info
  const { data: home } = await supabase
    .from("homes")
    .select("*, builders(*)")
    .eq("id", homeId)
    .single();

  if (!home) notFound();

  // Fetch all home items
  const { data: homeItems } = await supabase
    .from("home_items")
    .select("*")
    .eq("home_id", homeId);

  const items: any[] = homeItems ?? [];
  const builder = (home as any).builders;

  const themeStyles = builder
    ? getThemeStyles({
        primary_color: builder.primary_color ?? null,
        accent_color: builder.accent_color ?? null,
      })
    : {};

  // Compute progress from critical items
  const criticalItems = items.filter((i) => i.is_critical);
  const completedCritical = criticalItems.filter((i) =>
    RESOLVED_STATUSES.has(i.status)
  ).length;

  // Ranked active items for the priority feed
  const rankedActive = rankItems(items);

  // Reference items: non-critical, no due date, not resolved
  const referenceItems = items.filter(
    (i) => !i.is_critical && !i.due_date && !RESOLVED_STATUSES.has(i.status)
  );

  const lotLabel = home.lot_number
    ? `Lot ${home.lot_number} — ${home.address}`
    : home.address;

  const builderName = builder?.name ?? "Your Builder";

  return (
    <div style={themeStyles} className="min-h-screen">
      {/* Builder-branded header */}
      <header
        className="border-b"
        style={{ backgroundColor: "var(--brand-primary, #1a1a1a)", color: "#fff" }}
      >
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {builder?.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={builder.logo_url}
                alt={builderName}
                className="h-8 w-auto object-contain"
              />
            )}
            <span className="font-semibold">{builderName}</span>
          </div>
          <div className="flex items-center gap-4">
            {hasMultipleHomes && (
              <details className="relative">
                <summary className="cursor-pointer text-sm opacity-80 hover:opacity-100 list-none">
                  My Homes ▾
                </summary>
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[220px] rounded-md border bg-white shadow-lg">
                  {otherHomes.map((a) => {
                    const h = a.homes as any;
                    const label = h?.lot_number
                      ? `Lot ${h.lot_number} — ${h.address}`
                      : h?.address ?? "Home";
                    return (
                      <Link
                        key={a.home_id}
                        href={`/home/${a.home_id}`}
                        className="block px-4 py-2 text-sm text-gray-800 hover:bg-gray-100"
                      >
                        {label}
                      </Link>
                    );
                  })}
                </div>
              </details>
            )}
            <Link
              href={`/home/${homeId}/documents`}
              className="text-sm opacity-80 hover:opacity-100"
            >
              Documents
            </Link>
            <Link
              href={`/home/${homeId}/assets`}
              className="text-sm opacity-80 hover:opacity-100"
            >
              Assets
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        {/* Welcome */}
        <section>
          <h1 className="text-2xl font-bold">{lotLabel}</h1>
          {builder?.welcome_message && (
            <p className="mt-1 text-muted-foreground">{builder.welcome_message}</p>
          )}
        </section>

        {/* Progress */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold">Your Progress</h2>
          <ProgressBar completed={completedCritical} total={criticalItems.length} />
        </section>

        {/* Priority feed */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold">What to do next</h2>
          <PriorityFeed items={rankedActive} homeId={homeId} />
        </section>

        {/* Reference items */}
        {referenceItems.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Reference Information</h2>
            <div className="space-y-2">
              {referenceItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/home/${homeId}/items/${item.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
                >
                  {item.type && (
                    <Badge variant="outline" className="shrink-0 capitalize">
                      {item.type}
                    </Badge>
                  )}
                  <span className="truncate font-medium">{item.title}</span>
                  {item.category && (
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {item.category}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Contact builder */}
        <section className="rounded-lg border border-border bg-muted/30 px-6 py-5">
          <p className="text-sm font-medium">
            Have a question? Contact {builderName}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {builder?.contact_email && (
              <a
                href={`mailto:${builder.contact_email}`}
                className="text-[var(--brand-accent,#2563eb)] hover:underline"
              >
                {builder.contact_email}
              </a>
            )}
            {builder?.contact_phone && (
              <a
                href={`tel:${builder.contact_phone}`}
                className="text-[var(--brand-accent,#2563eb)] hover:underline"
              >
                {builder.contact_phone}
              </a>
            )}
            {!builder?.contact_email && !builder?.contact_phone && (
              <span className="text-muted-foreground">
                Contact information not available.
              </span>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
