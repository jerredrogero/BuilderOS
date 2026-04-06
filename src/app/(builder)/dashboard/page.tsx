import { getCurrentBuilder } from "@/lib/queries/builders";

export default async function DashboardPage() {
  const context = await getCurrentBuilder();

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">
        Welcome to {context!.builder.name}. Your dashboard will show homes and status here.
      </p>
    </div>
  );
}
