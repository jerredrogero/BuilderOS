-- =============================================================================
-- Phase 1.5: Asset-Aware Schema + Inspection Reports + Punch List
-- =============================================================================
-- Adds three new concepts without breaking existing Phase 1 functionality:
--
-- 1. Home Assets — physical systems/appliances in the home
-- 2. Inspection Reports + Findings — source truth from inspections
-- 3. Punch List — new home_items type derived from findings or created directly
--
-- Design principle: four layers
--   Home → Assets → Artifacts (files, reports) → Actions (warranties, tasks)
-- =============================================================================

-- =========================================================================
-- 1. Home Assets
-- =========================================================================
-- A physical thing in the home. Warranties, documents, photos, and
-- inspection findings attach to assets. This is the entity that was
-- missing — previously warranties floated as standalone home_items.

CREATE TABLE home_assets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id         uuid NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  builder_id      uuid NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  category        text NOT NULL,                -- HVAC, Appliances, Roofing, Plumbing, Electrical, etc.
  name            text NOT NULL,                -- "Carrier HVAC System", "Bosch Dishwasher"
  manufacturer    text,
  model_number    text,
  serial_number   text,
  install_date    date,
  location        text,                         -- "Kitchen", "Garage", "Attic", "Master Bath"
  metadata        jsonb DEFAULT '{}',           -- flexible fields (color, capacity, fuel type, etc.)
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_home_assets_home ON home_assets (home_id);
CREATE INDEX idx_home_assets_builder ON home_assets (builder_id);

-- =========================================================================
-- 2. Link home_items to assets (optional FK)
-- =========================================================================
-- A warranty, document, or checklist item can optionally reference the
-- asset it belongs to. Existing items without an asset continue to work.

ALTER TABLE home_items
  ADD COLUMN home_asset_id uuid REFERENCES home_assets(id) ON DELETE SET NULL;

-- Add punch_list to the allowed home_items types
ALTER TABLE home_items
  DROP CONSTRAINT home_items_type_check;
ALTER TABLE home_items
  ADD CONSTRAINT home_items_type_check
  CHECK (type IN ('document', 'warranty', 'utility', 'checklist', 'info', 'punch_list'));

-- Punch list specific columns (nullable, only for type='punch_list')
ALTER TABLE home_items
  ADD COLUMN severity text CHECK (severity IN ('cosmetic', 'functional', 'safety')),
  ADD COLUMN assigned_to text CHECK (assigned_to IN ('builder', 'subcontractor', 'buyer')),
  ADD COLUMN resolution_notes text,
  ADD COLUMN resolved_at timestamptz;

-- Add source types for items created from inspection findings
ALTER TABLE home_items
  DROP CONSTRAINT home_items_source_check;
ALTER TABLE home_items
  ADD CONSTRAINT home_items_source_check
  CHECK (source IN ('template', 'manual', 'inspection'));

-- Link a home_item back to the inspection finding it was created from
ALTER TABLE home_items
  ADD COLUMN source_finding_id uuid;
-- FK added after inspection_findings table is created (below)

-- =========================================================================
-- 3. Link files to assets
-- =========================================================================
-- Photos of appliance labels, installation photos, etc. attach to assets.

ALTER TABLE files
  ADD COLUMN home_asset_id uuid REFERENCES home_assets(id) ON DELETE SET NULL;

-- =========================================================================
-- 4. Inspection Reports
-- =========================================================================
-- An uploaded or imported inspection report. Source truth document.
-- Findings are extracted from reports (manually or via future automation).

CREATE TABLE inspection_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id         uuid NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  builder_id      uuid NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  source          text NOT NULL DEFAULT 'manual_upload'
                  CHECK (source IN ('manual_upload', 'spectora', 'other')),
  title           text,                         -- "Pre-Closing Inspection", "Final Walkthrough"
  inspector_name  text,
  inspection_date date,
  file_id         uuid REFERENCES files(id) ON DELETE SET NULL,  -- the uploaded report file
  status          text NOT NULL DEFAULT 'uploaded'
                  CHECK (status IN ('uploaded', 'processing', 'processed')),
  metadata        jsonb DEFAULT '{}',           -- raw extracted data, parser version, etc.
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_inspection_reports_home ON inspection_reports (home_id);

-- =========================================================================
-- 5. Inspection Findings
-- =========================================================================
-- Individual findings extracted from an inspection report.
-- These are SOURCE TRUTH — what the inspector observed.
-- They are NOT tasks. A finding can optionally be converted into a
-- home_item (type='punch_list') via source_finding_id, but the finding
-- itself remains immutable.

