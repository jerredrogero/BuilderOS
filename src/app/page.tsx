import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getBuyerHomes } from "@/lib/queries/homes";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user is a builder (has owner/staff membership)
  const { data: builderMembership } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .in("role", ["owner", "staff"])
    .maybeSingle();

  if (builderMembership) {
    redirect("/dashboard");
  }

  // Check if user is a buyer (has home assignments)
  const homes = await getBuyerHomes(user.id);

  if (homes.length === 1) {
    redirect(`/home/${homes[0].home_id}`);
  }

  if (homes.length > 1) {
    // Multiple homes — show a selection page
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-6 px-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="mt-1 text-muted-foreground">
              Select a home to continue
            </p>
          </div>
          <div className="space-y-3">
            {homes.map((assignment) => {
              const home = assignment.homes as any;
              return (
                <a
                  key={assignment.home_id}
                  href={`/home/${assignment.home_id}`}
                  className="flex flex-col rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <span className="font-medium">
                    {home?.lot_number
                      ? `Lot ${home.lot_number} — ${home.address}`
                      : home?.address ?? "Home"}
                  </span>
                  {home?.builders?.name && (
                    <span className="mt-0.5 text-sm text-muted-foreground">
                      {home.builders.name}
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // No builder membership and no home assignments
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-4 px-4 text-center">
        <h1 className="text-2xl font-bold">No homes assigned</h1>
        <p className="text-muted-foreground">
          You don&apos;t have any homes assigned to your account yet. If you
          received an invitation, please check your email and follow the link
          provided.
        </p>
      </div>
    </div>
  );
}
