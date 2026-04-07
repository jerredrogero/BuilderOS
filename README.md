# BuilderOS

New-home handoff platform for builders and buyers. BuilderOS replaces spreadsheets, PDFs, and email chains with a branded, guided workflow that gets buyers from closing day through move-in — documents signed, warranties registered, utilities transferred, and nothing forgotten.

## Key Features

- **Builder admin** — Create reusable templates, manage projects and homes, attach files, track assets and inspections
- **Readiness gate** — Homes cannot be activated until required items are complete
- **Magic-link invitations** — Invite buyers via email; they land directly in their branded portal
- **Buyer portal** — Guided checklist with documents, warranties, utilities, and uploads
- **White-label branding** — Per-builder colors applied to buyer-facing pages
- **Reminder engine** — Automated nudges for overdue items, warranty deadlines, and activation
- **Activity logging** — Full audit trail of builder and buyer actions
- **Multi-tenant isolation** — Row-level security and application-level checks

## Tech Stack

- **Framework:** Next.js 16 (App Router, Server Actions)
- **Language:** TypeScript 5
- **UI:** React 19, Tailwind CSS 4
- **Database & Auth:** Supabase (Postgres, Auth, Storage, RLS)
- **Background Jobs:** Inngest
- **Email:** Resend
- **Validation:** Zod

## Prerequisites

- Node.js 20+
- Docker Desktop (for local Supabase)
- npm

## Getting Started

See [`docs/LOCAL_RUNBOOK.md`](docs/LOCAL_RUNBOOK.md) for full setup instructions including Supabase, environment variables, seed data, and Inngest dev server.

Quick start:

```bash
npm install
npx supabase start
# Copy .env.local.example to .env.local and fill in Supabase keys
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/
│   ├── (auth)/        # Login, signup, password reset, invite acceptance
│   ├── (builder)/     # Builder admin pages (homes, templates, projects, settings)
│   ├── (buyer)/       # Buyer portal pages (home dashboard, items, documents, assets)
│   └── api/           # API routes (auth, files, inngest)
├── components/        # Shared and domain-specific UI components
└── lib/
    ├── actions/       # Server actions (mutations)
    ├── queries/       # Data-fetching functions
    ├── supabase/      # Supabase client helpers
    └── inngest/       # Background job definitions
```

## Core MVP Flow

1. **Builder** signs up → starter template created automatically
2. **Builder** creates a home from a template → items and files cloned
3. **Builder** completes readiness checks → server enforces all checks pass before allowing "ready" status
4. **Builder** invites a buyer via email → magic-link invitation sent
5. **Buyer** accepts invite → account created and linked to home
6. **Buyer** logs in → routed to their assigned home (or multi-home chooser if multiple)
7. **Buyer** works through guided checklist → warranties, documents, utilities, inspections

## Documentation

- [`docs/LOCAL_RUNBOOK.md`](docs/LOCAL_RUNBOOK.md) — Local development setup
- [`docs/DEMO_WALKTHROUGH.md`](docs/DEMO_WALKTHROUGH.md) — End-to-end demo script
- [`docs/KNOWN_GAPS.md`](docs/KNOWN_GAPS.md) — Known limitations and planned fixes
- [`docs/MISSION_COMPLETE.md`](docs/MISSION_COMPLETE.md) — MVP mission closeout checklist
- [`docs/REGRESSION_CHECKLIST.md`](docs/REGRESSION_CHECKLIST.md) — Manual regression checklist