CREATE TABLE inspection_findings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_report_id uuid NOT NULL REFERENCES inspection_reports(id) ON DELETE CASCADE,
  home_id             uuid NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  builder_id          uuid NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  home_asset_id       uuid REFERENCES home_assets(id) ON DELETE SET NULL,  -- what asset this is about
  section             text,                     -- "HVAC", "Plumbing", "Electrical", "Roofing"
  title               text NOT NULL,            -- "Condensation on HVAC supply line"
  description         text,                     -- inspector's full note
  severity            text CHECK (severity IN ('cosmetic', 'functional', 'safety', 'informational')),
  status              text NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'acknowledged', 'converted', 'resolved', 'wont_fix')),
  photo_file_ids      uuid[],                   -- references to files table
  metadata            jsonb DEFAULT '{}',
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX idx_inspection_findings_report ON inspection_findings (inspection_report_id);
CREATE INDEX idx_inspection_findings_home ON inspection_findings (home_id);
CREATE INDEX idx_inspection_findings_asset ON inspection_findings (home_asset_id);

-- Now add the FK from home_items.source_finding_id
ALTER TABLE home_items
  ADD CONSTRAINT fk_source_finding
  FOREIGN KEY (source_finding_id) REFERENCES inspection_findings(id) ON DELETE SET NULL;

-- =========================================================================
-- 6. Template Assets (optional — for templates that define expected assets)
-- =========================================================================
-- A template can define expected assets for a home type. When cloning,
-- these become home_assets. This is additive — templates without assets
-- still work exactly as before.

ALTER TABLE template_items
  ADD COLUMN asset_category text,               -- if set, links this item to an asset of this category
  ADD COLUMN asset_name text;                    -- default asset name when cloning

-- Also extend template_items type check
ALTER TABLE template_items
  DROP CONSTRAINT template_items_type_check;
ALTER TABLE template_items
  ADD CONSTRAINT template_items_type_check
  CHECK (type IN ('document', 'warranty', 'utility', 'checklist', 'info', 'punch_list'));

-- =========================================================================
-- 7. Query ergonomics indexes
-- =========================================================================

-- Files by asset (label photos, docs for a specific appliance)
CREATE INDEX idx_files_home_asset ON files (home_asset_id) WHERE home_asset_id IS NOT NULL;

-- Home items by asset (warranties, docs tied to a specific appliance)
CREATE INDEX idx_home_items_asset ON home_items (home_asset_id) WHERE home_asset_id IS NOT NULL;

-- Punch list queries (open tasks for a home)
CREATE INDEX idx_home_items_punch_list ON home_items (home_id, status) WHERE type = 'punch_list';

-- =========================================================================
-- 8. RLS Policies for new tables
-- =========================================================================

ALTER TABLE home_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_findings ENABLE ROW LEVEL SECURITY;

-- Home Assets: builder members can read, owners can manage, buyers can read assigned
CREATE POLICY "Builder members can read home assets" ON home_assets FOR SELECT
  USING (builder_id IN (SELECT public.get_builder_ids_for_user_by_role(auth.uid(), ARRAY['owner','staff'])));
CREATE POLICY "Buyers can read assigned home assets" ON home_assets FOR SELECT
  USING (home_id IN (SELECT public.get_home_ids_for_user(auth.uid())));
CREATE POLICY "Owners can manage home assets" ON home_assets FOR ALL
  USING (builder_id IN (SELECT public.get_builder_ids_for_user_by_role(auth.uid(), ARRAY['owner'])));

-- Inspection Reports: builder members can read/manage, buyers can read assigned
CREATE POLICY "Builder members can read inspection reports" ON inspection_reports FOR SELECT
  USING (builder_id IN (SELECT public.get_builder_ids_for_user_by_role(auth.uid(), ARRAY['owner','staff'])));
CREATE POLICY "Buyers can read assigned inspection reports" ON inspection_reports FOR SELECT
  USING (home_id IN (SELECT public.get_home_ids_for_user(auth.uid())));
CREATE POLICY "Owners can manage inspection reports" ON inspection_reports FOR ALL
  USING (builder_id IN (SELECT public.get_builder_ids_for_user_by_role(auth.uid(), ARRAY['owner'])));

-- Inspection Findings: builder members can read/manage, buyers can read assigned
CREATE POLICY "Builder members can read inspection findings" ON inspection_findings FOR SELECT
  USING (builder_id IN (SELECT public.get_builder_ids_for_user_by_role(auth.uid(), ARRAY['owner','staff'])));
CREATE POLICY "Buyers can read assigned inspection findings" ON inspection_findings FOR SELECT
  USING (home_id IN (SELECT public.get_home_ids_for_user(auth.uid())));
CREATE POLICY "Owners can manage inspection findings" ON inspection_findings FOR ALL
  USING (builder_id IN (SELECT public.get_builder_ids_for_user_by_role(auth.uid(), ARRAY['owner'])));
