"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;
  const companyName = formData.get("companyName") as string;

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (authError || !authData.user) {
    throw new Error(authError?.message || "Signup failed");
  }

  // 2. Create builder tenant
  const { data: builder, error: builderError } = await supabase
    .from("builders")
    .insert({
      name: companyName,
      slug: generateSlug(companyName),
      contact_email: email,
    })
    .select()
    .single();

  if (builderError) {
    throw new Error("Failed to create builder account");
  }

  // 3. Create owner membership
  const { error: membershipError } = await supabase
    .from("memberships")
    .insert({
      user_id: authData.user.id,
      builder_id: builder.id,
      role: "owner",
    });

  if (membershipError) {
    throw new Error("Failed to create membership");
  }

  redirect("/dashboard");
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
