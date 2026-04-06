# Post-Close Handoff Platform — Product Spec

## Positioning

A white-label post-closing operations platform for builders/developers that reduces buyer friction, prevents warranty loss, and coordinates the messy handoff period through guided workflows and selective automation.

We own the period right after the home is sold, where buyers are overwhelmed and builders still need things completed correctly.

### Value Buckets

1. **Warranty capture and completion** — educate buyer on what matters, track deadlines, collect required data, ideally automate submission where possible
2. **Utility takeover coordination** — tell buyer which providers apply, give steps/contacts/timing, reduce confusion
3. **Home information handoff** — manuals, contacts, paint codes, fixture info, documents
4. **Punch list / blue-tape workflow** (Phase 3) — replace loose paper with structured items, photos, statuses, and accountability

### The Promise

"We help builders manage the stressful transition from closing to move-in, while making sure buyers don't miss high-value tasks."

### Hard Boundaries (Not Building)

- Mortgage workflow tools
- Realtor CRM features
- Title/closing platforms
- Construction PM tools
- Smart home integrations
- Buyer-to-buyer community
- General marketplace features

---

## Business Model

- SaaS sold to builders/developers
- White-label or branded per builder
- Per-builder pricing with optional premium modules later (e.g., punch list)
- Manual billing pre-Phase 4; platform billing via Stripe in Phase 4
- Web-first product; lightweight iOS companion in Phase 4

---

## Target Customer

- **Semi-custom builders**, 10-50 homes/year
- Standardized enough to benefit from templates, custom enough to need per-home flexibility
- Lean operations — owner/principal often doing admin work themselves
- No dedicated IT staff; platform must be self-service and obvious
- Currently handling handoff via email dump of PDFs and links

---

## User Types

1. **Builder Owner** — primary admin, wants high-level visibility, delegates details when possible, context-switches constantly
2. **Builder Staff** (Phase 2) — warranty coordinator, office manager, or assistant handling day-to-day operations
3. **Home Buyer / Homeowner** — may not be technical, needs simple guided experience, receives and acts on information
4. **Subcontractor / Service Provider** — deferred, only if clear demand signal

---

## Feature Evaluation Criteria

Every feature must pass these questions:

- Does this save time?
- Does this reduce missed deadlines or lost warranty value?
- Does this increase builder adoption or retention?
- Does this improve buyer activation or engagement?
- Can this be delivered simply in v1?
- Is this critical now, or can it wait?

---

## Domain Model

### Builder (Tenant)

The paying customer. Branding config, settings, subscription tier. One builder = one tenant. All data is tenant-scoped.

### Profile

Maps 1:1 to Supabase Auth uid. Not the auth source of truth — extends auth with app-specific fields (full_name, avatar_url). Created via database trigger on `auth.users` insert.

### Membership

Links a Profile to a Builder with a role: `owner`, `staff`, or `buyer`. A user could belong to multiple builders. Role is scoped through membership, not on the user directly.

### Project / Community

Optional grouping layer. A builder organizes homes under a Project (e.g., "Oakwood Estates Phase 2"). Has location fields (city, state, zip, subdivision). Utility applicability rules match on project-level location first, then home-level address. Homes can exist without a project for one-off custom builds.

### Template

Reusable handoff blueprint owned by a builder. Contains template items. Builder creates once, clones to create homes. Platform provides a pre-loaded starter template with common categories. A builder can have multiple templates.

### Home

A specific property, created by cloning a template. Has address, lot number, close date, project assignment (optional), template source reference.

**Handoff Status lifecycle:**

| Status | Set by | Trigger |
|---|---|---|
| `draft` | System | Home created |
| `ready` | Builder (manual) | Builder completes readiness checklist |
| `invited` | System | First invitation sent |
| `activated` | System | Buyer accepts invitation and logs in |
| `engaged` | System | Buyer completes first critical item |
| `completed` | System or Builder | All critical items resolved, or manual override |

Status moves forward only (except `ready` -> `draft` if builder needs to undo before inviting). Manual override to `completed` is always logged in activity log.

### Home Assignment

