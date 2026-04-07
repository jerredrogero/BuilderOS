# Three Canonical Flows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build three end-to-end product flows that prove the asset-aware domain model works: builder handoff with assets, inspection-to-punch-list, and buyer photo upload to asset enrichment.

**Architecture:** Server actions for mutations, server components for pages, client components only where interactivity is required (photo upload, finding conversion). All flows follow existing patterns: `getCurrentBuilder()` for auth, `revalidatePath()` after mutations, activity logging for all significant actions.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + Storage), TypeScript, Tailwind CSS, shadcn/ui

**Existing patterns to follow:**
- Server actions: `"use server"`, `getCurrentBuilder()`, `createClient()`, throw on error, `revalidatePath()`
- Pages: `async function Page({ params })`, `await params`, fetch data, `notFound()` if missing
- Forms: `<form action={serverAction.bind(null, id)}>` with FormData
- Client components: `"use client"`, `useState` for interactivity, call server actions from handlers
- Files: upload to Supabase Storage at `{builder_id}/{home_id}/{context}/{timestamp}-{filename}`

---

## File Structure

```
src/
├── lib/
│   ├── actions/
│   │   ├── home-assets.ts          # Asset CRUD + photo attachment
│   │   ├── inspection-reports.ts   # Report upload, finding creation, finding→task conversion
│   │   └── buyer-assets.ts         # Buyer photo upload → asset enrichment
│   └── queries/
│       ├── home-assets.ts          # Asset queries (by home, by id, with related items/files)
│       └── inspection-reports.ts   # Report + findings queries
├── app/
│   ├── (builder)/
│   │   └── homes/
│   │       └── [homeId]/
│   │           ├── assets/
│   │           │   ├── page.tsx              # Asset list for a home
│   │           │   └── [assetId]/page.tsx    # Asset detail (linked warranties, docs, photos)
│   │           └── inspections/
│   │               ├── page.tsx              # Inspection reports list + upload
│   │               └── [reportId]/page.tsx   # Findings list + convert-to-task
│   └── (buyer)/
│       └── home/
│           └── [homeId]/
│               └── assets/
│                   ├── page.tsx              # Buyer asset list
│                   └── [assetId]/page.tsx     # Buyer asset detail + photo upload
└── components/
    ├── builder/
    │   ├── asset-form.tsx           # Client: create/edit asset form
    │   ├── finding-card.tsx         # Finding display with convert-to-task button
    │   └── finding-form.tsx         # Client: create finding from report
    └── buyer/
        └── asset-photo-upload.tsx   # Client: photo upload + asset field extraction
```

---

## Task 1: Home Asset Queries & Actions

**Files:**
- Create: `src/lib/queries/home-assets.ts`
- Create: `src/lib/actions/home-assets.ts`

- [ ] **Step 1: Create asset queries**

Create `src/lib/queries/home-assets.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { getCurrentBuilder } from "./builders";

export async function getHomeAssets(homeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("home_assets")
    .select("*")
    .eq("home_id", homeId)
    .order("category", { ascending: true });
  return data || [];
}

export async function getHomeAsset(assetId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("home_assets")
    .select(`
      *,
      home_items(id, type, title, status, is_critical, registration_status, registration_deadline, due_date),
      files(id, filename, mime_type, size_bytes, storage_path, created_at)
    `)
    .eq("id", assetId)
    .single();
  return data;
}

export async function getHomeAssetsWithCounts(homeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("home_assets")
    .select("*, home_items(count), files(count)")
    .eq("home_id", homeId)
    .order("category", { ascending: true });
  return data || [];
}
```

- [ ] **Step 2: Create asset actions**

