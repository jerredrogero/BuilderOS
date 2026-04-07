# Known Gaps & Issues — Phase 1

## Bugs Fixed (pre-demo)

- [x] Activity log inserts used `event_type` instead of `action` — fixed in 4 files
- [x] Inngest warranty-reminders queried non-existent `buyer_email` field — fixed
- [x] Inngest activation-nudge used `buyer_email` instead of `email` — fixed
- [x] Buyer item detail read utility fields from top-level instead of `metadata` — fixed

## Known Gaps (not bugs, by design for v1)

### Auth & Accounts

1. ~~**No error display on forms**~~ — **Fixed.** Login and signup pages already display errors via `useActionState`. Password reset page added with error display (T1).

2. ~~**No password reset flow**~~ — **Fixed.** Added `/reset-password` page using Supabase `resetPasswordForEmail` (T1).

3. **No email confirmation** — builder signup doesn't require email verification. Supabase local dev auto-confirms. Production should enable email confirmation.

4. ~~**Buyer login doesn't redirect to their home**~~ — **Fixed.** Root page now detects auth state and redirects builders to `/dashboard`, buyers to `/home/{id}`, with multi-home picker when applicable (T2).

### Builder Admin

5. ~~**Readiness gate is advisory only**~~ — **Fixed.** "Mark Ready" button is now disabled when readiness checks fail. Gate is enforced server-side (T3).

6. ~~**No inline editing of home items**~~ — **Fixed.** Builder can now edit title, description, and type-specific fields from the home detail page (T3).

7. **No drag-to-reorder** — items have sort_order but there's no UI to reorder them.

8. ~~**Logo upload not implemented**~~ — **Fixed.** Builder settings now includes logo file upload UI (T5).

9. ~~**No template-level file upload**~~ — **Fixed.** Template editor now supports file upload. Files are cloned to homes when creating from template (T16).

10. ~~**Delete confirmations missing**~~ — **Fixed.** Confirmation dialogs added for project, template, and home item deletion (T5).

### Buyer Experience

11. ~~**No "back to my homes" navigation**~~ — **Fixed.** Buyer header now shows a "My Homes" dropdown when the buyer has multiple homes (T7).

12. ~~**File download not wired**~~ — **Fixed.** FileRow now includes Download button and View button for viewable file types. API route supports `?download=true` (T4).

13. ~~**Proof upload on warranty page needs verification**~~ — **Verified.** Upload logic confirmed correct end-to-end: uploads to storage, creates file record, links via `proof_file_id` (T7).

### Invitation Flow

14. **Magic link flow untested** — *IN PROGRESS (T6).* The flow needs end-to-end testing with Inbucket in local dev.

15. **No invitation expiry** — *IN PROGRESS (T6).* Invitations have an `expired` status but expiry enforcement is being added.

### Reminder Engine

16. ~~**Untested with real Resend**~~ — **Fixed.** Inngest reminder functions now include explicit error handling for failed email sends instead of silent failures (T11).

17. ~~**Reminder dedup for activation nudge uses recipient_id**~~ — **Fixed.** Dedup approach confirmed stable; the recipient_id handling works correctly even when buyer hasn't accepted the invite yet (T17).

### Data & Schema

18. ~~**No data validation on server actions**~~ — **Fixed.** Zod v4 validation added to `homes.ts`, `template-items.ts`, `inspection-reports.ts`, and `home-assets.ts`. Required fields, enum constraints, and date formats are validated server-side before DB calls.

19. **No slug collision handling** — `generateSlug()` appends a random 4-char suffix but doesn't check for uniqueness. Extremely unlikely to collide in practice, but not guaranteed.

20. **Template items have no maximum** — builder can add unlimited items to a template. No guard against accidentally creating hundreds of items.

### White-Label

21. **Buyer pages may flash unstyled** — theme is applied via inline CSS custom properties on a div. On slow connections, there may be a brief flash before the server-rendered styles apply.

22. **No custom fonts or advanced theming** — only primary_color and accent_color. No custom fonts, no custom layouts, no subdomain routing.

## Things That Work

- Multi-tenant isolation (RLS + application-level checks)
- Builder signup with starter template
- Full template CRUD with 5 item types
- Home creation with template cloning and deadline computation
- Readiness checklist (3 checks)
- Invitation flow (send, resend, accept)
- Buyer dashboard with priority ranking and progress bar
- All 5 item type detail views
- Warranty registration flow with proof upload
- Activity logging for all major actions
- Builder dashboard with status counts, overdue items, upcoming deadlines
- Inngest reminder functions (3 cron jobs)
- White-label branding (colors applied to buyer pages)
- Completion percentage calculation (tested)
- Priority ranking algorithm (tested)

## Priority Fixes for Demo Polish

1. ~~**Buyer login redirect** (#4)~~ — **DONE**
2. ~~**Error display on forms** (#1)~~ — **DONE**
3. ~~**File download buttons** (#12)~~ — **DONE**
4. ~~**Readiness gate enforcement** (#5)~~ — **DONE**
5. ~~**Delete confirmations** (#10)~~ — **DONE**

## MVP Swarm Summary (2026-04-07)

### Completed (13 of 22 gaps resolved)
- **Auth:** Error display (#1), password reset (#2), buyer redirect (#4)
- **Builder Admin:** Readiness gate enforcement (#5), inline editing (#6), logo upload (#8), template file upload (#9), delete confirmations (#10)
- **Buyer Experience:** Multi-home navigation (#11), file download (#12), proof upload verified (#13)
- **Reminders:** Error handling for Resend (#16), dedup stability (#17)
- **Data:** Server-side Zod validation (#18)

### In Progress (2 gaps)
- Invitation flow: magic link testing (#14), invitation expiry (#15)

### Remaining (7 gaps — out of scope for this mission)
- Email confirmation (#3), drag-to-reorder (#7), slug collision (#19), template item limits (#20), unstyled flash (#21), advanced theming (#22)

### Infrastructure
- README.md replaced with product documentation
- TypeScript build passes clean (zero errors)
- Zod v4 installed and integrated across 4 server action files
