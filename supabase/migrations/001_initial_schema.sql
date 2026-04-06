-- Profiles (extends Supabase Auth)
CREATE TABLE profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text UNIQUE NOT NULL,
  full_name       text,
  avatar_url      text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Auto-create profile on auth signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Builders (tenants)
CREATE TABLE builders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text UNIQUE NOT NULL,
  logo_url        text,
  primary_color   text DEFAULT '#1a1a1a',
  accent_color    text DEFAULT '#2563eb',
  contact_email   text,
  contact_phone   text,
  welcome_message text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Memberships (user-builder-role link)
CREATE TABLE memberships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  builder_id      uuid NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('owner', 'staff', 'buyer')),
  created_at      timestamptz DEFAULT now(),
  UNIQUE(user_id, builder_id)
);

-- Projects / Communities
CREATE TABLE projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id      uuid NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  name            text NOT NULL,
  city            text,
  state           text,
  zip_code        text,
  subdivision     text,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Templates
CREATE TABLE templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id      uuid NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  is_starter      boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Template Items
CREATE TABLE template_items (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id                  uuid NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  type                         text NOT NULL CHECK (type IN ('document', 'warranty', 'utility', 'checklist', 'info')),
  category                     text NOT NULL,
  title                        text NOT NULL,
  description                  text,
  sort_order                   integer DEFAULT 0,
  due_date_offset              integer,
  is_critical                  boolean NOT NULL DEFAULT false,
  manufacturer                 text,
  registration_url             text,
  registration_deadline_offset integer,
  responsible_party            text CHECK (responsible_party IN ('buyer', 'builder', 'subcontractor')),
  utility_type                 text CHECK (utility_type IN ('electric', 'gas', 'water', 'sewer', 'trash', 'internet', 'other')),
  metadata                     jsonb DEFAULT '{}',
  created_at                   timestamptz DEFAULT now(),
  updated_at                   timestamptz DEFAULT now()
);

-- Homes
CREATE TABLE homes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id      uuid NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES projects(id) ON DELETE SET NULL,
  template_id     uuid REFERENCES templates(id) ON DELETE SET NULL,
  address         text NOT NULL,
  lot_number      text,
  close_date      date,
  handoff_status  text NOT NULL DEFAULT 'draft'
                  CHECK (handoff_status IN ('draft', 'ready', 'invited', 'activated', 'engaged', 'completed')),
  completion_pct  smallint DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Home Assignments
CREATE TABLE home_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id         uuid NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('primary_buyer', 'co_buyer', 'viewer')),
  created_at      timestamptz DEFAULT now(),
  UNIQUE(home_id, user_id)
);

-- Home Items
CREATE TABLE home_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id               uuid NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  builder_id            uuid NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  type                  text NOT NULL CHECK (type IN ('document', 'warranty', 'utility', 'checklist', 'info')),
  category              text NOT NULL,
  title                 text NOT NULL,
  description           text,
  sort_order            integer DEFAULT 0,
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_progress', 'complete', 'skipped', 'not_applicable')),
  source                text NOT NULL DEFAULT 'template'
                        CHECK (source IN ('template', 'manual')),
  template_item_id      uuid REFERENCES template_items(id) ON DELETE SET NULL,
  due_date              date,
  is_critical           boolean NOT NULL DEFAULT false,
  registration_status   text CHECK (registration_status IN ('not_started', 'registered', 'expired')),
  registration_deadline date,
  responsible_party     text CHECK (responsible_party IN ('buyer', 'builder', 'subcontractor')),
  manufacturer          text,
  model_number          text,
  serial_number         text,
  registration_url      text,
  proof_file_id         uuid,
  utility_type          text CHECK (utility_type IN ('electric', 'gas', 'water', 'sewer', 'trash', 'internet', 'other')),
  metadata              jsonb DEFAULT '{}',
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Files
CREATE TABLE files (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id        uuid NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  home_id           uuid REFERENCES homes(id) ON DELETE CASCADE,
  home_item_id      uuid REFERENCES home_items(id) ON DELETE SET NULL,
  template_id       uuid REFERENCES templates(id) ON DELETE CASCADE,
  template_item_id  uuid REFERENCES template_items(id) ON DELETE SET NULL,
  uploaded_by       uuid NOT NULL REFERENCES profiles(id),
  storage_path      text NOT NULL,
  filename          text NOT NULL,
  mime_type         text,
  size_bytes        integer,
  created_at        timestamptz DEFAULT now(),
  CHECK (
    (home_id IS NOT NULL AND template_id IS NULL) OR
    (home_id IS NULL AND template_id IS NOT NULL)
  )
);

-- Add FK for proof_file_id now that files table exists
ALTER TABLE home_items
  ADD CONSTRAINT fk_proof_file
  FOREIGN KEY (proof_file_id) REFERENCES files(id) ON DELETE SET NULL;

