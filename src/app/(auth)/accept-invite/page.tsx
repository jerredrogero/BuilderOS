import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; sent?: string }>;
}) {
  const { token, sent } = await searchParams;

  if (!token) {
    return <ErrorCard message="Invalid or missing invitation link." />;
  }

  const serviceClient = await createServiceClient();

  // Look up invitation by token
  const { data: invitation } = await serviceClient
    .from("invitations")
    .select("*, homes(id, address, builder_id, handoff_status, builders(name, primary_color))")
    .eq("token", token)
    .single();

  if (!invitation) {
    return <ErrorCard message="This invitation link is invalid or has expired." />;
  }

  if (invitation.status === "accepted") {
    return <ErrorCard message="This invitation has already been accepted." />;
  }

  // Check if user is logged in
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const home = invitation.homes as any;
  const builder = home?.builders as any;

  if (user) {
    // Accept immediately
    const now = new Date().toISOString();

    // Upsert membership (buyer role)
    await serviceClient.from("memberships").upsert(
      {
        user_id: user.id,
        builder_id: home.builder_id,
        role: invitation.role ?? "primary_buyer",
      },
      { onConflict: "user_id,builder_id" }
    );

    // Upsert home assignment
    await serviceClient.from("home_assignments").upsert(
      {
        home_id: home.id,
        user_id: user.id,
        role: invitation.role ?? "primary_buyer",
      },
      { onConflict: "home_id,user_id" }
    );

    // Update invitation to accepted
    await serviceClient
      .from("invitations")
      .update({ status: "accepted", accepted_at: now })
      .eq("id", invitation.id);

    // Advance home handoff status to activated
    await serviceClient
      .from("homes")
      .update({ handoff_status: "activated", updated_at: now })
      .eq("id", home.id);

    // Log activity
    await serviceClient.from("activity_log").insert({
      builder_id: home.builder_id,
      home_id: home.id,
      event_type: "invitation_accepted",
      payload: { user_id: user.id, invitation_id: invitation.id },
    });

    redirect(`/home/${home.id}`);
  }

  // Not logged in — show sign-in card
  const primaryColor = builder?.primary_color ?? "#000000";
  const builderName = builder?.name ?? "Your builder";

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle style={{ color: primaryColor }}>Check your email</CardTitle>
            <CardDescription>
              We sent a sign-in link to the address associated with this invitation.
              Click the link in the email to access your home details.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle style={{ color: primaryColor }}>Your new home is ready</CardTitle>
          <CardDescription>
            {builderName} has invited you to view your home at {home?.address}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/api/auth/magic-link" method="POST">
            <input type="hidden" name="email" value={invitation.email} />
            <input type="hidden" name="token" value={token} />
            <Button
              type="submit"
              className="w-full"
              style={{ backgroundColor: primaryColor }}
            >
              Send Sign-In Link
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Unable to accept invitation</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
