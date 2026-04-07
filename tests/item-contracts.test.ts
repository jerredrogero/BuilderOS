/**
 * Canonical item-type contract tests.
 *
 * Verifies that the ITEM_TYPES constant, DB migration constraints,
 * template-items schema, and home-items schema all agree on the
 * canonical set of item types.
 *
 * If any layer drifts, these tests break — preventing silent contract
 * mismatches between the database, action layer, and UI.
 */

import { describe, it, expect } from "vitest";
import {
  ITEM_TYPES,
  FORM_ITEM_TYPES,
  ITEM_TYPE_LABELS,
  type ItemType,
} from "@/lib/types/database";

// ---------------------------------------------------------------------------
// Canonical contract — the single source of truth
// ---------------------------------------------------------------------------

/** These are the types the DB migration allows (from the CHECK constraint). */
const DB_ALLOWED_TYPES = [
  "document",
  "warranty",
  "utility",
  "checklist",
  "info",
  "punch_list",
] as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Canonical item-type contract", () => {
  it("ITEM_TYPES matches the DB CHECK constraint set exactly", () => {
    const codeSet = new Set(ITEM_TYPES);
    const dbSet = new Set(DB_ALLOWED_TYPES);
    expect(codeSet).toEqual(dbSet);
  });

  it("ITEM_TYPES has exactly 6 entries", () => {
    expect(ITEM_TYPES).toHaveLength(6);
  });

  it("every ITEM_TYPE has a human-readable label", () => {
    for (const t of ITEM_TYPES) {
      expect(ITEM_TYPE_LABELS[t]).toBeDefined();
      expect(typeof ITEM_TYPE_LABELS[t]).toBe("string");
      expect(ITEM_TYPE_LABELS[t].length).toBeGreaterThan(0);
    }
  });

  it("FORM_ITEM_TYPES is a strict subset of ITEM_TYPES", () => {
    const fullSet = new Set<string>(ITEM_TYPES);
    for (const t of FORM_ITEM_TYPES) {
      expect(fullSet.has(t)).toBe(true);
    }
  });

  it("FORM_ITEM_TYPES excludes punch_list (created via dedicated UI)", () => {
    const formSet = new Set<string>(FORM_ITEM_TYPES);
    expect(formSet.has("punch_list")).toBe(false);
  });

  it("no duplicate types in ITEM_TYPES", () => {
    const unique = new Set(ITEM_TYPES);
    expect(unique.size).toBe(ITEM_TYPES.length);
  });

  it("no duplicate types in FORM_ITEM_TYPES", () => {
    const unique = new Set(FORM_ITEM_TYPES);
    expect(unique.size).toBe(FORM_ITEM_TYPES.length);
  });
});

describe("Template-items schema uses FORM_ITEM_TYPES", () => {
  it("template-items.ts imports and uses FORM_ITEM_TYPES for form validation", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "../src/lib/actions/template-items.ts"),
      "utf-8"
    );
    // Template items use the form-restricted subset (no punch_list in forms)
    expect(source).toContain('import { FORM_ITEM_TYPES }');
    expect(source).toContain("z.enum(FORM_ITEM_TYPES");
  });
});

describe("Home-items schema uses ITEM_TYPES", () => {
  it("home-items.ts imports and uses ITEM_TYPES for validation", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "../src/lib/actions/home-items.ts"),
      "utf-8"
    );
    // Must import ITEM_TYPES
    expect(source).toContain('import { ITEM_TYPES }');
    // Must use z.enum(ITEM_TYPES, ...) for validation
    expect(source).toContain("z.enum(ITEM_TYPES");
  });
});

describe("DB migration contract", () => {
  it("migration adds punch_list to both template_items and home_items type checks", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const migrationSource = fs.readFileSync(
      path.resolve(
        __dirname,
        "../supabase/migrations/20260407000001_add_assets_inspections_punchlist.sql"
      ),
      "utf-8"
    );
    // Both tables must have the constraint updated
    expect(migrationSource).toContain("home_items_type_check");
    expect(migrationSource).toContain("template_items_type_check");
    // punch_list must be in the allowed set
    expect(migrationSource).toContain("'punch_list'");
  });
});
