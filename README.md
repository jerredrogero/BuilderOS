# BuilderOS

New-home handoff platform for builders and buyers. BuilderOS replaces spreadsheets, PDFs, and email chains with a branded, guided workflow that gets buyers from closing day through move-in — documents signed, warranties registered, utilities transferred, and nothing forgotten.

## Key Features

- **Builder admin** — Create reusable templates, manage projects and homes, attach files, track assets and inspections
- **Readiness gate** — Homes cannot be activated until required items are complete (enforced server-side)
- **Magic-link invitations** — Invite buyers via email with 7-day expiry; resend resets the clock
- **Buyer portal** — Guided checklist with documents, warranties, utilities, and proof uploads
- **White-label branding** — Per-builder colors and logo applied to buyer-facing pages
- **Reminder engine** — Automated nudges for overdue items, warranty deadlines, and activation (via Inngest cron jobs)
- **Activity logging** — Full audit trail of builder and buyer actions
- **Multi-tenant isolation** — Row-level security (RLS) and application-level checks ensure builders cannot see each other's data

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Server Actions) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS 4, Radix UI (shadcn/ui) |
| Database & Auth | Supabase (Postgres, Auth, Storage, RLS) |
| Background Jobs | Inngest |
| Email | Resend (with react-email templates) |
| Validation | Zod 4 |
| Testing | Vitest, Testing Library, jsdom |

## Prerequisites

- **Node.js 20+** (`node -v` to check)
- **Docker Desktop** running (required for local Supabase)
- **npm** (comes with Node.js)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start local Supabase

```bash
npx supabase start
```

First run takes 1-2 minutes (pulls Docker images). Note the output — you need the API URL, anon key, and service role key.

### 3. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with values from `supabase start`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
RESEND_API_KEY=re_test_fake_key_for_local
INNGEST_EVENT_KEY=local-dev-key
INNGEST_SIGNING_KEY=local-dev-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Email sending requires a real Resend key in production. In local dev, all auth emails go to Inbucket at http://127.0.0.1:54324.

### 4. Apply migrations and seed data

```bash
npx supabase db reset
```

This applies all migrations in `supabase/migrations/`, creates tables, indexes, RLS policies, the storage bucket, and seeds demo data.

### 5. Start the dev server

```bash
npm run dev
```

App runs at http://localhost:3000.

### 6. (Optional) Start Inngest dev server

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Connects to Inngest functions for background job testing. Dev UI at http://127.0.0.1:8288.

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Builder (owner) | builder@demo.com | demo1234 |
| Buyer | buyer@demo.com | demo1234 |

The seed creates Oakwood Builders with one project ("Oakwood Estates Phase 1"), one home ("4821 Oakwood Trail, Lot 12"), a starter template with 18 items, and an accepted buyer invitation. See [`docs/DEMO_WALKTHROUGH.md`](docs/DEMO_WALKTHROUGH.md) for the full click-by-click demo path.

## Core MVP Flow

1. **Builder** signs up -> starter template auto-created with 18 pre-loaded items
2. **Builder** creates a home from a template -> items and files cloned, deadlines computed from close date
3. **Builder** completes readiness checks -> server enforces all checks pass before allowing "ready" status
4. **Builder** invites a buyer via email -> magic-link invitation sent (7-day expiry)
5. **Buyer** accepts invite -> account created, linked to home
6. **Buyer** logs in -> automatically redirected to their assigned home (or multi-home chooser)
7. **Buyer** works through guided checklist -> warranties registered, utilities transferred, documents uploaded, proofs submitted

## Architecture