Create `src/lib/actions/home-assets.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBuilder } from "@/lib/queries/builders";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createHomeAsset(homeId: string, formData: FormData) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context || context.role !== "owner") throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("home_assets")
    .insert({
      home_id: homeId,
      builder_id: context.builder.id,
      category: formData.get("category") as string,
      name: formData.get("name") as string,
      manufacturer: formData.get("manufacturer") as string || null,
      model_number: formData.get("modelNumber") as string || null,
      serial_number: formData.get("serialNumber") as string || null,
      install_date: formData.get("installDate") as string || null,
      location: formData.get("location") as string || null,
    })
    .select()
    .single();

  if (error) throw new Error("Failed to create asset");

  await supabase.from("activity_log").insert({
    builder_id: context.builder.id,
    home_id: homeId,
    actor_type: "user",
    actor_id: context.userId,
    action: "asset_created",
    metadata: { asset_id: data.id, name: data.name },
  });

  revalidatePath(`/homes/${homeId}/assets`);
  redirect(`/homes/${homeId}/assets/${data.id}`);
}

export async function updateHomeAsset(homeId: string, assetId: string, formData: FormData) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context || context.role !== "owner") throw new Error("Unauthorized");

  const { error } = await supabase
    .from("home_assets")
    .update({
      category: formData.get("category") as string,
      name: formData.get("name") as string,
      manufacturer: formData.get("manufacturer") as string || null,
      model_number: formData.get("modelNumber") as string || null,
      serial_number: formData.get("serialNumber") as string || null,
      install_date: formData.get("installDate") as string || null,
      location: formData.get("location") as string || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assetId)
    .eq("builder_id", context.builder.id);

  if (error) throw new Error("Failed to update asset");

  revalidatePath(`/homes/${homeId}/assets/${assetId}`);
  revalidatePath(`/homes/${homeId}/assets`);
}

export async function deleteHomeAsset(homeId: string, assetId: string) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context || context.role !== "owner") throw new Error("Unauthorized");

  const { error } = await supabase
    .from("home_assets")
    .delete()
    .eq("id", assetId)
    .eq("builder_id", context.builder.id);

  if (error) throw new Error("Failed to delete asset");

  revalidatePath(`/homes/${homeId}/assets`);
  redirect(`/homes/${homeId}/assets`);
}

export async function linkItemToAsset(homeId: string, itemId: string, assetId: string) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context || context.role !== "owner") throw new Error("Unauthorized");

  const { error } = await supabase
    .from("home_items")
    .update({ home_asset_id: assetId, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("home_id", homeId);

  if (error) throw new Error("Failed to link item to asset");

  revalidatePath(`/homes/${homeId}/assets/${assetId}`);
}

export async function uploadAssetPhoto(homeId: string, assetId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");
  if (file.size > 25 * 1024 * 1024) throw new Error("File too large. Maximum 25MB.");

  const { data: asset } = await supabase
    .from("home_assets")
    .select("builder_id")
    .eq("id", assetId)
    .single();

  if (!asset) throw new Error("Asset not found");

  const storagePath = `${asset.builder_id}/${homeId}/assets/${assetId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, file);

  if (uploadError) throw new Error("Failed to upload file");

  const { error: dbError } = await supabase
    .from("files")
    .insert({
      builder_id: asset.builder_id,
      home_id: homeId,
      home_asset_id: assetId,
      uploaded_by: user.id,
      storage_path: storagePath,
      filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    });

  if (dbError) throw new Error("Failed to save file record");

  await supabase.from("activity_log").insert({
    builder_id: asset.builder_id,
    home_id: homeId,
    actor_type: "user",
    actor_id: user.id,
    action: "asset_photo_uploaded",
    metadata: { asset_id: assetId, filename: file.name },
  });

  revalidatePath(`/homes/${homeId}/assets/${assetId}`);
  revalidatePath(`/home/${homeId}/assets/${assetId}`);
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/queries/home-assets.ts src/lib/actions/home-assets.ts
git commit -m "feat: add home asset queries and actions (CRUD, photo upload, item linking)"
```

---

## Task 2: Builder Asset List & Detail Pages

**Files:**
- Create: `src/components/builder/asset-form.tsx`
- Create: `src/app/(builder)/homes/[homeId]/assets/page.tsx`
- Create: `src/app/(builder)/homes/[homeId]/assets/[assetId]/page.tsx`
- Modify: `src/app/(builder)/homes/[homeId]/page.tsx` — add "Assets" link to home detail nav

- [ ] **Step 1: Create asset form component**

Create `src/components/builder/asset-form.tsx`:

```tsx
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
```

- [ ] **Step 2: Create builder asset list page**

Create `src/app/(builder)/homes/[homeId]/assets/page.tsx`:

```tsx
import { getHomeAssetsWithCounts } from "@/lib/queries/home-assets";
import { createHomeAsset } from "@/lib/actions/home-assets";
import { AssetForm } from "@/components/builder/asset-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import Link from "next/link";

