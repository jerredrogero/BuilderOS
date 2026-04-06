"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DefaultValues {
  type?: string;
  category?: string;
  title?: string;
  description?: string;
  isCritical?: boolean;
  dueDateOffset?: number | null;
  // warranty
  manufacturer?: string;
  responsibleParty?: string;
  registrationUrl?: string;
  registrationDeadlineOffset?: number | null;
  // utility
  utilityType?: string;
  providerName?: string;
  providerPhone?: string;
  providerUrl?: string;
  transferInstructions?: string;
  // info
  content?: string;
}

interface ItemFormProps {
  action: (formData: FormData) => Promise<void>;
  defaultValues?: DefaultValues;
}

export function ItemForm({ action, defaultValues }: ItemFormProps) {
  const [type, setType] = useState(defaultValues?.type ?? "checklist");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="type" value={type} />

      <div className="space-y-2">
        <Label>Type</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="checklist">Checklist</SelectItem>
            <SelectItem value="document">Document</SelectItem>
            <SelectItem value="warranty">Warranty</SelectItem>
            <SelectItem value="utility">Utility</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Input
          id="category"
          name="category"
          required
          defaultValue={defaultValues?.category ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          defaultValue={defaultValues?.title ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={defaultValues?.description ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dueDateOffset">Due Date Offset (days)</Label>
        <Input
          id="dueDateOffset"
          name="dueDateOffset"
          type="number"
          defaultValue={defaultValues?.dueDateOffset ?? ""}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="isCritical"
          name="isCritical"
          type="checkbox"
          defaultChecked={defaultValues?.isCritical ?? false}
          className="h-4 w-4"
        />
        <Label htmlFor="isCritical">Critical item</Label>
      </div>

      {type === "warranty" && (
        <div className="space-y-4 border rounded-md p-4">
          <p className="text-sm font-medium text-muted-foreground">Warranty Details</p>
          <div className="space-y-2">
            <Label htmlFor="manufacturer">Manufacturer</Label>
            <Input
              id="manufacturer"
              name="manufacturer"
              defaultValue={defaultValues?.manufacturer ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label>Responsible Party</Label>
            <Select name="responsibleParty" defaultValue={defaultValues?.responsibleParty ?? ""}>
              <SelectTrigger>
                <SelectValue placeholder="Select party" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="buyer">Buyer</SelectItem>
                <SelectItem value="builder">Builder</SelectItem>
                <SelectItem value="subcontractor">Subcontractor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="registrationUrl">Registration URL</Label>
            <Input
              id="registrationUrl"
              name="registrationUrl"
              type="url"
              defaultValue={defaultValues?.registrationUrl ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="registrationDeadlineOffset">
              Registration Deadline Offset (days)
            </Label>
            <Input
              id="registrationDeadlineOffset"
              name="registrationDeadlineOffset"
              type="number"
              defaultValue={defaultValues?.registrationDeadlineOffset ?? ""}
            />
          </div>
        </div>
      )}

      {type === "utility" && (
        <div className="space-y-4 border rounded-md p-4">
          <p className="text-sm font-medium text-muted-foreground">Utility Details</p>
          <div className="space-y-2">
            <Label>Utility Type</Label>
            <Select name="utilityType" defaultValue={defaultValues?.utilityType ?? ""}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="electric">Electric</SelectItem>
                <SelectItem value="gas">Gas</SelectItem>
                <SelectItem value="water">Water</SelectItem>
                <SelectItem value="sewer">Sewer</SelectItem>
                <SelectItem value="trash">Trash</SelectItem>
                <SelectItem value="internet">Internet</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="providerName">Provider Name</Label>
            <Input
              id="providerName"
              name="providerName"
              defaultValue={defaultValues?.providerName ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="providerPhone">Provider Phone</Label>
            <Input
              id="providerPhone"
              name="providerPhone"
              type="tel"
              defaultValue={defaultValues?.providerPhone ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="providerUrl">Provider URL</Label>
            <Input
              id="providerUrl"
              name="providerUrl"
              type="url"
              defaultValue={defaultValues?.providerUrl ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="transferInstructions">Transfer Instructions</Label>
            <Textarea
              id="transferInstructions"
              name="transferInstructions"
              defaultValue={defaultValues?.transferInstructions ?? ""}
            />
          </div>
        </div>
      )}

      <Button type="submit" className="w-full">
        Save
      </Button>
    </form>
  );
}
