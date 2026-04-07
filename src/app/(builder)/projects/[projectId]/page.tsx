import { getProject } from "@/lib/queries/projects";
import { updateProject, deleteProject } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/builder/confirm-delete-button";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDetailPage({ params }: Props) {
  const { projectId } = await params;
  const project = await getProject(projectId);

  if (!project) notFound();

  const updateAction = updateProject.bind(null, projectId);
  const deleteAction = deleteProject.bind(null, projectId);

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-6">{project.name}</h1>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" defaultValue={project.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" defaultValue={project.city ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" defaultValue={project.state ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zipCode">Zip Code</Label>
              <Input id="zipCode" name="zipCode" defaultValue={project.zip_code ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subdivision">Subdivision</Label>
              <Input id="subdivision" name="subdivision" defaultValue={project.subdivision ?? ""} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit">Save Changes</Button>
              <ConfirmDeleteButton
                action={deleteAction}
                label="Delete Project"
                description="Are you sure you want to delete this project? All homes associated with this project may be affected. This action cannot be undone."
              />
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
