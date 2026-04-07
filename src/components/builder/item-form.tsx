"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  onCancel?: () => void;
  submitLabel?: string;
}

export function ItemForm({ action, defaultValues, onCancel, submitLabel = "Save" }: ItemFormProps) {
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

      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

interface EditItemDialogProps {
  item: {
    id: string;
    type: string;
    category: string;
    title: string;
    description?: string | null;
    is_critical: boolean;
    manufacturer?: string | null;
    responsible_party?: string | null;
    registration_url?: string | null;
    utility_type?: string | null;
    metadata?: {
      provider_name?: string;
      provider_phone?: string;
      provider_url?: string;
      transfer_instructions?: string;
    } | null;
  };
  action: (formData: FormData) => Promise<void>;
}

export function EditItemDialog({ item, action }: EditItemDialogProps) {
  const [open, setOpen] = useState(false);

  const defaultValues: DefaultValues = {
    type: item.type,
    category: item.category,
    title: item.title,
    description: item.description ?? "",
    isCritical: item.is_critical,
    manufacturer: item.manufacturer ?? "",
    responsibleParty: item.responsible_party ?? "",
    registrationUrl: item.registration_url ?? "",
    utilityType: item.utility_type ?? "",
    providerName: item.metadata?.provider_name ?? "",
    providerPhone: item.metadata?.provider_phone ?? "",
    providerUrl: item.metadata?.provider_url ?? "",
    transferInstructions: item.metadata?.transfer_instructions ?? "",
  };

  async function handleAction(formData: FormData) {
    await action(formData);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
        </DialogHeader>
        <ItemForm
          action={handleAction}
          defaultValues={defaultValues}
          onCancel={() => setOpen(false)}
          submitLabel="Save Changes"
        />
      </DialogContent>
    </Dialog>
  );
}
