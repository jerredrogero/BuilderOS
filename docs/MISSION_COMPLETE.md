# BuilderOS MVP — Mission Complete Checklist

**Mission:** BuilderOS Final Closeout
**Date:** 2026-04-07
**Branch:** main

## MVP Flow

Builder creates home → passes enforced readiness gate → invites buyer → buyer signs in and lands directly in the correct home portal.

## Acceptance Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Buyers who sign in through the standard login page land correctly via `/` into their assigned home flow | Verified | `src/app/page.tsx` — role-aware redirect: builders → `/dashboard`, single-home buyers → `/home/{id}`, multi-home buyers → chooser page |
| 2 | Builders cannot mark a home ready unless readiness checks pass server-side | Verified | `src/lib/actions/homes.ts:179-224` — `updateHomeStatus` validates documents exist, warranty items have manufacturers, and utility items have providers before allowing `ready` status |
| 3 | Invite flow is tested end to end and works in real usage | Verified | Invitation creation, resend (resets expiry), expiry enforcement (7-day window), magic-link validation, and accept-invite page all functional |
| 4 | File cloning and file access are verified in the home workflow | Verified | Template files clone to new homes on creation; FileRow provides Download and View buttons; API route supports `?download=true` |
| 5 | Automated or manual regression coverage exists for routing and readiness | Verified | Regression test suites for post-login routing, readiness enforcement, and invitation flow; 60+ item manual regression checklist in `docs/REGRESSION_CHECKLIST.md` |
| 6 | Documentation matches reality | Verified | KNOWN_GAPS.md updated (16/22 gaps resolved), README.md reflects current product, this checklist created |

## What Works (MVP Features)

- Multi-tenant isolation (RLS + application-level checks)
- Builder signup with starter template auto-creation
- Full template CRUD with 5 item types and file upload
- Home creation with template cloning (items + files) and deadline computation
- Readiness checklist with enforced gate (server-side validation in `updateHomeStatus`)
- Invitation flow (send, resend with expiry reset, accept, expiry enforcement, magic-link validation)
- Buyer auto-redirect to assigned home after login via role-aware `/` route
- Buyer multi-home navigation (chooser page + dropdown)
- All 5 item type detail views with inline editing
- Warranty registration with proof upload
- File download and view across all buyer pages
- Delete confirmation dialogs
- Logo upload in builder settings
- Password reset flow
- Activity logging for all major actions
- Builder dashboard with status counts, overdue items, upcoming deadlines
- Inngest reminder engine (3 cron jobs) with error handling
- White-label branding (per-builder colors)
- Server-side Zod validation on critical server actions
- Home assets, inspection reports, punch list management

## Remaining Gaps (Out of Scope for MVP)

These are documented in `docs/KNOWN_GAPS.md` and are intentionally deferred:

1. **Email confirmation** (#3) — Supabase local dev auto-confirms; production should enable
2. **Drag-to-reorder** (#7) — Items have sort_order but no reorder UI
3. **Slug collision handling** (#19) — Random suffix makes collision extremely unlikely
4. **Template item limits** (#20) — No guard against excessive items
5. **Unstyled flash on buyer pages** (#21) — Brief flash possible on slow connections
6. **Advanced theming** (#22) — Only primary/accent colors; no custom fonts or layouts

## Key Technical Decisions

- **Login redirect to `/`:** Rather than redirecting to a role-specific URL from the login action, all authenticated users go to `/` which inspects memberships and home assignments to determine the correct destination. This keeps the login action simple and centralizes routing logic.
- **Server-side readiness enforcement:** The UI disables the "Mark Ready" button when checks fail, but the server action independently validates readiness. This prevents bypassing the gate via direct API calls.
- **Invitation expiry:** 7-day window set on creation. Resend resets the clock. Expiry checked at magic-link generation, invite acceptance, and activation nudge.
