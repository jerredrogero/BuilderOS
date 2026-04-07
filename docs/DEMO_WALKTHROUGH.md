# BuilderOS Demo Walkthrough

Click-by-click demo path using seeded data. Follow the runbook first to get the app running locally.

## Demo Path A: Builder Experience

### 1. Login as Builder

- Go to http://localhost:3000/login
- Email: `builder@demo.com`
- Password: `demo1234`
- You land on the **Dashboard**
- Note: "Forgot password?" link is available on the login page for password recovery

### 2. Dashboard Overview

- **Status cards**: Should show 1 home in "activated" status
- **Action Needed**: May show overdue items if close date has passed
- **Homes list**: Shows "Lot 12 — 4821 Oakwood Trail" with 0% completion

### 3. View the Home

- Click the home row → lands on **Home Detail**
- See: address, project name ("Oakwood Estates Phase 1"), close date, 0% completion, "activated" status
- **Items by category**: 18 items grouped into HVAC, Appliances, Roofing, Plumbing, Utilities, Paint & Finishes, Fixtures, Move-In, Closing, Home
- Each warranty item shows "not_started" status
- Each utility item shows "pending"

### 4. Mark Items (Builder Side)

- Click "Done" on any item → status changes to "complete"
- Click "N/A" on any item → status changes to "not_applicable"
- Watch completion % update (only critical items count)

### 5. Activity Log

- Click "Activity Log" button → see chronological entries:
  - home_created, status_changed, invitation_sent, invitation_accepted

### 6. Template Editor

- Click "Templates" in nav → see "Standard Home Handoff"
- Click into it → see all 18 items grouped by category
- Click "Add Item" → form shows type selector with conditional fields
- Warranty type shows: manufacturer, registration URL, deadline offset, responsible party
- Utility type shows: utility type, provider name, phone, URL, transfer instructions
- **Delete template**: click "Delete Template" → confirmation dialog appears → confirm to delete
- **Remove items**: click "Remove" on any item → confirmation dialog appears → confirm to remove

### 7. Projects

- Click "Projects" in nav → see "Oakwood Estates Phase 1" with 1 home
- Click into it → see project details with Austin, TX location
- **Delete project**: click "Delete Project" → confirmation dialog appears → confirm to delete

### 8. Settings

- Click "Settings" in nav → see branding config
- **Logo upload**: upload a company logo image → preview appears → logo shows on buyer pages
- Change primary color → save → buyer pages will reflect the change

---

## Demo Path B: Buyer Experience

### 1. Login as Buyer

- Open an **incognito/private window** (or different browser)
- Go to http://localhost:3000/login
- Email: `buyer@demo.com`
- Password: `demo1234`
- You are **automatically redirected** to your assigned home dashboard

### 2. Buyer Dashboard

- See: **builder-branded page** with Oakwood Builders name and colors
- **Welcome message**: "Congratulations on your new home..."
- **Progress bar**: "0 of N critical items completed"
- **"What to do next"**: prioritized list — overdue items first, then soonest deadlines
- First item has a thicker border (most urgent)
- **Reference section**: non-critical items with no deadline (paint colors, fixture models)
- **Contact builder**: "Contact Oakwood Builders" with email/phone
- **Multi-home navigation**: if buyer has multiple homes, a "My Homes" dropdown appears in the header

### 3. Complete a Warranty Registration

- Click any warranty item (e.g., "HVAC System Warranty")
- See: **Warranty Details** card with manufacturer (Carrier), registration deadline, countdown
- Click **"Register Now"** → opens manufacturer website in new tab
- Return to the page → click **"Mark as Registered"**
- (Optional) Upload proof via the **proof upload form** below
- Status changes to "Registered", item resolves
- Navigate back → progress bar updates

### 4. Complete a Utility Transfer

- Click a utility item (e.g., "Electric Service Transfer")
- See: **Transfer Details** card with Austin Energy, phone number (clickable), website link
- See: **Transfer instructions** specific to Austin Energy
- Click **"Mark as Transferred"** when done

### 5. Complete a Checklist Item

- Click a checklist item (e.g., "Test smoke and CO detectors")
- Click **"Mark Complete"**

### 6. View Info Items

- Click an info item (e.g., "Interior Paint Colors")
- See: read-only content with paint colors by room
- No action needed — reference only

### 7. Document Vault

- Click "Documents" in the header
- See: upload form + list of any uploaded documents
- Upload a test file → it appears in the list
- **Download**: click the download button on any file to download via signed URL
- **View**: viewable file types (images, PDFs) have a View button that opens in a new tab

### 8. Completion State

- Complete all critical items (warranties, utilities, checklist items)
- Progress bar reaches 100%
- Home handoff_status auto-updates to "completed"

---

## Demo Path C: Fresh Builder Signup

### 1. Sign Up

- Go to http://localhost:3000/signup
- Enter: name, company name, email, password
- Submit → redirected to Dashboard

