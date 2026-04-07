/**
 * Canonical data contracts for BuilderOS item types and metadata shapes.
 *
 * Item types:
 *   - checklist:  Buyer-facing task (e.g. "Test smoke detectors")
 *   - document:   A file/document to be provided or acknowledged
 *   - warranty:   Product warranty requiring registration
 *   - utility:    Utility service requiring transfer/setup
 *   - info:       Static informational content for the buyer
 *   - punch_list: Builder/inspection-generated repair item
 *
 * Metadata convention: all metadata field names use snake_case.
 * Form inputs may use camelCase but MUST be converted to snake_case before storage.
 */

/** All valid item types for template_items and home_items */
export const ITEM_TYPES = [
  "checklist",
  "document",
  "warranty",
  "utility",
  "info",
  "punch_list",
] as const;

export type ItemType = (typeof ITEM_TYPES)[number];

/** Item types available in the builder template/item creation form.
 *  punch_list items are created via the dedicated punch list UI or inspections. */
export const FORM_ITEM_TYPES = [
  "checklist",
  "document",
  "warranty",
  "utility",
  "info",
] as const;

export type FormItemType = (typeof FORM_ITEM_TYPES)[number];

/** Canonical metadata shape for utility items (stored in metadata JSONB) */
export interface UtilityMetadata {
  provider_name: string | null;
  provider_phone: string | null;
  provider_url: string | null;
  transfer_instructions: string | null;
}

/** Canonical metadata shape for info items (stored in metadata JSONB) */
export interface InfoMetadata {
  content: string | null;
}

/** Empty metadata — used by checklist, document, warranty, punch_list items */
export type EmptyMetadata = Record<string, never>;

/** Union of all valid metadata shapes */
export type ItemMetadata = UtilityMetadata | InfoMetadata | EmptyMetadata;

/** Human-readable labels for all item types */
export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  checklist: "Checklist",
  document: "Document",
  warranty: "Warranty",
  utility: "Utility",
  info: "Info",
  punch_list: "Punch List",
};