export default async function AssetsPage({
  params,
}: {
  params: Promise<{ homeId: string }>;
}) {
  const { homeId } = await params;
  const assets = await getHomeAssetsWithCounts(homeId);
  const createAction = createHomeAsset.bind(null, homeId);

  // Group assets by category
  const categories = assets.reduce((acc: Record<string, any[]>, asset: any) => {
    const cat = asset.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(asset);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/homes/${homeId}`} className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Home
          </Link>
          <h1 className="text-2xl font-bold">Assets ({assets.length})</h1>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>Add Asset</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Home Asset</DialogTitle>
            </DialogHeader>
            <AssetForm action={createAction} submitLabel="Create Asset" />
          </DialogContent>
        </Dialog>
      </div>

      {assets.length === 0 ? (
        <p className="text-muted-foreground">No assets yet. Add appliances, systems, and equipment for this home.</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(categories).map(([category, catAssets]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-base">{category}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(catAssets as any[]).map((asset) => (
                  <Link key={asset.id} href={`/homes/${homeId}/assets/${asset.id}`} className="block">
                    <div className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="font-medium text-sm">{asset.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[asset.manufacturer, asset.model_number].filter(Boolean).join(" · ") || "No details yet"}
                          {asset.location && ` · ${asset.location}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {asset.home_items?.[0]?.count > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {asset.home_items[0].count} items
                          </Badge>
                        )}
                        {asset.files?.[0]?.count > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {asset.files[0].count} photos
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create builder asset detail page**

Create `src/app/(builder)/homes/[homeId]/assets/[assetId]/page.tsx`:

```tsx
import { getHomeAsset } from "@/lib/queries/home-assets";
import { updateHomeAsset, deleteHomeAsset, uploadAssetPhoto } from "@/lib/actions/home-assets";
import { AssetForm } from "@/components/builder/asset-form";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ homeId: string; assetId: string }>;
}) {
  const { homeId, assetId } = await params;
  const asset = await getHomeAsset(assetId);

  if (!asset) notFound();

  const updateAction = updateHomeAsset.bind(null, homeId, assetId);
  const deleteAction = deleteHomeAsset.bind(null, homeId, assetId);
  const uploadAction = uploadAssetPhoto.bind(null, homeId, assetId);

  const warranties = (asset.home_items || []).filter((i: any) => i.type === "warranty");
  const documents = (asset.home_items || []).filter((i: any) => i.type === "document");
  const otherItems = (asset.home_items || []).filter((i: any) => !["warranty", "document"].includes(i.type));
  const photos = asset.files || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/homes/${homeId}/assets`} className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Assets
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{asset.name}</h1>
            <p className="text-sm text-muted-foreground">
              {[asset.manufacturer, asset.model_number, asset.serial_number].filter(Boolean).join(" · ")}
              {asset.location && ` · ${asset.location}`}
            </p>
          </div>
        </div>
        <form action={deleteAction}>
          <Button variant="destructive" size="sm" type="submit">Delete Asset</Button>
        </form>
      </div>

      {/* Edit Asset Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Asset Details</CardTitle>
        </CardHeader>
        <CardContent>
          <AssetForm action={updateAction} defaultValues={asset} submitLabel="Save Changes" />
        </CardContent>
      </Card>

      {/* Photos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Photos ({photos.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={uploadAction} className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="file">Upload photo (label, installation, serial number plate)</Label>
              <Input id="file" name="file" type="file" accept="image/*" required />
            </div>
            <Button type="submit">Upload</Button>
          </form>
          {photos.length > 0 && (
            <div className="space-y-2">
              {photos.map((photo: any) => (
                <div key={photo.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">{photo.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {photo.size_bytes ? `${Math.round(photo.size_bytes / 1024)}KB` : ""} · {new Date(photo.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">{photo.mime_type?.split("/")[1] || "file"}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Linked Warranties */}
      {warranties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Warranties ({warranties.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {warranties.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm font-medium">{item.title}</span>
                <div className="flex items-center gap-2">
                  {item.registration_deadline && (
                    <span className="text-xs text-muted-foreground">Due: {item.registration_deadline}</span>
                  )}
                  <Badge variant={item.registration_status === "registered" ? "default" : "secondary"} className="text-xs">
                    {item.registration_status || item.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Linked Documents */}
      {documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documents ({documents.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {documents.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm font-medium">{item.title}</span>
                <Badge variant="outline" className="text-xs">{item.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Other Linked Items */}
      {otherItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Other Items ({otherItems.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {otherItems.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{item.type}</Badge>
                  <span className="text-sm font-medium">{item.title}</span>
                </div>
                <Badge variant="outline" className="text-xs">{item.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add Assets link to home detail page**

Read `src/app/(builder)/homes/[homeId]/page.tsx` and find the "Activity Log" link button in the header area. Add an "Assets" link next to it:

```tsx
<Link href={`/homes/${homeId}/assets`}>
  <Button variant="outline" size="sm">Assets</Button>
</Link>
```

Add the import for Link if not already present.

- [ ] **Step 5: Verify build**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/builder/asset-form.tsx src/app/\(builder\)/homes/\[homeId\]/assets/ src/app/\(builder\)/homes/\[homeId\]/page.tsx
git commit -m "feat: add builder asset list and detail pages with photo upload"
```

---

## Task 3: Inspection Report Queries, Actions & Pages

**Files:**
- Create: `src/lib/queries/inspection-reports.ts`
- Create: `src/lib/actions/inspection-reports.ts`
- Create: `src/components/builder/finding-card.tsx`
- Create: `src/app/(builder)/homes/[homeId]/inspections/page.tsx`
- Create: `src/app/(builder)/homes/[homeId]/inspections/[reportId]/page.tsx`
- Modify: `src/app/(builder)/homes/[homeId]/page.tsx` — add "Inspections" link

- [ ] **Step 1: Create inspection queries**

Create `src/lib/queries/inspection-reports.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";

export async function getInspectionReports(homeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inspection_reports")
    .select("*, inspection_findings(count)")
    .eq("home_id", homeId)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function getInspectionReport(reportId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inspection_reports")
    .select("*, inspection_findings(*, home_assets(name, category))")
    .eq("id", reportId)
    .single();
  return data;
}

export async function getInspectionFinding(findingId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inspection_findings")
    .select("*, inspection_reports(title), home_assets(name, category)")
    .eq("id", findingId)
    .single();
  return data;
}
```

- [ ] **Step 2: Create inspection actions**

Create `src/lib/actions/inspection-reports.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentBuilder } from "@/lib/queries/builders";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createInspectionReport(homeId: string, formData: FormData) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context || context.role !== "owner") throw new Error("Unauthorized");

  const file = formData.get("file") as File | null;
  let fileId: string | null = null;

  // Upload report file if provided
  if (file && file.size > 0) {
    const storagePath = `${context.builder.id}/${homeId}/inspections/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, file);

    if (uploadError) throw new Error("Failed to upload report file");

    const { data: fileRecord } = await supabase
      .from("files")
      .insert({
        builder_id: context.builder.id,
        home_id: homeId,
        uploaded_by: context.userId,
        storage_path: storagePath,
        filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      })
      .select()
      .single();

    fileId = fileRecord?.id || null;
  }

  const { data, error } = await supabase
    .from("inspection_reports")
    .insert({
      home_id: homeId,
      builder_id: context.builder.id,
      title: formData.get("title") as string || "Inspection Report",
      inspector_name: formData.get("inspectorName") as string || null,
      inspection_date: formData.get("inspectionDate") as string || null,
      source: "manual_upload",
      file_id: fileId,
      status: "uploaded",
    })
    .select()
    .single();

  if (error) throw new Error("Failed to create inspection report");

  await supabase.from("activity_log").insert({
    builder_id: context.builder.id,
    home_id: homeId,
    actor_type: "user",
    actor_id: context.userId,
    action: "inspection_report_uploaded",
    metadata: { report_id: data.id, title: data.title },
  });

  revalidatePath(`/homes/${homeId}/inspections`);
  redirect(`/homes/${homeId}/inspections/${data.id}`);
}

export async function createFinding(homeId: string, reportId: string, formData: FormData) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context || context.role !== "owner") throw new Error("Unauthorized");

  const assetId = formData.get("assetId") as string || null;

  const { error } = await supabase
    .from("inspection_findings")
    .insert({
      inspection_report_id: reportId,
      home_id: homeId,
      builder_id: context.builder.id,
      home_asset_id: assetId || null,
      section: formData.get("section") as string || null,
      title: formData.get("title") as string,
      description: formData.get("description") as string || null,
      severity: formData.get("severity") as string || null,
      status: "open",
    });

  if (error) throw new Error("Failed to create finding");

  revalidatePath(`/homes/${homeId}/inspections/${reportId}`);
}

export async function convertFindingToTask(homeId: string, findingId: string, formData: FormData) {
  const supabase = await createClient();
  const context = await getCurrentBuilder();
  if (!context || context.role !== "owner") throw new Error("Unauthorized");

  // Get the finding
  const { data: finding } = await supabase
    .from("inspection_findings")
    .select("*")
    .eq("id", findingId)
    .single();

  if (!finding) throw new Error("Finding not found");

  // Create a punch_list home_item from the finding
  const { error: itemError } = await supabase
    .from("home_items")
    .insert({
      home_id: homeId,
      builder_id: context.builder.id,
      type: "punch_list",
      category: finding.section || "Inspection",
      title: finding.title,
      description: finding.description,
      status: "pending",
      source: "inspection",
      source_finding_id: findingId,
      home_asset_id: finding.home_asset_id,
      is_critical: finding.severity === "safety",
      severity: finding.severity,
      assigned_to: formData.get("assignedTo") as string || "builder",
    });

  if (itemError) throw new Error("Failed to create task from finding");

  // Mark finding as converted
  await supabase
    .from("inspection_findings")
    .update({ status: "converted", updated_at: new Date().toISOString() })
    .eq("id", findingId);

  await supabase.from("activity_log").insert({
    builder_id: context.builder.id,
    home_id: homeId,
    actor_type: "user",
    actor_id: context.userId,
    action: "finding_converted_to_task",
    metadata: { finding_id: findingId, title: finding.title },
  });

  // Revalidate both inspections and home detail (new item appears)
  const reportId = finding.inspection_report_id;
  revalidatePath(`/homes/${homeId}/inspections/${reportId}`);
  revalidatePath(`/homes/${homeId}`);
}
```

- [ ] **Step 3: Create finding card component**

Create `src/components/builder/finding-card.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SEVERITY_COLORS: Record<string, string> = {
  safety: "destructive",
  functional: "default",
  cosmetic: "secondary",
  informational: "outline",
};

interface FindingCardProps {
  finding: any;
  convertAction: (formData: FormData) => Promise<void>;
}

export function FindingCard({ finding, convertAction }: FindingCardProps) {
  const isConverted = finding.status === "converted";
  const isResolved = finding.status === "resolved" || finding.status === "wont_fix";

  return (
    <div className={`rounded-md border p-4 space-y-3 ${isConverted ? "bg-muted/50" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {finding.severity && (
              <Badge variant={SEVERITY_COLORS[finding.severity] as any} className="text-xs">
                {finding.severity}
              </Badge>
            )}
            {finding.section && (
              <Badge variant="outline" className="text-xs">{finding.section}</Badge>
            )}
            {finding.home_assets && (
              <Badge variant="secondary" className="text-xs">{finding.home_assets.name}</Badge>
            )}
          </div>
          <p className="font-medium text-sm">{finding.title}</p>
          {finding.description && (
            <p className="text-xs text-muted-foreground mt-1">{finding.description}</p>
          )}
        </div>
        <Badge variant="outline" className="text-xs">{finding.status}</Badge>
      </div>

      {!isConverted && !isResolved && (
        <form action={convertAction} className="flex items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Assign to</label>
            <Select name="assignedTo" defaultValue="builder">
              <SelectTrigger className="h-8 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="builder">Builder</SelectItem>
                <SelectItem value="subcontractor">Subcontractor</SelectItem>
                <SelectItem value="buyer">Buyer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" size="sm" variant="outline">Create Task</Button>
        </form>
      )}

      {isConverted && (
        <p className="text-xs text-muted-foreground">Converted to punch list task</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create inspections list page**

Create `src/app/(builder)/homes/[homeId]/inspections/page.tsx`:

```tsx
import { getInspectionReports } from "@/lib/queries/inspection-reports";
import { createInspectionReport } from "@/lib/actions/inspection-reports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import Link from "next/link";

export default async function InspectionsPage({
  params,
}: {
  params: Promise<{ homeId: string }>;
}) {
  const { homeId } = await params;
  const reports = await getInspectionReports(homeId);
  const uploadAction = createInspectionReport.bind(null, homeId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/homes/${homeId}`} className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Home
          </Link>
          <h1 className="text-2xl font-bold">Inspection Reports</h1>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>Upload Report</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Inspection Report</DialogTitle>
            </DialogHeader>
            <form action={uploadAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Report Title</Label>
                <Input id="title" name="title" placeholder="Pre-Closing Inspection" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inspectorName">Inspector Name</Label>
                  <Input id="inspectorName" name="inspectorName" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inspectionDate">Inspection Date</Label>
                  <Input id="inspectionDate" name="inspectionDate" type="date" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">Report File (PDF)</Label>
                <Input id="file" name="file" type="file" accept=".pdf,.doc,.docx" />
              </div>
              <Button type="submit" className="w-full">Upload</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {reports.length === 0 ? (
        <p className="text-muted-foreground">No inspection reports yet. Upload one to start tracking findings.</p>
      ) : (
        <div className="space-y-2">
          {reports.map((report: any) => (
            <Link key={report.id} href={`/homes/${homeId}/inspections/${report.id}`} className="block">
              <div className="flex items-center justify-between rounded-md border p-4 hover:bg-muted/50 transition-colors">
                <div>
                  <p className="font-medium text-sm">{report.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {report.inspector_name && `${report.inspector_name} · `}
                    {report.inspection_date || "No date"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {report.inspection_findings?.[0]?.count || 0} findings
                  </Badge>
                  <Badge variant="secondary" className="text-xs">{report.status}</Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create inspection report detail page with findings**

Create `src/app/(builder)/homes/[homeId]/inspections/[reportId]/page.tsx`:

```tsx
import { getInspectionReport } from "@/lib/queries/inspection-reports";
import { getHomeAssets } from "@/lib/queries/home-assets";
import { createFinding, convertFindingToTask } from "@/lib/actions/inspection-reports";
import { FindingCard } from "@/components/builder/finding-card";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ homeId: string; reportId: string }>;
}) {
  const { homeId, reportId } = await params;
  const report = await getInspectionReport(reportId);
  if (!report) notFound();

  const assets = await getHomeAssets(homeId);
  const findings = report.inspection_findings || [];
  const addFindingAction = createFinding.bind(null, homeId, reportId);

  // Group findings by status
  const openFindings = findings.filter((f: any) => f.status === "open" || f.status === "acknowledged");
  const convertedFindings = findings.filter((f: any) => f.status === "converted");
  const resolvedFindings = findings.filter((f: any) => f.status === "resolved" || f.status === "wont_fix");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/homes/${homeId}/inspections`} className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Reports
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{report.title}</h1>
            <p className="text-sm text-muted-foreground">
              {report.inspector_name && `${report.inspector_name} · `}
              {report.inspection_date || "No date"} · {findings.length} findings
            </p>
          </div>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>Add Finding</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Inspection Finding</DialogTitle>
            </DialogHeader>
            <form action={addFindingAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Finding</Label>
                <Input id="title" name="title" placeholder="Condensation on HVAC supply line" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Details</Label>
                <Textarea id="description" name="description" placeholder="Inspector notes..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="section">Section</Label>
                  <Input id="section" name="section" placeholder="HVAC, Plumbing, Electrical..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="severity">Severity</Label>
                  <Select name="severity" defaultValue="functional">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cosmetic">Cosmetic</SelectItem>
                      <SelectItem value="functional">Functional</SelectItem>
                      <SelectItem value="safety">Safety</SelectItem>
                      <SelectItem value="informational">Informational</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {assets.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="assetId">Related Asset (optional)</Label>
                  <Select name="assetId">
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      {assets.map((asset: any) => (
                        <SelectItem key={asset.id} value={asset.id}>
                          {asset.name} ({asset.category})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button type="submit" className="w-full">Add Finding</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Open Findings */}
      {openFindings.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Open ({openFindings.length})</h2>
          {openFindings.map((finding: any) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              convertAction={convertFindingToTask.bind(null, homeId, finding.id)}
            />
          ))}
        </div>
      )}

      {/* Converted Findings */}
      {convertedFindings.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">Converted to Tasks ({convertedFindings.length})</h2>
          {convertedFindings.map((finding: any) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              convertAction={convertFindingToTask.bind(null, homeId, finding.id)}
            />
          ))}
        </div>
      )}

      {/* Resolved Findings */}
      {resolvedFindings.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">Resolved ({resolvedFindings.length})</h2>
          {resolvedFindings.map((finding: any) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              convertAction={convertFindingToTask.bind(null, homeId, finding.id)}
            />
          ))}
        </div>
      )}

      {findings.length === 0 && (
        <p className="text-muted-foreground">No findings yet. Add findings from the inspection report.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Add Inspections link to home detail page**

Read `src/app/(builder)/homes/[homeId]/page.tsx` and add an "Inspections" link next to the "Assets" and "Activity Log" links in the header:

```tsx
<Link href={`/homes/${homeId}/inspections`}>
  <Button variant="outline" size="sm">Inspections</Button>
</Link>
```

- [ ] **Step 7: Verify build**

```bash
npm run build
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/queries/inspection-reports.ts src/lib/actions/inspection-reports.ts src/components/builder/finding-card.tsx src/app/\(builder\)/homes/\[homeId\]/inspections/ src/app/\(builder\)/homes/\[homeId\]/page.tsx
git commit -m "feat: add inspection report upload, findings, and convert-to-punch-list flow"
```

---

## Task 4: Buyer Asset List & Detail with Photo Upload

**Files:**
- Create: `src/lib/actions/buyer-assets.ts`
- Create: `src/components/buyer/asset-photo-upload.tsx`
- Create: `src/app/(buyer)/home/[homeId]/assets/page.tsx`
- Create: `src/app/(buyer)/home/[homeId]/assets/[assetId]/page.tsx`
- Modify: `src/app/(buyer)/home/[homeId]/page.tsx` — add "Assets" link to buyer nav

- [ ] **Step 1: Create buyer asset actions**

Create `src/lib/actions/buyer-assets.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createDraftAsset(homeId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Verify buyer has access
  const { data: assignment } = await supabase
    .from("home_assignments")
    .select("*")
    .eq("home_id", homeId)
    .eq("user_id", user.id)
    .single();

  if (!assignment) throw new Error("Access denied");

  // Get builder_id from home
  const { data: home } = await supabase
    .from("homes")
    .select("builder_id")
    .eq("id", homeId)
    .single();

  if (!home) throw new Error("Home not found");

  const { data: asset, error } = await supabase
    .from("home_assets")
    .insert({
      home_id: homeId,
      builder_id: home.builder_id,
      category: formData.get("category") as string || "Other",
      name: formData.get("name") as string,
      manufacturer: formData.get("manufacturer") as string || null,
      model_number: formData.get("modelNumber") as string || null,
      serial_number: formData.get("serialNumber") as string || null,
      location: formData.get("location") as string || null,
    })
    .select()
    .single();

  if (error) throw new Error("Failed to create asset");

  await supabase.from("activity_log").insert({
    builder_id: home.builder_id,
    home_id: homeId,
    actor_type: "user",
    actor_id: user.id,
    action: "buyer_asset_created",
    metadata: { asset_id: asset.id, name: asset.name },
  });

  revalidatePath(`/home/${homeId}/assets`);
  redirect(`/home/${homeId}/assets/${asset.id}`);
}

export async function updateAssetFromBuyer(homeId: string, assetId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: assignment } = await supabase
    .from("home_assignments")
    .select("*")
    .eq("home_id", homeId)
    .eq("user_id", user.id)
    .single();

  if (!assignment) throw new Error("Access denied");

  const { error } = await supabase
    .from("home_assets")
    .update({
      manufacturer: formData.get("manufacturer") as string || null,
      model_number: formData.get("modelNumber") as string || null,
      serial_number: formData.get("serialNumber") as string || null,
      location: formData.get("location") as string || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assetId);

  if (error) throw new Error("Failed to update asset");

  revalidatePath(`/home/${homeId}/assets/${assetId}`);
}

export async function uploadBuyerAssetPhoto(homeId: string, assetId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: assignment } = await supabase
    .from("home_assignments")
    .select("*")
    .eq("home_id", homeId)
    .eq("user_id", user.id)
    .single();

  if (!assignment) throw new Error("Access denied");

  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");
  if (file.size > 25 * 1024 * 1024) throw new Error("File too large");

  const { data: asset } = await supabase
    .from("home_assets")
    .select("builder_id")
    .eq("id", assetId)
    .single();

  if (!asset) throw new Error("Asset not found");

  const storagePath = `${asset.builder_id}/${homeId}/assets/${assetId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, file);

  if (uploadError) throw new Error("Failed to upload photo");

  await supabase.from("files").insert({
    builder_id: asset.builder_id,
    home_id: homeId,
    home_asset_id: assetId,
    uploaded_by: user.id,
    storage_path: storagePath,
    filename: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  });

  await supabase.from("activity_log").insert({
    builder_id: asset.builder_id,
    home_id: homeId,
    actor_type: "user",
    actor_id: user.id,
    action: "buyer_asset_photo_uploaded",
    metadata: { asset_id: assetId, filename: file.name },
  });

  revalidatePath(`/home/${homeId}/assets/${assetId}`);
}
```

- [ ] **Step 2: Create buyer asset photo upload component**

Create `src/components/buyer/asset-photo-upload.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface AssetPhotoUploadProps {
  uploadAction: (formData: FormData) => Promise<void>;
}

export function AssetPhotoUpload({ uploadAction }: AssetPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setUploading(true);
    try {
      await uploadAction(formData);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="file">Take a photo of the appliance label, serial number plate, or model tag</Label>
        <Input
          id="file"
          name="file"
          type="file"
          accept="image/*"
          capture="environment"
          required
        />
      </div>
      <Button type="submit" disabled={uploading} className="w-full">
        {uploading ? "Uploading..." : "Upload Photo"}
      </Button>
    </form>
  );
}
```

Note: `capture="environment"` opens the rear camera on mobile devices for taking photos directly.

- [ ] **Step 3: Create buyer asset list page**

Create `src/app/(buyer)/home/[homeId]/assets/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getHomeAssetsWithCounts } from "@/lib/queries/home-assets";
import { createDraftAsset } from "@/lib/actions/buyer-assets";
import { getThemeStyles } from "@/lib/utils/theme";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";

const CATEGORIES = [
  "HVAC", "Appliances", "Roofing", "Plumbing", "Electrical",
  "Water Heater", "Fixtures", "Garage", "Exterior", "Other",
];

export default async function BuyerAssetsPage({
  params,
}: {
  params: Promise<{ homeId: string }>;
}) {
  const { homeId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: assignment } = await supabase
    .from("home_assignments")
    .select("*")
    .eq("home_id", homeId)
    .eq("user_id", user.id)
    .single();

  if (!assignment) notFound();

  const { data: home } = await supabase
    .from("homes")
    .select("*, builders(*)")
    .eq("id", homeId)
    .single();

  if (!home) notFound();

  const assets = await getHomeAssetsWithCounts(homeId);
  const builder = home.builders;
  const themeStyles = getThemeStyles(builder);
  const createAction = createDraftAsset.bind(null, homeId);

  return (
    <div style={themeStyles}>
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href={`/home/${homeId}`} className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Dashboard
          </Link>
          <span className="font-semibold" style={{ color: "var(--brand-primary)" }}>
            {builder.name}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Home Assets</h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" style={{ background: "var(--brand-accent)" }}>Add Asset</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add an Appliance or System</DialogTitle>
              </DialogHeader>
              <form action={createAction} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">What is it?</Label>
                  <Input id="name" name="name" placeholder="Dishwasher, HVAC Unit, Water Heater..." required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select name="category" defaultValue="Appliances">
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
                  <Label htmlFor="location">Where in the home?</Label>
                  <Input id="location" name="location" placeholder="Kitchen, Garage, Attic..." />
                </div>
                <p className="text-xs text-muted-foreground">
                  You can add manufacturer and model details later, or upload a photo of the label.
                </p>
                <Button type="submit" className="w-full">Add</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {assets.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No home assets recorded yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add your appliances and systems to track warranties, manuals, and service info.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {assets.map((asset: any) => (
              <Link key={asset.id} href={`/home/${homeId}/assets/${asset.id}`} className="block">
                <div className="flex items-center justify-between rounded-md border p-4 hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="font-medium text-sm">{asset.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {asset.category}
                      {asset.manufacturer && ` · ${asset.manufacturer}`}
                      {asset.location && ` · ${asset.location}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(!asset.manufacturer || !asset.model_number) && (
                      <Badge variant="secondary" className="text-xs">Needs details</Badge>
                    )}
                    {asset.files?.[0]?.count > 0 && (
                      <Badge variant="outline" className="text-xs">{asset.files[0].count} photos</Badge>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Create buyer asset detail page with photo upload and field editing**

Create `src/app/(buyer)/home/[homeId]/assets/[assetId]/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getHomeAsset } from "@/lib/queries/home-assets";
import { updateAssetFromBuyer, uploadBuyerAssetPhoto } from "@/lib/actions/buyer-assets";
import { AssetPhotoUpload } from "@/components/buyer/asset-photo-upload";
import { getThemeStyles } from "@/lib/utils/theme";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function BuyerAssetDetailPage({
  params,
}: {
  params: Promise<{ homeId: string; assetId: string }>;
}) {
  const { homeId, assetId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: assignment } = await supabase
    .from("home_assignments")
    .select("*")
    .eq("home_id", homeId)
    .eq("user_id", user.id)
    .single();

  if (!assignment) notFound();

  const asset = await getHomeAsset(assetId);
  if (!asset) notFound();

  const { data: home } = await supabase
    .from("homes")
    .select("builders(*)")
    .eq("id", homeId)
    .single();

  const builder = home?.builders;
  const themeStyles = getThemeStyles(builder || { primary_color: null, accent_color: null });

  const updateAction = updateAssetFromBuyer.bind(null, homeId, assetId);
  const uploadAction = uploadBuyerAssetPhoto.bind(null, homeId, assetId);

  const warranties = (asset.home_items || []).filter((i: any) => i.type === "warranty");
  const photos = asset.files || [];
  const needsDetails = !asset.manufacturer || !asset.model_number || !asset.serial_number;

  return (
    <div style={themeStyles}>
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href={`/home/${homeId}/assets`} className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Assets
          </Link>
          <span className="font-semibold" style={{ color: "var(--brand-primary)" }}>
            {builder?.name}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div>
          <Badge variant="outline" className="mb-2">{asset.category}</Badge>
          <h1 className="text-2xl font-bold">{asset.name}</h1>
          {asset.location && (
            <p className="text-muted-foreground text-sm">{asset.location}</p>
          )}
        </div>

        {/* Photo Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Photos ({photos.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AssetPhotoUpload uploadAction={uploadAction} />
            {photos.length > 0 && (
              <div className="space-y-2">
                {photos.map((photo: any) => (
                  <div key={photo.id} className="flex items-center justify-between rounded-md border p-3">
                    <p className="text-sm">{photo.filename}</p>
                    <span className="text-xs text-muted-foreground">
                      {new Date(photo.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Asset Details — editable by buyer */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Details
              {needsDetails && (
                <Badge variant="secondary" className="ml-2 text-xs">Incomplete</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateAction} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Input id="manufacturer" name="manufacturer" defaultValue={asset.manufacturer || ""} placeholder="Carrier, Bosch..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modelNumber">Model Number</Label>
                  <Input id="modelNumber" name="modelNumber" defaultValue={asset.model_number || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serialNumber">Serial Number</Label>
                  <Input id="serialNumber" name="serialNumber" defaultValue={asset.serial_number || ""} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location in Home</Label>
                <Input id="location" name="location" defaultValue={asset.location || ""} />
              </div>
              <Button type="submit" style={{ background: "var(--brand-accent)" }}>Save Details</Button>
            </form>
          </CardContent>
        </Card>

        {/* Linked Warranties */}
        {warranties.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Warranties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {warranties.map((item: any) => (
                <Link key={item.id} href={`/home/${homeId}/items/${item.id}`} className="block">
                  <div className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50">
                    <span className="text-sm font-medium">{item.title}</span>
                    <Badge variant={item.registration_status === "registered" ? "default" : "secondary"} className="text-xs">
                      {item.registration_status || item.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Add Assets link to buyer dashboard**

Read `src/app/(buyer)/home/[homeId]/page.tsx` and find the header nav. Add an "Assets" link next to the "Documents" link:

```tsx
<Link href={`/home/${homeId}/assets`} className="text-sm text-muted-foreground hover:text-foreground">
  Assets
</Link>
```

- [ ] **Step 6: Verify build**

```bash
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions/buyer-assets.ts src/components/buyer/asset-photo-upload.tsx src/app/\(buyer\)/home/\[homeId\]/assets/ src/app/\(buyer\)/home/\[homeId\]/page.tsx
git commit -m "feat: add buyer asset list, detail, photo upload, and field enrichment"
```

---

## Task 5: Seed Demo Assets & Verify All Flows

**Files:**
- Modify: `supabase/seed.sql` — add demo assets linked to existing home items

- [ ] **Step 1: Create a seed migration for demo assets**

Run against the remote database to add assets to the demo home and link existing warranty items to them:

```sql
-- Run via: npx supabase db query --linked -f <this-file>

DO $$
DECLARE
  v_home_id uuid := 'f6666666-6666-6666-6666-666666666666';
  v_builder_id uuid := 'c3333333-3333-3333-3333-333333333333';
  v_hvac_asset_id uuid;
  v_dishwasher_asset_id uuid;
  v_fridge_asset_id uuid;
  v_roof_asset_id uuid;
  v_water_heater_asset_id uuid;
BEGIN
  -- Create assets
  INSERT INTO home_assets (id, home_id, builder_id, category, name, manufacturer, model_number, serial_number, location)
  VALUES
    (gen_random_uuid(), v_home_id, v_builder_id, 'HVAC', 'Carrier HVAC System', 'Carrier', '24ACC636A003', NULL, 'Attic')
  RETURNING id INTO v_hvac_asset_id;

  INSERT INTO home_assets (id, home_id, builder_id, category, name, manufacturer, model_number, location)
  VALUES
    (gen_random_uuid(), v_home_id, v_builder_id, 'Appliances', 'Bosch Dishwasher', 'Bosch', 'SHPM88Z75N', 'Kitchen')
  RETURNING id INTO v_dishwasher_asset_id;

  INSERT INTO home_assets (id, home_id, builder_id, category, name, manufacturer, model_number, location)
  VALUES
    (gen_random_uuid(), v_home_id, v_builder_id, 'Appliances', 'Samsung Refrigerator', 'Samsung', 'RF28R7351SR', 'Kitchen')
  RETURNING id INTO v_fridge_asset_id;

  INSERT INTO home_assets (id, home_id, builder_id, category, name, manufacturer, location)
  VALUES
    (gen_random_uuid(), v_home_id, v_builder_id, 'Roofing', 'GAF Roof System', 'GAF', 'Roof')
  RETURNING id INTO v_roof_asset_id;

  INSERT INTO home_assets (id, home_id, builder_id, category, name, manufacturer, model_number, location)
  VALUES
    (gen_random_uuid(), v_home_id, v_builder_id, 'Plumbing', 'Rheem Water Heater', 'Rheem', 'PROG50-38N RH62', 'Garage')
  RETURNING id INTO v_water_heater_asset_id;

  -- Link existing warranty home_items to assets
  UPDATE home_items SET home_asset_id = v_hvac_asset_id
  WHERE home_id = v_home_id AND title = 'HVAC System Warranty';

  UPDATE home_items SET home_asset_id = v_dishwasher_asset_id
  WHERE home_id = v_home_id AND title = 'Dishwasher Warranty';

  UPDATE home_items SET home_asset_id = v_fridge_asset_id
  WHERE home_id = v_home_id AND title = 'Refrigerator Warranty';

  UPDATE home_items SET home_asset_id = v_roof_asset_id
  WHERE home_id = v_home_id AND title = 'Roof Warranty';

  UPDATE home_items SET home_asset_id = v_water_heater_asset_id
  WHERE home_id = v_home_id AND title = 'Water Heater Warranty';

  -- Link HVAC manual to HVAC asset
  UPDATE home_items SET home_asset_id = v_hvac_asset_id
  WHERE home_id = v_home_id AND title = 'HVAC Owner''s Manual';
END;
$$;
```

Save this as `supabase/seed_assets.sql` and run it:

```bash
npx supabase db query --linked -f supabase/seed_assets.sql
```

- [ ] **Step 2: Verify data linkage**

```bash
npx supabase db query --linked "
  SELECT a.name, a.category, count(hi.id) as linked_items
  FROM home_assets a
  LEFT JOIN home_items hi ON hi.home_asset_id = a.id
  WHERE a.home_id = 'f6666666-6666-6666-6666-666666666666'
  GROUP BY a.id, a.name, a.category
  ORDER BY a.category;
"
```

Expected: 5 assets, HVAC with 2 items (warranty + manual), others with 1 warranty each.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit and push**

```bash
git add supabase/seed_assets.sql
git commit -m "feat: add demo assets linked to warranties for flow verification"
git push
```

---

## Verification Checklist

After all tasks are complete, verify each flow end-to-end:

### Flow 1: Builder Handoff with Assets
- [ ] Navigate to home detail → click "Assets"
- [ ] Create a new asset (e.g., "GE Range" in Appliances)
- [ ] Upload a photo to the asset
- [ ] See linked warranties on existing assets (HVAC, Dishwasher, etc.)
- [ ] Edit asset details (add serial number)

### Flow 2: Inspection → Punch List
- [ ] Navigate to home detail → click "Inspections"
- [ ] Upload an inspection report (title, inspector, date, PDF)
- [ ] Add 3 findings with different severities (cosmetic, functional, safety)
- [ ] Link a finding to an existing asset
- [ ] Click "Create Task" on a finding → verify it appears in home items as type "punch_list"
- [ ] Verify finding status changes to "converted"
- [ ] Verify the punch list item has source_finding_id set

### Flow 3: Buyer Photo → Asset Enrichment
- [ ] Log in as buyer, navigate to buyer dashboard
- [ ] Click "Assets" in nav
- [ ] See existing assets with "Needs details" badges where serial numbers are missing
- [ ] Click into an asset → upload a photo (label shot)
- [ ] Fill in manufacturer/model/serial fields → save
- [ ] "Needs details" badge disappears
- [ ] See linked warranties for this asset
- [ ] Create a new asset from buyer side → verify it appears in builder's asset list too
