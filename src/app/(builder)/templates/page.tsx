import { getTemplates } from "@/lib/queries/templates";
import { createTemplate } from "@/lib/actions/templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";

export default async function TemplatesPage() {
  const templates = await getTemplates();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Templates</h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button>New Template</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Template</DialogTitle>
            </DialogHeader>
            <form action={createTemplate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" />
              </div>
              <Button type="submit" className="w-full">
                Create Template
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!templates || templates.length === 0 ? (
        <p className="text-muted-foreground">
          No templates yet. Create one to build reusable handoff blueprints.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            const itemCount = (template.template_items as any)?.[0]?.count ?? 0;

            return (
              <Link key={template.id} href={`/templates/${template.id}`}>
                <Card className="hover:border-foreground/20 transition-colors cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      {template.is_starter && (
                        <Badge variant="secondary">Starter</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <p>
                      {itemCount} {itemCount === 1 ? "item" : "items"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
