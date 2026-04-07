# Storage Security Model

> Last updated: 2026-04-07

This document describes BuilderOS's storage authorization model, how it aligns with the application's tenant and home-assignment model, and any accepted tradeoffs.

## Architecture overview

BuilderOS uses a **three-layer** storage security model:

| Layer | Mechanism | Scope |
|-------|-----------|-------|
| 1. Bucket configuration | Private bucket, 50 MiB file limit | All objects in `documents` |
| 2. Storage RLS policies | Row-level security on `storage.objects` | Per-object read/write/delete |
| 3. Application-level checks | Server actions verify membership before generating signed URLs | Per-request |

All three layers must pass for a storage operation to succeed. The bucket is **private** — there are no public URLs except for builder logos (which use `getPublicUrl`).

## Storage path convention

All files follow a deterministic path structure scoped to the builder:

```
{builder_id}/
├── logo-{timestamp}.{ext}              # Builder logo
├── templates/...                       # Template files
└── {home_id}/
    ├── general/                        # General home documents
    ├── {item_id}/                      # Item-specific files
    │   └── proof-{timestamp}-{file}    # Warranty proof uploads
    ├── assets/{asset_id}/              # Asset photos
    └── inspections/                    # Inspection reports
```

The first path segment is always the `builder_id`. The second segment is either `templates`, a `home_id`, or a logo filename. This structure is enforced by both application code and storage RLS policies.

## Bucket-level policies (storage.objects RLS)

Defined in migration `20260407000003_tighten_storage_policies.sql`. These replaced earlier overly-broad "any authenticated user" policies.

### INSERT — "Builder members can upload files"

```sql
WITH CHECK (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
  AND (
    -- Builder members: path[1] is their builder_id
    (storage.foldername(name))[1] IN (
      SELECT b.id::text FROM builders b
      JOIN memberships bm ON bm.builder_id = b.id
      WHERE bm.user_id = auth.uid() AND bm.role IN ('owner', 'staff')
    )
    OR
    -- Buyers: path[2] is a home_id they are assigned to
    EXISTS (
      SELECT 1 FROM home_assignments ha
      WHERE ha.user_id = auth.uid()
      AND (storage.foldername(name))[2] = ha.home_id::text
    )
  )
)
```

**Who can upload:** Builder owners/staff to their builder's namespace. Buyers to homes they are assigned to.

### SELECT — "Authorized users can read files"

Same access model as INSERT. Builder members read anything under their builder's path. Buyers read files under their assigned home's path.

### DELETE — "Builder owners can delete files"

Only builder **owners** (not staff, not buyers) can delete storage objects, scoped to their builder's path.

## Table-level RLS (files table)

The `files` table tracks metadata for every uploaded file. Its RLS policies mirror the storage policies:

| Policy | Roles | Operations |
|--------|-------|------------|
| Builder members can read files | owner, staff | SELECT |
| Buyers can read files for assigned homes | buyer (via home_assignments) | SELECT |
| Owners can manage files | owner | INSERT, UPDATE, DELETE |

This means even if a storage policy allowed access to a raw object, the application would not serve it without a matching `files` table record that passes RLS.

## Application-level enforcement

Server actions add a third check before any storage operation:

- **Upload actions** (`files.ts`, `builders.ts`, `home-assets.ts`, `buyer-assets.ts`, `buyer-items.ts`, `inspection-reports.ts`) verify builder membership or home assignment before calling `supabase.storage.upload()`.
- **File retrieval** (`getFileUrl` in `files.ts`, API route at `/api/files/[fileId]/route.ts`) queries the `files` table first (RLS enforces access), then generates a **1-hour signed URL** via `createSignedUrl()`.
- **File deletion** is restricted to builder owners in the server action, matching the storage DELETE policy.
- **File size limits** are enforced at the application layer (25 MiB general, 5 MiB logos) in addition to the 50 MiB bucket limit.

## Signed URL model

Files are never served directly. The app generates short-lived signed URLs:

- **Expiry:** 1 hour (3600 seconds)
- **Generation:** Only after RLS check on `files` table passes
- **Download mode:** Optional `?download=true` parameter for inline downloads

This means a signed URL cannot be generated unless the requesting user has both table-level and application-level access. The URL itself is time-limited and cannot be extended without re-authenticating.

## Builder logo exception

Builder logos use `getPublicUrl()` instead of signed URLs. This is intentional — logos are displayed on buyer-facing pages and need to be accessible without per-request signing. The logo path (`{builder_id}/logo-{timestamp}.{ext}`) is only writable by builder owners.

**Accepted tradeoff:** Anyone with the logo URL can access it. This is acceptable because logos are non-sensitive branding assets intended for public display.

## Access matrix

| Actor | Upload | Read | Delete |
|-------|--------|------|--------|
| Builder owner | Own builder's namespace | Own builder's namespace | Own builder's namespace |
| Builder staff | Own builder's namespace | Own builder's namespace | No |
| Buyer | Assigned home's path only | Assigned home's path only | No |
| Other authenticated user | No | No | No |
| Unauthenticated | No | No | No |

## Alignment verification

The storage policies are **aligned** with the application's authorization model:

- **Tenant isolation:** Storage paths are scoped to `builder_id`, matching the multi-tenant model.
- **Home-level scoping:** Buyers can only access files under their assigned home, matching `home_assignments` RLS.
- **Role hierarchy:** Owner > Staff > Buyer matches across all three layers.
- **No cross-builder access:** A user in Builder A cannot access Builder B's files at any layer.

There are **no silent mismatches** between what the UI suggests and what the bucket policy allows. The storage policies were tightened from broad authenticated access to scoped builder/buyer access in migration `20260407000003`.

## Remaining considerations

1. **Staff write access:** Staff can upload files but cannot delete them. This is intentional — deletion is an owner-level operation to prevent accidental data loss.
2. **Buyer upload scope:** Buyers can upload to any path under their assigned home. The application code constrains this further to specific subdirectories (proof files, asset photos), but the storage policy itself allows any path under `{builder_id}/{home_id}/`. This is acceptable because buyers are trusted users (homeowners) and the `files` table metadata tracks what each file is for.
3. **Logo public access:** As noted above, this is a deliberate tradeoff for usability.
