import { redirect } from "next/navigation";
import { getCurrentBuilder } from "@/lib/queries/builders";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function BuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getCurrentBuilder();

  if (!context) {
    redirect("/login");
  }

  const { builder } = context;

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold">
              {builder.name}
            </Link>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
                Dashboard
              </Link>
              <Link href="/homes" className="text-muted-foreground hover:text-foreground">
                Homes
              </Link>
              <Link href="/templates" className="text-muted-foreground hover:text-foreground">
                Templates
              </Link>
              <Link href="/projects" className="text-muted-foreground hover:text-foreground">
                Projects
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground">
              Settings
            </Link>
            <form action={signOut}>
              <Button variant="ghost" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
