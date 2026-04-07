# Canonical Data Contracts

This document defines the authoritative item-type and metadata contracts for BuilderOS.
All layers (database, action schemas, forms, UI) must conform to these contracts.

## Item Types

The canonical set of item types is defined in `src/lib/types/database.ts`.

| Type | Purpose | Created Via |
|------|---------|-------------|
| `checklist` | Buyer-facing task (e.g. "Test smoke detectors") | Template / Home item form |
| `document` | A file/document to be provided or acknowledged | Template / Home item form |
| `warranty` | Product warranty requiring registration | Template / Home item form |
| `utility` | Utility service requiring transfer/setup | Template / Home item form |
| `info` | Static informational content for the buyer | Template / Home item form |
| `punch_list` | Builder/inspection-generated repair item | Punch list UI / Inspections |

### Form vs Full Type Sets

- **`ITEM_TYPES`** — all six types above. Used for DB constraints, display logic, and read paths.
- **`FORM_ITEM_TYPES`** — excludes `punch_list`. Used for template and home item creation forms, since punch list items are created through a separate workflow.

### DB Constraints

Both `template_items` and `home_items` tables enforce `CHECK (type IN ('document', 'warranty', 'utility', 'checklist', 'info', 'punch_list'))`.

Migration: `supabase/migrations/20260407000001_add_assets_inspections_punchlist.sql`

## Metadata Shapes

All metadata field names use **snake_case**. Form inputs may use camelCase but must be converted to snake_case before storage.

### Utility Items (`UtilityMetadata`)

```typescript
{
  provider_name: string | null;
  provider_phone: string | null;
  provider_url: string | null;
  transfer_instructions: string | null;
}
```

### Info Items (`InfoMetadata`)

```typescript
{
  content: string | null;
}
```

### Other Types (`EmptyMetadata`)

`checklist`, `document`, `warranty`, and `punch_list` items use empty metadata (`{}`).

## Type-Specific Columns

### Warranty Items

- `manufacturer` — manufacturer name
- `registration_url` — URL for warranty registration
- `registration_deadline_offset` — days from close date
- `responsible_party` — who is responsible for registration

### Utility Items

- `utility_type` — type of utility (electric, gas, water, etc.)

### Punch List Items

- `punch_severity` — `cosmetic | minor | major | safety`
- `punch_location` — free-text location description
- `source_finding_id` — links back to an inspection finding

## Validation Rules

- **Template items**: validated against `FORM_ITEM_TYPES` (no `punch_list`)
- **Home items**: validated against `ITEM_TYPES` (all six types)
- Type-specific fields are validated per-type (e.g. utility metadata shape, warranty fields)
- Invalid enum values and malformed metadata are rejected before DB writes

## Source of Truth

The canonical TypeScript definitions live in `src/lib/types/database.ts`. This document describes the contract; the code enforces it.
