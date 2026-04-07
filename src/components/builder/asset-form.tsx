"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AssetFormProps {
  action: (formData: FormData) => Promise<void>;
  defaultValues?: Record<string, any>;
  submitLabel?: string;
}

const CATEGORIES = [
  "HVAC", "Appliances", "Roofing", "Plumbing", "Electrical",
  "Water Heater", "Fixtures", "Garage", "Exterior", "Other",
];

export function AssetForm({ action, defaultValues = {}, submitLabel = "Save" }: AssetFormProps) {
  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select name="category" defaultValue={defaultValues.category || "Appliances"}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={defaultValues.name || ""} required placeholder="Carrier HVAC System" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="manufacturer">Manufacturer</Label>
          <Input id="manufacturer" name="manufacturer" defaultValue={defaultValues.manufacturer || ""} placeholder="Carrier" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="modelNumber">Model Number</Label>
          <Input id="modelNumber" name="modelNumber" defaultValue={defaultValues.model_number || ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="serialNumber">Serial Number</Label>
          <Input id="serialNumber" name="serialNumber" defaultValue={defaultValues.serial_number || ""} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="location">Location in Home</Label>
          <Input id="location" name="location" defaultValue={defaultValues.location || ""} placeholder="Kitchen, Garage, Attic..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="installDate">Install Date</Label>
          <Input id="installDate" name="installDate" type="date" defaultValue={defaultValues.install_date || ""} />
        </div>
      </div>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
