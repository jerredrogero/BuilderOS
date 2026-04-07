import { createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const token = formData.get("token") as string;

  if (!email || !token) {
    return NextResponse.redirect(
      new URL(`/accept-invite?token=${token}&error=missing`, request.url)
    );
  }

  const supabase = await createServiceClient();

  // Verify invitation exists, is not expired, and is not already accepted
  const { data: invitation } = await supabase
    .from("invitations")
    .select("id, status, expires_at")
    .eq("token", token)
    .single();

  if (!invitation) {
    return NextResponse.redirect(
      new URL(`/accept-invite?token=${token}&error=invalid`, request.url)
    );
  }

  if (invitation.status === "accepted") {
    return NextResponse.redirect(
      new URL(`/accept-invite?token=${token}&error=accepted`, request.url)
    );
  }

  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    // Mark as expired in DB
    await supabase
      .from("invitations")
      .update({ status: "expired" })
      .eq("id", invitation.id);

    return NextResponse.redirect(
      new URL(`/accept-invite?token=${token}&error=expired`, request.url)
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const acceptUrl = `${appUrl}/accept-invite?token=${token}`;

  const { error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: acceptUrl,
    },
  });

  if (error) {
    console.error("Failed to generate magic link:", error.message);
    return NextResponse.redirect(
      new URL(`/accept-invite?token=${token}&error=email`, request.url)
    );
  }

  return NextResponse.redirect(
    new URL(`/accept-invite?token=${token}&sent=true`, request.url)
  );
}
