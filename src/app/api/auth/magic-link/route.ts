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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const acceptUrl = `${appUrl}/accept-invite?token=${token}`;

  const supabase = await createServiceClient();

  await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: acceptUrl,
    },
  });

  return NextResponse.redirect(
    new URL(`/accept-invite?token=${token}&sent=true`, request.url)
  );
}