### 2. First Value Moment

- Click "Templates" → see "Standard Home Handoff" starter template already exists
- This was auto-created during signup with 18 pre-loaded items
- Builder can customize immediately without starting from scratch

### 3. Create a Home

- Click "Homes" → "New Home"
- Select "Standard Home Handoff" template
- Optionally create a project first
- Enter address, lot number, close date
- Submit → lands on home detail with cloned items and computed deadlines

---

## Seed Data Reference

The seed SQL (`supabase/seed.sql`) creates the following deterministic data:

| Entity | Details |
|--------|---------|
| Builder user | `builder@demo.com` / `demo1234` (Mike Oakwood) |
| Buyer user | `buyer@demo.com` / `demo1234` (Sarah Chen) |
| Builder tenant | Oakwood Builders (slug: `oakwood-builders-demo`) |
| Project | Oakwood Estates Phase 1 (Austin, TX 78745) |
| Template | Standard Home Handoff (18 items, `is_starter: true`) |
| Home | 4821 Oakwood Trail, Lot 12 (status: `activated`, close: 7 days from seed) |
| Invitation | `buyer@demo.com` → accepted |
| Home assignment | Sarah Chen → primary_buyer on the home |
| Activity log | 4 entries (home_created, status_changed, invitation_sent, invitation_accepted) |

All UUIDs are fixed (e.g., home = `f6666666-6666-6666-6666-666666666666`) for deterministic testing.

---

## Verification Checklist

### Auth & Accounts
- [ ] Builder login works with `builder@demo.com` / `demo1234`
- [ ] Buyer login works with `buyer@demo.com` / `demo1234`
- [ ] "Forgot password?" link on login page opens reset password page
- [ ] Password reset form submits without error (check Inbucket for email)
- [ ] Fresh signup creates account and redirects to dashboard
- [ ] Fresh signup auto-creates starter template with 18 items

### Builder Dashboard
- [ ] Dashboard shows status cards with home counts
- [ ] Dashboard shows the seeded home "Lot 12 — 4821 Oakwood Trail"
- [ ] Clicking home row navigates to home detail

### Home Detail (Builder)
- [ ] Home detail shows address, project, close date, status, completion %
- [ ] Items are grouped by category (HVAC, Appliances, etc.)
- [ ] "Done" button updates item status to complete
- [ ] "N/A" button updates item status to not_applicable
- [ ] Completion % recalculates after status changes
- [ ] Readiness checklist shows 3 checks
- [ ] Activity log button shows chronological entries

### Templates
- [ ] Templates page lists "Standard Home Handoff"
- [ ] Template detail shows items grouped by category
- [ ] "Add Item" dialog opens with type-specific fields
- [ ] "Delete Template" shows confirmation dialog before deleting
- [ ] "Remove" on template item shows confirmation dialog before removing

### Projects
- [ ] Projects page lists "Oakwood Estates Phase 1" with 1 home
- [ ] Project detail shows Austin, TX location data
- [ ] "Delete Project" shows confirmation dialog before deleting

### Settings (Builder)
- [ ] Settings page shows company info form
- [ ] Logo upload section visible with file picker
- [ ] Uploading an image shows a preview
- [ ] Color pickers work for primary and accent colors
- [ ] Save persists changes

### Buyer Redirect
- [ ] Buyer login redirects automatically to assigned home (no manual URL needed)
- [ ] Builder login redirects to /dashboard

### Buyer Dashboard
- [ ] Branded page shows Oakwood Builders name and colors
- [ ] Welcome message displays
- [ ] Progress bar shows "0 of N critical items completed"
- [ ] Priority feed ranks overdue items first, then soonest deadlines
- [ ] Reference section shows non-critical info items

### Buyer Item Completion
- [ ] Warranty detail shows manufacturer, deadline, registration URL
- [ ] "Register Now" opens manufacturer site in new tab
- [ ] "Mark as Registered" updates status
- [ ] Proof upload form appears on warranty items
- [ ] Utility detail shows provider info and transfer instructions
- [ ] "Mark as Transferred" updates utility status
- [ ] Checklist "Mark Complete" updates status
- [ ] Info items show reference content (paint colors, fixtures)

### Document Vault (Buyer)
- [ ] Documents page shows upload form
- [ ] File upload works and file appears in list
- [ ] Download button downloads file via signed URL
- [ ] View button opens viewable files in new tab
- [ ] Delete button is hidden for buyers

### Multi-Home Navigation
- [ ] If buyer has multiple homes, "My Homes" dropdown appears in header
- [ ] Dropdown links navigate to correct home dashboards

### Completion Flow
- [ ] Completing all critical items brings progress to 100%
- [ ] Home status auto-transitions to "completed"

### Server-Side Validation
- [ ] Creating a home with missing required fields shows error
- [ ] Creating template items validates type and required fields
- [ ] Inspection report creation validates required fields
- [ ] Asset creation validates required fields