Links Profiles to a Home with a role: `primary_buyer`, `co_buyer`, `viewer`. Supports multiple people per home. v1 emphasizes primary buyer.

### Home Item

Central entity. Every item has shared base fields plus type-specific fields.

**Shared fields:**
- `type`: document, warranty, utility, checklist, info
- `status`: pending, in_progress, complete, skipped, not_applicable
- `source`: template (cloned) or manual (added directly)
- `is_critical`: boolean — drives completion percentage and "you're all set" state
- `title`, `description`, `due_date` (absolute), `category`, `sort_order`

**Warranty-specific fields (first-class columns, not JSON):**
- `manufacturer`, `model_number`, `serial_number`
- `registration_url`, `registration_deadline`, `registration_status` (not_started, registered, expired)
- `responsible_party` (buyer, builder, subcontractor)
- `proof_file_id`

**Utility-specific fields:**
- `utility_type` (electric, gas, water, sewer, trash, internet, other) — first-class column
- Provider details and applicability rules in metadata jsonb

**Other type fields:**
- Document: file reference in metadata
- Checklist: action description in metadata
- Info: freeform content or key-value pairs in metadata

### File

Attached to either a template item or a home item (never both — enforced via check constraint). Template files are cloned by creating new metadata rows pointing to the same storage path (no file duplication). Stored in Supabase Storage with signed URLs for secure access.

### Note

Scoped to either a home (general) or a specific home item (contextual). Never orphaned.

### Activity Log

Immutable append-only log. Fields: timestamp, actor_type (user/system), actor_id, action, target_item_id, metadata jsonb. Indexed on (home_id, created_at DESC).

### Invitation

Tracks buyer invitations per home. Status: pending, sent, accepted, expired. Includes token for magic link, resend count, timestamps. Check constraint on role.

### Reminders Sent

Tracks which reminders have been sent to prevent duplicates. Unique constraint on (home_item_id, reminder_type, recipient_id).

### Completion Logic

```
completion_pct = count(critical items with status IN (complete, skipped, not_applicable))
                 / count(critical items)
                 * 100
```

- Only `is_critical = true` items count
- Non-critical items (info, paint codes, reference docs) excluded
- Zero critical items = 100%
- Cached on homes table, recomputed on any item status change

---

## Data Schema

### builders

```sql
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
```

### profiles

```sql
CREATE TABLE profiles (
  id              uuid PRIMARY KEY, -- matches Supabase Auth uid
  email           text UNIQUE NOT NULL,
  full_name       text,
  avatar_url      text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

### memberships

```sql
CREATE TABLE memberships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id),
  builder_id      uuid NOT NULL REFERENCES builders(id),
  role            text NOT NULL CHECK (role IN ('owner','staff','buyer')),
  created_at      timestamptz DEFAULT now(),
  UNIQUE(user_id, builder_id)
);
```

### projects

```sql
CREATE TABLE projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id      uuid NOT NULL REFERENCES builders(id),
  name            text NOT NULL,
  city            text,
  state           text,
  zip_code        text,
  subdivision     text,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

### templates

```sql
CREATE TABLE templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id      uuid NOT NULL REFERENCES builders(id),
  name            text NOT NULL,
  description     text,
  is_starter      boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

### template_items

```sql
CREATE TABLE template_items (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id                 uuid NOT NULL REFERENCES templates(id),
  type                        text NOT NULL CHECK (type IN ('document','warranty','utility','checklist','info')),
  category                    text NOT NULL,
  title                       text NOT NULL,
  description                 text,
  sort_order                  integer DEFAULT 0,
  due_date_offset             integer, -- days relative to close date
  is_critical                 boolean NOT NULL DEFAULT false,
  -- Warranty fields
  manufacturer                text,
  registration_url            text,
  registration_deadline_offset integer, -- days after close date
  responsible_party           text CHECK (responsible_party IN ('buyer','builder','subcontractor')),
  -- Utility fields
  utility_type                text CHECK (utility_type IN ('electric','gas','water','sewer','trash','internet','other')),
  -- Flexible metadata
  metadata                    jsonb DEFAULT '{}',
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now()
);
```

### homes

```sql
CREATE TABLE homes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id      uuid NOT NULL REFERENCES builders(id),
  project_id      uuid REFERENCES projects(id),
  template_id     uuid REFERENCES templates(id),
  address         text NOT NULL,
  lot_number      text,
  close_date      date,
  handoff_status  text NOT NULL DEFAULT 'draft'
                  CHECK (handoff_status IN ('draft','ready','invited','activated','engaged','completed')),
  completion_pct  smallint DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

