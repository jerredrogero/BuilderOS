# Known Gaps & Issues — Phase 1

## Bugs Fixed (pre-demo)

- [x] Activity log inserts used `event_type` instead of `action` — fixed in 4 files
- [x] Inngest warranty-reminders queried non-existent `buyer_email` field — fixed
- [x] Inngest activation-nudge used `buyer_email` instead of `email` — fixed
- [x] Buyer item detail read utility fields from top-level instead of `metadata` — fixed

## Known Gaps (not bugs, by design for v1)

### Auth & Accounts

1. **No error display on forms** — signup/login actions throw errors but there's no UI to show them to the user. Actions use `throw new Error()` because Next.js 16 server actions must return void. Fix: convert to `useActionState` for error display.

2. **No password reset flow** — buyers who forget their password have no self-service recovery. Supabase Auth supports it but no UI exists.

3. **No email confirmation** — builder signup doesn't require email verification. Supabase local dev auto-confirms. Production should enable email confirmation.

4. **Buyer login doesn't redirect to their home** — after logging in, buyers land on the root page. They need to know their home URL. Fix: after login, check if user has a buyer membership, find their home_assignment, and redirect to `/home/{homeId}`.

### Builder Admin

5. **Readiness gate is advisory only** — the "Mark Ready" button is always visible even when the checklist isn't complete. It should be disabled when checks fail.

6. **No inline editing of home items** — builder can mark items Done/N/A and delete them, but can't edit title, description, or warranty details from the home detail page. The edit form exists in the template editor but not on home items.

7. **No drag-to-reorder** — items have sort_order but there's no UI to reorder them.

8. **Logo upload not implemented** — builder settings has `logo_url` field but no file upload UI for the logo. Builder would need to manually enter a URL.

9. **No template-level file upload** — the file upload UI exists on home items but not on template items. When cloning, template-level files would be cloned, but there's no way to upload them in the template editor yet.

10. **Delete confirmations missing** — deleting a project, template, or home item has no confirmation dialog.

### Buyer Experience

11. **No "back to my homes" navigation** — if a buyer has multiple homes (co_buyer on another), there's no way to switch between them.

12. **File download not wired** — files display filename and size but there's no download button using signed URLs. The `getFileUrl()` function exists but isn't called in the UI.

13. **Proof upload on warranty page needs verification** — the upload action exists but the form may need testing with actual Supabase Storage to confirm the flow works end-to-end.

### Invitation Flow

14. **Magic link flow untested** — the `/api/auth/magic-link` route calls `supabase.auth.admin.generateLink` which sends an email. In local dev, check Inbucket for the email. The redirect back to accept-invite after clicking the link needs end-to-end testing.

15. **No invitation expiry** — invitations have an `expired` status but nothing sets them to expired. Could add a cleanup job in Phase 2.

### Reminder Engine

16. **Untested with real Resend** — Inngest functions send emails via Resend. These work with a valid API key but haven't been tested in local dev with the fake key. The functions will error silently on email send failures.

17. **Reminder dedup for activation nudge uses recipient_id** — but the buyer may not have a profile yet (they haven't accepted the invite). The code works around this but the approach is fragile.

### Data & Schema

18. **No data validation on server actions** — form inputs aren't validated beyond basic HTML `required` attributes. No server-side validation library (like Zod) is used.

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

1. **Buyer login redirect** (#4) — highest impact, easiest fix
2. **Error display on forms** (#1) — important for signup/login UX
3. **File download buttons** (#12) — needed for document vault to be useful
4. **Readiness gate enforcement** (#5) — prevents bad handoffs
5. **Delete confirmations** (#10) — prevents accidental data loss
