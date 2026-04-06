import { createClient } from "@/lib/supabase/server";

export async function getCurrentBuilder() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("builder_id, role, builders(*)")
    .eq("user_id", user.id)
    .in("role", ["owner", "staff"])
    .single();

  if (membershipError) {
    console.error("Membership query error:", membershipError.message, "for user:", user.id);
  }

  if (!membership) return null;

  return {
    builder: membership.builders as any,
    role: membership.role,
    userId: user.id,
  };
}
