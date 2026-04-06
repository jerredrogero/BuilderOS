import { getTemplate } from "@/lib/queries/templates";
import {
  updateTemplate,
  deleteTemplate,
} from "@/lib/actions/templates";
import {
  createTemplateItem,
  deleteTemplateItem,
} from "@/lib/actions/template-items";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ItemForm } from "@/components/builder/item-form";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ templateId: string }>;
}

export default async function TemplateDetailPage({ params }: Props) {
  const { templateId } = await params;
  const template = await getTemplate(templateId);

  if (!template) notFound();

  const updateAction = updateTemplate.bind(null, templateId);
  const deleteAction = deleteTemplate.bind(null, templateId);
  const addItemAction = createTemplateItem.bind(null, templateId);

  const items = (template.template_items ?? []) as Array<{
    id: string;
    type: string;
    category: string;
    title: string;
    is_critical: boolean;
    due_date_offset: number | null;
    sort_order: number;
  }>;

  // Group items by category
  const categories = items.reduce<Record<string, typeof items>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const TYPE_LABELS: Record<string, string> = {
    checklist: "Checklist",
    document: "Document",
    warranty: "Warranty",
    utility: "Utility",
    info: "Info",
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{template.name}</h1>
        <form action={deleteAction}>
          <Button type="submit" variant="destructive">
            Delete Template
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Template Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                name="name"
                defaultValue={template.name}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={template.description ?? ""}
              />
            </div>
            <Button type="submit">Save Changes</Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Items ({items.length})</h2>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Add Item</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Item</DialogTitle>
              </DialogHeader>
              <ItemForm action={addItemAction} />
            </DialogContent>
          </Dialog>
        </div>

        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No items yet. Add items to build out this template.
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(categories).map(([category, categoryItems]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="text-base">{category}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {categoryItems.map((item) => {
                    const removeAction = deleteTemplateItem.bind(
                      null,
                      templateId,
                      item.id
                    );
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">
                            {TYPE_LABELS[item.type] ?? item.type}
                          </Badge>
                          <span className="text-sm">{item.title}</span>
                          {item.is_critical && (
                            <Badge variant="destructive">Critical</Badge>
                          )}
                          {item.due_date_offset != null && (
                            <span className="text-xs text-muted-foreground">
                              Day {item.due_date_offset}
                            </span>
                          )}
                        </div>
                        <form action={removeAction}>
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            Remove
                          </Button>
                        </form>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