### home_assignments

```sql
CREATE TABLE home_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id         uuid NOT NULL REFERENCES homes(id),
  user_id         uuid NOT NULL REFERENCES profiles(id),
  role            text NOT NULL CHECK (role IN ('primary_buyer','co_buyer','viewer')),
  created_at      timestamptz DEFAULT now(),
  UNIQUE(home_id, user_id)
);
```

### home_items

```sql
CREATE TABLE home_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id               uuid NOT NULL REFERENCES homes(id),
  builder_id            uuid NOT NULL REFERENCES builders(id), -- denormalized for RLS
  type                  text NOT NULL CHECK (type IN ('document','warranty','utility','checklist','info')),
  category              text NOT NULL,
  title                 text NOT NULL,
  description           text,
  sort_order            integer DEFAULT 0,
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','in_progress','complete','skipped','not_applicable')),
  source                text NOT NULL DEFAULT 'template'
                        CHECK (source IN ('template','manual')),
  template_item_id      uuid REFERENCES template_items(id),
  due_date              date,
  is_critical           boolean NOT NULL DEFAULT false,
  -- Warranty fields (nullable, only for type='warranty')
  registration_status   text CHECK (registration_status IN ('not_started','registered','expired')),
  registration_deadline date,
  responsible_party     text CHECK (responsible_party IN ('buyer','builder','subcontractor')),
  manufacturer          text,
  model_number          text,
  serial_number         text,
  registration_url      text,
  proof_file_id         uuid, -- FK to files, set after file creation (avoids circular insert)
  -- Utility fields (nullable, only for type='utility')
  utility_type          text CHECK (utility_type IN ('electric','gas','water','sewer','trash','internet','other')),
  -- Flexible metadata
  metadata              jsonb DEFAULT '{}',
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);
```

### files

```sql
CREATE TABLE files (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id        uuid NOT NULL REFERENCES builders(id),
  home_id           uuid REFERENCES homes(id),
  home_item_id      uuid REFERENCES home_items(id),
  template_id       uuid REFERENCES templates(id),
  template_item_id  uuid REFERENCES template_items(id),
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
```

### notes

```sql
CREATE TABLE notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id      uuid NOT NULL REFERENCES builders(id),
  home_id         uuid NOT NULL REFERENCES homes(id),
  home_item_id    uuid REFERENCES home_items(id),
  author_id       uuid NOT NULL REFERENCES profiles(id),
  body            text NOT NULL,
  created_at      timestamptz DEFAULT now()
);
```

### activity_log

```sql
CREATE TABLE activity_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id      uuid NOT NULL REFERENCES builders(id),
  home_id         uuid NOT NULL REFERENCES homes(id),
  home_item_id    uuid REFERENCES home_items(id),
  actor_type      text NOT NULL CHECK (actor_type IN ('user','system')),
  actor_id        uuid REFERENCES profiles(id),
  action          text NOT NULL,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_activity_log_home_date ON activity_log (home_id, created_at DESC);
```

### invitations