```
├── middleware.ts               # Auth session refresh, route protection
├── src/
│   ├── app/
│   │   ├── (auth)/             # Login, signup, password reset, invite acceptance
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   ├── reset-password/
│   │   │   └── accept-invite/
│   │   ├── (builder)/          # Builder admin (protected by membership check)
│   │   │   ├── dashboard/      # Status cards, overdue items, upcoming deadlines
│   │   │   ├── homes/          # Home CRUD, item management, readiness gate
│   │   │   ├── templates/      # Template CRUD with 5 item types, file upload
│   │   │   ├── projects/       # Project/community management
│   │   │   └── settings/       # Branding, logo upload, contact info
│   │   ├── (buyer)/            # Buyer portal (protected by home assignment)
│   │   │   └── home/[homeId]/  # Dashboard, item details, document vault
│   │   ├── api/
│   │   │   ├── auth/           # Auth callback handling
│   │   │   ├── files/          # Signed URL generation for file download/view
│   │   │   └── inngest/        # Inngest webhook endpoint
│   │   └── page.tsx            # Root route — role-aware redirect
│   ├── components/
│   │   ├── builder/            # Builder-specific components
│   │   ├── buyer/              # Buyer-specific components (white-labeled)
│   │   ├── ui/                 # shadcn/ui primitives
│   │   └── file-row.tsx        # File display with download/view actions
│   └── lib/
│       ├── actions/            # Server actions (all mutations)
│       ├── queries/            # Data-fetching functions (reads)
│       ├── supabase/           # Supabase client helpers (browser + server)
│       ├── inngest/            # Background job definitions
│       │   └── functions/      # warranty-reminders, activation-nudge, builder-escalation
│       ├── email/              # Resend client + react-email templates
│       ├── types/              # TypeScript types, database.ts (generated)
│       └── utils/              # Completion calc, priority ranking, slug generation
├── supabase/
│   ├── migrations/             # SQL migrations (applied in order)
│   ├── seed.sql                # Demo data for local development
│   └── config.toml             # Local Supabase configuration
├── tests/                      # Vitest test suite
└── docs/                       # Project documentation
```

### Data Model (key tables)

| Table | Purpose |
|-------|---------|
| `profiles` | Extends Supabase Auth users with name, avatar |
| `builders` | Tenant (builder company) with branding fields |
| `memberships` | Links users to builders with roles (`owner`, `staff`, `buyer`) |
| `projects` | Communities/subdivisions belonging to a builder |
| `templates` | Reusable home item templates |
| `template_items` | Items within a template (6 types: warranty, utility, checklist, info, document, punch_list) |
| `homes` | Individual homes within projects |
| `home_items` | Cloned items with status tracking and computed deadlines |
| `home_assignments` | Links buyers to homes |
| `invitations` | Magic-link invitations with expiry |
| `files` | File metadata (stored in Supabase Storage) |
| `home_assets` | Appliance/system assets with warranty tracking |
| `inspection_reports` | Inspection reports with finding resolution |
| `activity_log` | Audit trail of all actions |

All tables use RLS policies. Builder data is isolated by `builder_id`. Buyer access is scoped through `home_assignments`.

> **Canonical contracts:** The authoritative item-type and metadata contracts are defined in [`docs/CANONICAL_CONTRACTS.md`](docs/CANONICAL_CONTRACTS.md). Six item types are supported (`document`, `warranty`, `utility`, `checklist`, `info`, `punch_list`). Template forms use a 5-type subset (excluding `punch_list`, which is created through the punch list / inspection workflow). All metadata uses snake_case. See the spec for type-specific fields and validation rules.

### Server Actions

All mutations go through server actions in `src/lib/actions/`. Every create/update action uses Zod validation before database writes:
- `homes.ts` — Home CRUD, status management, readiness enforcement
- `template-items.ts` — Template item CRUD with type-specific validation
- `home-items.ts` — Item status updates, inline editing, and deletion with full Zod validation (type-specific fields, UUID params, status enum)
- `inspection-reports.ts` — Inspection report management
- `home-assets.ts` — Asset management
- `invitations.ts` — Invitation send, resend, accept with expiry checks
- `files.ts` — File upload/delete with storage integration
- `auth.ts` — Login, signup, password reset

### Background Jobs (Inngest)

Three cron-based functions:
- **Warranty reminders** — Alerts buyers about approaching registration deadlines
- **Activation nudge** — Prods buyers who accepted invites but haven't started
- **Builder escalation** — Notifies builders about homes with overdue critical items

## Database / Migrations

Migrations live in `supabase/migrations/` and are applied in filename order:

| Migration | Purpose |
|-----------|---------|
| `20260406000001_initial_schema.sql` | Core schema: profiles, builders, memberships, projects, templates, homes, items, files, invitations, RLS |
| `20260407000001_add_assets_inspections_punchlist.sql` | Home assets, inspection reports, punch list items |
| `20260407000002_add_invitation_expiry.sql` | `expires_at` column on invitations |
| `20260407000003_tighten_storage_policies.sql` | Scoped storage policies to builder/buyer access |

To apply migrations: `npx supabase db reset`

To generate TypeScript types from the database: `npm run db:gen-types`

## Testing

```bash
# Run tests in watch mode
npm test

# Run tests once (CI-friendly)
npm run test:run
```