-- Notes
CREATE TABLE notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id      uuid NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  home_id         uuid NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  home_item_id    uuid REFERENCES home_items(id) ON DELETE SET NULL,
  author_id       uuid NOT NULL REFERENCES profiles(id),
  body            text NOT NULL,
  created_at      timestamptz DEFAULT now()
);

-- Activity Log
CREATE TABLE activity_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id      uuid NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  home_id         uuid NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  home_item_id    uuid REFERENCES home_items(id) ON DELETE SET NULL,
  actor_type      text NOT NULL CHECK (actor_type IN ('user', 'system')),
  actor_id        uuid REFERENCES profiles(id),
  action          text NOT NULL,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_activity_log_home_date ON activity_log (home_id, created_at DESC);

-- Invitations
CREATE TABLE invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id         uuid NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  builder_id      uuid NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  email           text NOT NULL,
  role            text NOT NULL DEFAULT 'primary_buyer'
                  CHECK (role IN ('primary_buyer', 'co_buyer', 'viewer')),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sent', 'accepted', 'expired')),
  token           uuid UNIQUE DEFAULT gen_random_uuid(),
  sent_at         timestamptz,
  accepted_at     timestamptz,
  resend_count    integer DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Reminders Sent
CREATE TABLE reminders_sent (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_item_id    uuid REFERENCES home_items(id) ON DELETE CASCADE,
  home_id         uuid REFERENCES homes(id) ON DELETE CASCADE,
  reminder_type   text NOT NULL,
  recipient_id    uuid NOT NULL REFERENCES profiles(id),
  sent_at         timestamptz DEFAULT now(),
  UNIQUE(COALESCE(home_item_id, '00000000-0000-0000-0000-000000000000'), reminder_type, recipient_id)
);

-- Performance indexes
CREATE INDEX idx_homes_builder_status ON homes (builder_id, handoff_status);
CREATE INDEX idx_home_items_builder_deadline ON home_items (builder_id, registration_deadline) WHERE registration_deadline IS NOT NULL;
CREATE INDEX idx_home_items_home_status ON home_items (home_id, status);
CREATE INDEX idx_home_items_home_critical ON home_items (home_id, is_critical) WHERE is_critical = true;
CREATE INDEX idx_invitations_builder_status ON invitations (builder_id, status);
CREATE INDEX idx_invitations_token ON invitations (token);
CREATE INDEX idx_memberships_user ON memberships (user_id);
CREATE INDEX idx_memberships_builder ON memberships (builder_id);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE builders ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders_sent ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Builders
CREATE POLICY "Members can read their builder" ON builders FOR SELECT
  USING (EXISTS (SELECT 1 FROM memberships WHERE memberships.builder_id = builders.id AND memberships.user_id = auth.uid()));
CREATE POLICY "Owners can update their builder" ON builders FOR UPDATE
  USING (EXISTS (SELECT 1 FROM memberships WHERE memberships.builder_id = builders.id AND memberships.user_id = auth.uid() AND memberships.role = 'owner'));

-- Memberships
CREATE POLICY "Users can read own memberships" ON memberships FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Owners can read builder memberships" ON memberships FOR SELECT
  USING (EXISTS (SELECT 1 FROM memberships AS m WHERE m.builder_id = memberships.builder_id AND m.user_id = auth.uid() AND m.role = 'owner'));

-- Projects
CREATE POLICY "Members can read projects" ON projects FOR SELECT
  USING (EXISTS (SELECT 1 FROM memberships WHERE memberships.builder_id = projects.builder_id AND memberships.user_id = auth.uid() AND memberships.role IN ('owner', 'staff')));
CREATE POLICY "Owners can manage projects" ON projects FOR ALL
  USING (EXISTS (SELECT 1 FROM memberships WHERE memberships.builder_id = projects.builder_id AND memberships.user_id = auth.uid() AND memberships.role = 'owner'));

-- Templates
CREATE POLICY "Builder members can read templates" ON templates FOR SELECT
  USING (EXISTS (SELECT 1 FROM memberships WHERE memberships.builder_id = templates.builder_id AND memberships.user_id = auth.uid() AND memberships.role IN ('owner', 'staff')));
CREATE POLICY "Owners can manage templates" ON templates FOR ALL
  USING (EXISTS (SELECT 1 FROM memberships WHERE memberships.builder_id = templates.builder_id AND memberships.user_id = auth.uid() AND memberships.role = 'owner'));

-- Template Items
CREATE POLICY "Builder members can read template items" ON template_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM memberships JOIN templates ON templates.id = template_items.template_id WHERE memberships.builder_id = templates.builder_id AND memberships.user_id = auth.uid() AND memberships.role IN ('owner', 'staff')));
CREATE POLICY "Owners can manage template items" ON template_items FOR ALL
  USING (EXISTS (SELECT 1 FROM memberships JOIN templates ON templates.id = template_items.template_id WHERE memberships.builder_id = templates.builder_id AND memberships.user_id = auth.uid() AND memberships.role = 'owner'));