```sql
CREATE TABLE invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id         uuid NOT NULL REFERENCES homes(id),
  builder_id      uuid NOT NULL REFERENCES builders(id),
  email           text NOT NULL,
  role            text NOT NULL DEFAULT 'primary_buyer'
                  CHECK (role IN ('primary_buyer','co_buyer','viewer')),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','sent','accepted','expired')),
  token           uuid UNIQUE DEFAULT gen_random_uuid(),
  sent_at         timestamptz,
  accepted_at     timestamptz,
  resend_count    integer DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

### reminders_sent

```sql
CREATE TABLE reminders_sent (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_item_id    uuid NOT NULL REFERENCES home_items(id),
  reminder_type   text NOT NULL,
  recipient_id    uuid NOT NULL REFERENCES profiles(id),
  sent_at         timestamptz DEFAULT now(),
  UNIQUE(home_item_id, reminder_type, recipient_id)
);
```

### Implementation Notes

- **proof_file_id on home_items:** Insert home_item first, then file, then update home_item.proof_file_id. No one-shot inserts.
- **Type-scoped column constraints:** Deferred past v1. Intent is clear — warranty columns should be null when type != 'warranty'. Add check constraints when schema stabilizes.
- **File cloning:** Template files cloned by creating new file rows pointing to same storage_path. No storage duplication.
- **RLS:** Enabled on all tables accessible from the client. Policies enforce tenant isolation through membership chain.

---

## System Architecture

### Stack

| Layer | Decision |
|---|---|
| Framework | Next.js (App Router) — SSR + server actions + route handlers |
| Database | Supabase (Postgres) — managed, RLS, auth, storage |
| Auth | Supabase Auth — magic links, email/password, native RLS integration |
| File Storage | Supabase Storage — signed URLs, storage policies tied to auth |
| Email | Resend — transactional emails, React Email for templates |
| Job Scheduler | Inngest — cron-style scheduled functions, Vercel-native |
| Hosting | Vercel — zero-config Next.js deploys |
| Styling | Tailwind CSS + shadcn/ui — fast to build, CSS custom properties for theming |

### Multi-Tenancy

- Shared database, tenant-scoped rows
- Tenant scoping on all tables serving data to browsers
- RLS enabled as defense-in-depth on all client-accessible tables
- Application-level permission checks (user -> membership -> builder -> home) on every request
- Home ID in URL is for routing only, never authorization

### White-Label Theming

- Builder settings: logo_url, primary_color, accent_color, company_name
- Buyer pages load theme from home's builder at render time
- CSS custom properties (--brand-primary, --brand-accent) at layout level
- v1: color + logo only. Custom subdomains in Phase 4.
- Tenant resolution: builder admin from session, buyer pages from home -> builder chain

### Auth Flow

- Builders: email/password signup -> creates tenant + owner membership
- Staff (Phase 2): invited by owner -> creates account -> membership auto-assigned
- Buyers: invited per home -> magic link -> membership + home assignment auto-created. Magic link only for v1 (no password to forget, lowest friction for non-technical buyers). Email/password can be added later if needed.

### Reminder Engine

- Inngest scheduled function, runs daily
- Scans home_items for upcoming/overdue deadlines
- Sends branded emails via Resend
- Records in reminders_sent to prevent duplicates
- Builder escalation as digest email (not per-item)
- Builder notification discipline: escalations, stuck buyers, critical deadlines only. Buyers get routine reminders.

### Document Storage

- Supabase Storage: /{builder_id}/{home_id}/{item_id}/{filename}
- Signed URLs for buyer access (time-limited, scoped)
- Upload limit: 25MB per file for v1

---

## Builder Workflows

### One-Time Setup

1. Create account -> builder tenant provisioned
2. Set branding (logo, colors, company name)
3. Platform provides starter template pre-loaded with common categories and example items
4. Optionally create projects and additional templates

### Template Management

- Add/remove/reorder items by category
- Upload default documents
- Set warranty entries with manufacturer defaults
- Set utility entries with applicability rules (zip-based for v1)
- Set checklist items with relative deadlines
- Mark items as critical or non-critical

### Per-Home Handoff

1. **Create Home** — select project (optional), pick template, enter lot/address + close date -> clone template, compute absolute dates, filter utilities by location
2. **Customize & Complete Readiness Checklist:**
   - At least 1 document uploaded (or explicitly confirmed none)
   - Warranty entries reviewed (confirm or mark N/A)
   - Utility list reviewed (confirm providers for this location)
3. **Mark Ready** — unlocked after readiness checklist complete
4. **Invite Buyer** — enter email(s), system sends branded invitation, dashboard shows status
5. **Monitor** — system handles reminders; builder sees dashboard with status and escalations

Homes are editable after invite. Changes logged in activity log. No locking.

### Builder Dashboard

Answers in under 5 seconds:
- Homes by handoff status, filterable by project
- Action needed: overdue items, stuck buyers, incomplete readiness checklists
- Upcoming deadlines: warranties and checklists due in next 14 days

### Automated Reminders

| Trigger | Recipient | Action |
|---|---|---|
| Invited, not activated after 3 days | Buyer + Builder | Resend invitation + notify builder |
| Activated, no actions after 7 days | Buyer | "Here's what to do first" nudge |
| Warranty deadline in 14 days | Buyer | Reminder with direct registration link |
| Warranty deadline in 3 days | Buyer + Builder | Urgent reminder + builder escalation |
| Item past due | Builder | Dashboard flag, optional escalation email |

### Builder Notification Discipline

Builders receive only: escalations, stuck buyers, critical deadlines. Buyers absorb routine reminders. Builder trust > notification volume.

---

## Buyer Experience

### Design Philosophy

Guided concierge, not task manager. Feels helpful, not overwhelming. High trust UX for buyers who may not be technical.

### Onboarding Flow

1. **Invitation email** — builder-branded, single CTA: "View Your Home"
2. **Account creation** — branded page, magic link (no password), no app download
3. **Welcome screen** — congratulations message (customizable), orientation: "Here's what we've set up for you"
4. **First action prompt** — single most urgent/impactful action highlighted

### Buyer Dashboard

**"What matters now" prioritized feed** — single ranked list with the most important next action at top. Not just temporal zones, but a prioritized view. Ranking logic for v1: overdue items first (sorted by how overdue), then items due soonest, then items with no deadline. Within equal urgency, critical items rank above non-critical.

**Progress signal:** "3 of 8 critical items completed" with progress bar.

**Completion state:** When all critical items resolved, buyer sees "You're all set." Remaining items shift to "Reference" section. Home handoff status moves to `completed`.

### Item Detail View

- **Document** — preview/download, category label, builder notes, inline on relevant items
- **Warranty** — pre-filled manufacturer/model/serial, deadline countdown, "Register Now" button (opens manufacturer URL), "Mark as Registered" with optional proof upload
- **Utility** — provider name, phone, website, step-by-step transfer instructions
- **Checklist** — description, "Mark Complete" button
- **Info** — read-only reference (paint codes, fixture models, emergency contacts)

### Warranty Registration Flow

1. See warranty item with countdown
2. Review pre-filled details (manufacturer, model, serial)
3. Click "Register Now" -> opens manufacturer's registration page
4. Return to platform, click "Mark as Registered"
5. Optionally upload proof (screenshot of confirmation)
6. Status updates, item resolves
7. Activity log records completion

### Utility Transfer Flow

1. See utility items filtered to location
2. Each shows: provider, contact info, plain-language instructions
3. Mark as "Transferred" when done
4. Manual for v1 — no API integrations

### Document Access

- Documents surfaced inline on relevant items (warranty item shows linked manual)
- Document vault exists for browsing all docs by category
- Search by name, download individual files
- Buyers can upload their own documents (receipts, warranty confirmations)

### Contact Builder

Simple link on every page: "Have a question? Contact [Builder Name]" with builder's preferred method. Not a messaging system.

### Notification Preferences

Single toggle: "Important reminders only" (default ON). No granular settings in v1.

---

## Phased Roadmap

### Phase 1: MVP — "Smart Home Handoff"

Proves: builders can set up a home handoff fast, buyers can complete warranty tasks, the system reduces missed deadlines.

**Ships:**
- Auth, tenancy, branding (logo + colors)
- Profiles, memberships (owner + buyer roles)
- Templates with starter template
- Projects and homes
- Home items (all 5 types), is_critical flag, status tracking
- Warranty workflow: pre-filled details, registration URL, deadline countdown, proof upload
- Buyer portal: branded, prioritized feed, progress bar
- Reminder engine: warranty deadlines (14d, 3d, overdue), activation nudge
- Invitation flow with status tracking and resend
- Handoff status lifecycle
- Builder dashboard: homes list, status, overdue flags, project filter
- Documents: upload, inline on items, buyer download
- Activity log
- Closing readiness checklist (gate before invite)
- Contact builder link
- White-label: logo + colors on buyer pages

**Not in Phase 1:** Staff role, bulk actions, notes, utility workflow, notification preferences, return-to-register nudge.

### Phase 2: "Staff Operations + Utility Workflows"

- Staff role with invite and scoped permissions
- Staff working view: filterable table, bulk resend, fast navigation
- Staff-complete-on-behalf: mark done, upload proof, add notes
- Utility transfer workflow with location filtering
- Notes (home-level and item-level)
- Builder escalation digest email
- Buyer notification toggle
- Return-to-register nudge banner

### Phase 3: "Punch List + Closeout"

- Punch list / blue-tape module (potential premium add-on)
- Inspection closeout docs
- Builder reporting (completion rates, activation times, warranty registration rates)
- Audit trail export (PDF/CSV)
- Template versioning
- Homeowner reference center (permanent home record after critical items done)

### Phase 4: "Automation + Scale"

- Document OCR (extract warranty details from PDFs)
- Warranty auto-submission (where manufacturer APIs exist)
- Custom subdomain with CNAME
- Billing via Stripe
- iOS companion (home overview, doc access, photo upload, push notifications)
- Vendor/service recommendations (only if revenue-generating)
- Onboarding wizard

---

## Risks and Assumptions

### Assumptions to Validate with Builders

1. Builders will invest time in one-time template setup if it saves per-home work
2. Warranty registration is painful enough to be a buying trigger
3. Builders want visibility into buyer completion rates
4. Email-based reminders are sufficient for buyer engagement (vs. SMS/push)
5. Buyers will actually use the platform if invited (activation rate assumption)
6. Semi-custom builders (10-50 homes/year) have budget for this tool
7. The email dump is the dominant current process, not paper or nothing

### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Low buyer activation rate | Core value undermined | Strong onboarding, single CTA, follow-up nudges, builder escalation |
| Builder template setup feels like too much work | Adoption friction | Starter template, minimal required fields, guided setup |
| Warranty manufacturers change registration URLs | Broken workflows | Builder/staff can update per-home, flag stale URLs |
| Buyers ignore reminders | Missed deadlines persist | Escalate to builder, staff-complete-on-behalf in Phase 2 |
| White-label theming is insufficient for larger builders | Limits upmarket expansion | Phase 4 adds subdomains, deeper customization |
| Scope creep into adjacent tools (CRM, PM, mortgage) | Lost focus | Hard boundaries defined, feature evaluation criteria enforced |

---

## Product Principles

- Web-first, mobile-friendly
- White-label ready from early architecture decisions
- Permissions and tenant separation must be strong
- Every important workflow has a clear status model
- Document uploads and metadata are first-class
- Keep the MVP narrow and commercially useful
- Avoid large integrations unless they unlock obvious value
- Optimize for: removing manual work, reducing missed deadlines, builder operational efficiency, buyer trust, clear audit trails
- Do not expand into "everything about home buying" — own post-closing handoff first

---

## Pre-Implementation Notes

Items to resolve during the implementation planning pass, not product-definition issues:

1. **proof_file_id FK:** Add explicit foreign key to files table once creation-order pattern is confirmed (create item -> create file -> update item.proof_file_id).
2. **Dashboard/reminder indexes:** Add indexes for high-frequency queries: home_items by (builder_id, registration_deadline), homes by (builder_id, handoff_status), invitations by (builder_id, status).
3. **reminders_sent scope:** Current schema ties reminders to home_item_id. Invitation/activation nudges target the home or buyer, not a specific item. Either add nullable home_item_id with a home_id column, or use a separate table for home-level nudges. Decide during implementation.
4. **File constraint tightening:** Current check constraint ensures home xor template scope. Consider whether home_item_id / template_item_id also need mutual exclusivity enforcement.
5. **Billing vs. platform billing:** Manual billing (invoices, Stripe links) can and should start before Phase 4. "Billing in Phase 4" means automated subscription management in-product, not "wait to charge customers."
