import { getTemplates } from "@/lib/queries/templates";
import { getProjects } from "@/lib/queries/projects";
import { createHome } from "@/lib/actions/homes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default async function NewHomePage() {
  const [templates, projects] = await Promise.all([getTemplates(), getProjects()]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Create Home</h1>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Home Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createHome} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="templateId">Template *</Label>
              <Select name="templateId" required>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="projectId">Project</Label>
              <Select name="projectId">
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {projects?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Input id="address" name="address" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lotNumber">Lot Number</Label>
              <Input id="lotNumber" name="lotNumber" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="closeDate">Close Date *</Label>
              <Input id="closeDate" name="closeDate" type="date" required />
            </div>

            <Button type="submit" className="w-full">
              Create Home
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