Tests use Vitest with jsdom environment. Test files live in `tests/` and follow the source directory structure.

Current test coverage (221 tests across 15 files):
- **Routing** — Post-login role-based redirect logic, login page contract verification
- **Readiness** — Server-side readiness check validation
- **Completion** — Percentage calculation across item statuses
- **Priority** — Item priority ranking algorithm
- **Item contracts** — Canonical item-type consistency across DB constraints, action schemas, and type definitions
- **Home-items validation** — Zod schema enforcement for create/update/status/delete mutations, type-specific field validation, error rejection
- **Buyer workflows** — Proof upload, document access, buyer routing
- **File access** — Signed URL generation, authorization checks
- **Middleware** — Auth session refresh, route protection behavior

## Current Release Status

BuilderOS is a **release candidate** — feature-complete for the core MVP flow with a stabilization pass applied.

### Stable and regression-tested

- **Authentication** — Login, signup, password reset, magic-link invitations with 7-day expiry
- **Role-based routing** — Root route detects auth state and redirects builders to `/dashboard`, buyers to `/home/{id}` (or multi-home chooser)
- **Readiness gate** — Server-side enforcement: homes cannot be marked "ready" until all checks pass
- **Multi-tenant isolation** — RLS policies on all tables, application-level membership checks
- **Template and home CRUD** — Full lifecycle with template cloning, deadline computation, file attachment
- **Buyer portal** — Guided checklist, warranty registration, utility transfer, proof upload, document vault

### Hardened in stabilization sprint (2026-04-07)

- **Item-type contracts** — Unified across DB constraints, action schemas, forms, and UI. Canonical spec at [`docs/CANONICAL_CONTRACTS.md`](docs/CANONICAL_CONTRACTS.md)
- **Home-item validation** — All mutation paths (status update, inline edit, delete) now use Zod schemas with type-specific field validation
- **Storage policies** — Tightened from broad authenticated access to builder/buyer-scoped RLS. Three-layer model documented at [`docs/STORAGE_SECURITY.md`](docs/STORAGE_SECURITY.md)
- **Test coverage** — 221 tests across 15 files. No placeholder tests remain. Critical workflows (routing, readiness, item contracts, validation, buyer flows) are regression-protected

### How to verify correctness

```bash
npm run test:run       # 221 tests must pass
npm run lint           # ESLint must pass
npx tsc --noEmit       # TypeScript must compile clean
```

### Remaining out-of-scope items

Six items are deferred to post-MVP: email confirmation, drag-to-reorder, slug collision handling, template item limits, unstyled flash on slow connections, advanced theming. See [`docs/KNOWN_GAPS.md`](docs/KNOWN_GAPS.md) for details.

## Linting

```bash
npm run lint
```

Uses ESLint 9 with `eslint-config-next`.

## Key URLs (Local Dev)

| Service | URL |
|---------|-----|
| App | http://localhost:3000 |
| Supabase Studio | http://127.0.0.1:54323 |
| Inbucket (email) | http://127.0.0.1:54324 |
| Inngest Dev | http://127.0.0.1:8288 |

## Stopping

```bash
npx supabase stop     # Stop local Supabase
# Ctrl+C to stop Next.js dev server
```

## Documentation

- [`docs/LOCAL_RUNBOOK.md`](docs/LOCAL_RUNBOOK.md) — Detailed local development setup
- [`docs/DEMO_WALKTHROUGH.md`](docs/DEMO_WALKTHROUGH.md) — End-to-end demo script with verification checklist
- [`docs/CANONICAL_CONTRACTS.md`](docs/CANONICAL_CONTRACTS.md) — Authoritative item-type and metadata contracts
- [`docs/STORAGE_SECURITY.md`](docs/STORAGE_SECURITY.md) — Three-layer storage security model documentation
- [`docs/KNOWN_GAPS.md`](docs/KNOWN_GAPS.md) — Known limitations and deferred items
- [`docs/REGRESSION_CHECKLIST.md`](docs/REGRESSION_CHECKLIST.md) — Manual regression test plan

## Troubleshooting

**"relation does not exist"** — Run `npx supabase db reset` to re-apply migrations.

**Docker not running** — Start Docker Desktop before `supabase start`.

**Port conflicts** — Check if ports 54321-54324 or 3000 are in use.

**Auth emails not arriving** — Check Inbucket at http://127.0.0.1:54324 (all auth emails go there in local dev).

**RLS blocking queries** — Check Supabase Studio > Authentication to verify users exist and memberships are correct.
