# BuilderOS Local Runbook

## Prerequisites

- Node.js 20+ (check: `node -v`)
- Docker Desktop running (required for local Supabase)
- npm (comes with Node.js)

## 1. Start Local Supabase

```bash
cd /Users/jerred/Desktop/Code/BuilderOS
npx supabase start
```

This takes 1-2 minutes on first run (pulls Docker images). When done, it prints:

```
API URL: http://127.0.0.1:54321
anon key: eyJ...
service_role key: eyJ...
Studio URL: http://127.0.0.1:54323
Inbucket URL: http://127.0.0.1:54324
```

**Save these values** — you need them for `.env.local`.

## 2. Create .env.local

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with the values from `supabase start`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from above>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from above>
RESEND_API_KEY=re_test_fake_key_for_local
INNGEST_EVENT_KEY=local-dev-key
INNGEST_SIGNING_KEY=local-dev-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Note:** Email sending will fail with a fake Resend key, but that's fine — Supabase local catches auth emails in Inbucket at http://127.0.0.1:54324.

## 3. Apply Schema Migration

```bash
npx supabase db reset
```

This applies `supabase/migrations/001_initial_schema.sql` and creates all tables, indexes, RLS policies, and the storage bucket.

## 4. Seed Demo Data

```bash
npx supabase db reset --seed
```

Or if schema is already applied, run the seed separately:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/seed.sql
```

This creates:
- **Builder account:** Oakwood Builders (email: `builder@demo.com`, password: `demo1234`)
- **Buyer account:** (email: `buyer@demo.com`, password: `demo1234`)
- One project: "Oakwood Estates Phase 1"
- One home with cloned template items and computed deadlines
- An accepted invitation linking the buyer to the home

## 5. Start the App

```bash
npm run dev
```

App runs at http://localhost:3000.

## 6. Start Inngest Dev Server (optional)

In a separate terminal:

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

This connects to the Inngest functions and lets you trigger them manually from the Inngest dev UI at http://127.0.0.1:8288.

## Key URLs

| What | URL |
|---|---|
| App | http://localhost:3000 |
| Supabase Studio | http://127.0.0.1:54323 |
| Inbucket (email) | http://127.0.0.1:54324 |
| Inngest Dev | http://127.0.0.1:8288 |

## Test Accounts

| Role | Email | Password |
|---|---|---|
| Builder (owner) | builder@demo.com | demo1234 |
| Buyer | buyer@demo.com | demo1234 |

## Stopping

```bash
npx supabase stop     # Stop local Supabase
# Ctrl+C to stop Next.js dev server
```

## Troubleshooting

**"relation does not exist"** — Run `npx supabase db reset` to re-apply migrations.

**Docker not running** — Start Docker Desktop before `supabase start`.

**Port conflicts** — Check if ports 54321-54324 or 3000 are in use. Kill conflicting processes or change ports in `supabase/config.toml`.

**Auth emails not arriving** — Check Inbucket at http://127.0.0.1:54324. All auth emails (magic links, confirmations) go there in local dev.

**RLS blocking queries** — Check Supabase Studio > Authentication to verify users exist. Check memberships table to verify role assignments.
