# BuilderOS Regression Checklist

Regression test plan for auth, RLS, invitations, reminders, files, and buyer redirect. Run after any changes to these areas.

---

## 1. Authentication (Risk: HIGH)

### Login
- [ ] Builder login with valid credentials succeeds → redirects to /dashboard
- [ ] Buyer login with valid credentials succeeds → redirects to assigned home
- [ ] Login with wrong password shows error message (not silent failure)
- [ ] Login with non-existent email shows error message
- [ ] Session persists across page navigation (no unexpected logouts)
- [ ] Logging out clears session and redirects to /login

### Signup
- [ ] Builder signup creates auth user, profile, builder tenant, and owner membership
- [ ] Builder signup auto-creates starter template with 18 items
- [ ] Signup with duplicate email shows error
- [ ] Signup with missing required fields shows validation errors
- [ ] New builder can access dashboard immediately after signup

### Password Reset
- [ ] "Forgot password?" link on login page navigates to /reset-password
- [ ] Submitting email sends reset email (check Inbucket in local dev)
- [ ] Reset link in email works and allows setting new password
- [ ] After reset, login with new password succeeds

### Session & Role Routing
- [ ] Builder accessing /home/{id} is blocked or redirected
- [ ] Buyer accessing /dashboard is blocked or redirected
- [ ] Unauthenticated user accessing protected routes redirects to /login
- [ ] Session expiry forces re-authentication

---

## 2. Row-Level Security (Risk: HIGH)

### Builder Isolation
- [ ] Builder A cannot see Builder B's projects (query returns empty)
- [ ] Builder A cannot see Builder B's templates
- [ ] Builder A cannot see Builder B's homes
- [ ] Builder A cannot see Builder B's invitations
- [ ] Builder A cannot update Builder B's settings
- [ ] Builder A cannot delete Builder B's resources
- [ ] All queries filter by `builder_id` matching authenticated user's membership

### Buyer Access
- [ ] Buyer can only see homes where they have a `home_assignments` record
- [ ] Buyer cannot see homes assigned to other buyers
- [ ] Buyer cannot access builder admin pages (/dashboard, /templates, /projects, /settings)
- [ ] Buyer can view items for their assigned home
- [ ] Buyer can update status on items in their assigned home
- [ ] Buyer cannot modify items in homes they are not assigned to

### Cross-Tenant Data
- [ ] Activity log entries are scoped to builder_id
- [ ] File records are scoped to builder_id
- [ ] Home items cannot be queried across builders
- [ ] Supabase Studio confirms RLS policies are enabled on all tables

---

## 3. Invitations (Risk: HIGH)

### Send Invitation
- [ ] Builder can send invitation from home detail page
- [ ] Invitation record is created with status `pending`
- [ ] Activity log records `invitation_sent` event
- [ ] Email is sent (check Inbucket in local dev)
- [ ] Sending to same email twice shows appropriate feedback (resend vs duplicate)

### Accept Invitation
- [ ] Clicking magic link in email opens /accept-invite page
- [ ] Accept-invite page creates profile, membership (buyer role), and home_assignment
- [ ] Invitation status updates to `accepted`
- [ ] Activity log records `invitation_accepted` event
- [ ] Buyer can immediately access assigned home after accepting

### Resend Invitation
- [ ] "Resend" button on pending invitation sends new email
- [ ] Original invitation link is still valid (or properly invalidated)

### Expiry
- [ ] Invitation `expires_at` column exists (7-day window set on creation)
- [ ] Expired invitations cannot be accepted (enforced at magic-link generation and accept-invite)
- [ ] Resending an invitation resets the expiry window

### Edge Cases
- [ ] Inviting a user who already has an account works correctly
- [ ] Inviting a user who is already assigned to the home is handled
- [ ] Magic link from one invitation cannot be used for a different home

---

## 4. Reminders & Automation (Risk: MEDIUM)

### Inngest Functions
- [ ] Inngest dev server connects successfully at http://127.0.0.1:8288
- [ ] Three cron functions are registered: warranty reminders, activation nudge, builder escalation

### Warranty Reminders
- [ ] Cron triggers warranty-reminders function
- [ ] Function queries home_items where registration_deadline is approaching
- [ ] Email is sent via Resend (or error is logged clearly with fake key)
- [ ] Reminder is not sent for items already registered
- [ ] Dedup prevents sending same reminder multiple times

### Activation Nudge
- [ ] Nudge targets buyers who accepted invite but haven't completed any items
- [ ] Email contains link to buyer dashboard
- [ ] Nudge is not sent if buyer has already started completing items

### Builder Escalation
- [ ] Escalation targets builders with homes that have overdue critical items
- [ ] Email summarizes which homes/items are overdue

### Failure Handling
- [ ] Email send failure with invalid Resend key does not crash the function
- [ ] Error is logged with sufficient context for debugging
- [ ] Function continues processing remaining recipients after a single failure

---

## 5. Files & Storage (Risk: MEDIUM)

### Upload (Builder)
- [ ] Builder can upload file to a home item
- [ ] File is stored in Supabase Storage under `documents` bucket
- [ ] Storage path follows pattern: `{builder_id}/{home_id}/{item_id}/{timestamp}-{filename}`
- [ ] File record is created in `files` table with correct metadata
- [ ] Activity log records `file_uploaded` event
- [ ] Files > 25MB are rejected with clear error

### Upload (Buyer)
- [ ] Buyer can upload proof file on warranty items
- [ ] Uploaded proof is linked to the item via `proof_file_id`
- [ ] File appears in document vault

### Download / View
- [ ] Download button generates signed URL and initiates download
- [ ] View button opens viewable files (images, PDFs) in new tab
- [ ] Signed URLs expire after 1 hour (verify timeout)
- [ ] Non-viewable file types only show download (no view button)

### Access Control
- [ ] Builder can view/download files for their own homes
- [ ] Buyer can view/download files for their assigned homes
- [ ] Builder cannot access files from another builder's homes
- [ ] Buyer cannot access files from homes they are not assigned to
- [ ] Delete button is visible for builders, hidden for buyers

### Logo Upload
- [ ] Builder can upload logo in settings
- [ ] Logo preview appears after upload
- [ ] Logo URL is saved to `builders.logo_url`
- [ ] Logo appears on buyer-facing pages
- [ ] Files > 5MB are rejected
- [ ] Non-image files are rejected

---

## 6. Buyer Redirect & Navigation (Risk: HIGH)

### Root Page Routing
- [ ] Unauthenticated user at `/` sees login/signup options or is redirected to /login
- [ ] Builder at `/` is redirected to /dashboard
- [ ] Buyer with one home at `/` is redirected to `/home/{homeId}`
- [ ] Buyer with multiple homes at `/` sees a home picker
- [ ] Buyer with no homes at `/` sees appropriate message

### Buyer Navigation
- [ ] Buyer can navigate between home dashboard, items, and documents
- [ ] Multi-home dropdown appears when buyer has 2+ assigned homes
- [ ] Dropdown links navigate to correct home dashboards
- [ ] Back navigation works correctly within buyer experience

---

## Risk Summary

| Area | Risk | Key Concern |
|------|------|-------------|
| Auth | HIGH | Session handling, role routing, credential validation |
| RLS | HIGH | Cross-tenant data leakage, buyer/builder isolation |
| Invitations | HIGH | Magic link security, accept flow, duplicate handling |
| Reminders | MEDIUM | Silent failures, dedup, scheduling reliability |
| Files | MEDIUM | Access control, signed URL security, upload validation |
| Buyer Redirect | HIGH | First-run experience, role-based routing correctness |