-- Homes
CREATE POLICY "Builder members can read homes" ON homes FOR SELECT
  USING (EXISTS (SELECT 1 FROM memberships WHERE memberships.builder_id = homes.builder_id AND memberships.user_id = auth.uid() AND memberships.role IN ('owner', 'staff')));
CREATE POLICY "Buyers can read assigned homes" ON homes FOR SELECT
  USING (EXISTS (SELECT 1 FROM home_assignments WHERE home_assignments.home_id = homes.id AND home_assignments.user_id = auth.uid()));
CREATE POLICY "Owners can manage homes" ON homes FOR ALL
  USING (EXISTS (SELECT 1 FROM memberships WHERE memberships.builder_id = homes.builder_id AND memberships.user_id = auth.uid() AND memberships.role = 'owner'));

-- Home Assignments
CREATE POLICY "Builder members can read home assignments" ON home_assignments FOR SELECT
  USING (EXISTS (SELECT 1 FROM memberships JOIN homes ON homes.id = home_assignments.home_id WHERE memberships.builder_id = homes.builder_id AND memberships.user_id = auth.uid() AND memberships.role IN ('owner', 'staff')));
CREATE POLICY "Buyers can read own home assignments" ON home_assignments FOR SELECT USING (user_id = auth.uid());

-- Home Items
CREATE POLICY "Builder members can read home items" ON home_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM memberships WHERE memberships.builder_id = home_items.builder_id AND memberships.user_id = auth.uid() AND memberships.role IN ('owner', 'staff')));
CREATE POLICY "Buyers can read assigned home items" ON home_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM home_assignments WHERE home_assignments.home_id = home_items.home_id AND home_assignments.user_id = auth.uid()));
CREATE POLICY "Owners can manage home items" ON home_items FOR ALL
  USING (EXISTS (SELECT 1 FROM memberships WHERE memberships.builder_id = home_items.builder_id AND memberships.user_id = auth.uid() AND memberships.role = 'owner'));
CREATE POLICY "Buyers can update assigned home items" ON home_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM home_assignments WHERE home_assignments.home_id = home_items.home_id AND home_assignments.user_id = auth.uid()));

-- Files
CREATE POLICY "Builder members can read files" ON files FOR SELECT
  USING (EXISTS (SELECT 1 FROM memberships WHERE memberships.builder_id = files.builder_id AND memberships.user_id = auth.uid() AND memberships.role IN ('owner', 'staff')));
CREATE POLICY "Buyers can read files for assigned homes" ON files FOR SELECT
  USING (files.home_id IS NOT NULL AND EXISTS (SELECT 1 FROM home_assignments WHERE home_assignments.home_id = files.home_id AND home_assignments.user_id = auth.uid()));
CREATE POLICY "Owners can manage files" ON files FOR ALL
  USING (EXISTS (SELECT 1 FROM memberships WHERE memberships.builder_id = files.builder_id AND memberships.user_id = auth.uid() AND memberships.role = 'owner'));

-- Notes
CREATE POLICY "Builder members can read notes" ON notes FOR SELECT
  USING (EXISTS (SELECT 1 FROM memberships WHERE memberships.builder_id = notes.builder_id AND memberships.user_id = auth.uid() AND memberships.role IN ('owner', 'staff')));
CREATE POLICY "Buyers can read notes for assigned homes" ON notes FOR SELECT
  USING (EXISTS (SELECT 1 FROM home_assignments WHERE home_assignments.home_id = notes.home_id AND home_assignments.user_id = auth.uid()));

-- Activity Log
CREATE POLICY "Builder members can read activity log" ON activity_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM memberships WHERE memberships.builder_id = activity_log.builder_id AND memberships.user_id = auth.uid() AND memberships.role IN ('owner', 'staff')));
CREATE POLICY "Buyers can read activity for assigned homes" ON activity_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM home_assignments WHERE home_assignments.home_id = activity_log.home_id AND home_assignments.user_id = auth.uid()));

-- Invitations
CREATE POLICY "Builder members can read invitations" ON invitations FOR SELECT
  USING (EXISTS (SELECT 1 FROM memberships WHERE memberships.builder_id = invitations.builder_id AND memberships.user_id = auth.uid() AND memberships.role IN ('owner', 'staff')));
CREATE POLICY "Owners can manage invitations" ON invitations FOR ALL
  USING (EXISTS (SELECT 1 FROM memberships WHERE memberships.builder_id = invitations.builder_id AND memberships.user_id = auth.uid() AND memberships.role = 'owner'));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can read" ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);
