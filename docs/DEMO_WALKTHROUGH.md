# BuilderOS Demo Walkthrough

Click-by-click demo path using seeded data. Follow the runbook first to get the app running locally.

## Demo Path A: Builder Experience

### 1. Login as Builder

- Go to http://localhost:3000/login
- Email: `builder@demo.com`
- Password: `demo1234`
- You land on the **Dashboard**

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

### 7. Projects

- Click "Projects" in nav → see "Oakwood Estates Phase 1" with 1 home
- Click into it → see project details with Austin, TX location

### 8. Settings

- Click "Settings" in nav → see branding config
- Change primary color → save → buyer pages will reflect the change

---

## Demo Path B: Buyer Experience

### 1. Login as Buyer

- Open an **incognito/private window** (or different browser)
- Go to http://localhost:3000/login
- Email: `buyer@demo.com`
- Password: `demo1234`
- You'll land on the root page (no redirect to buyer dashboard yet — navigate manually)

### 2. Buyer Dashboard

- Go to http://localhost:3000/home/f6666666-6666-6666-6666-666666666666
- See: **builder-branded page** with Oakwood Builders name and colors
- **Welcome message**: "Congratulations on your new home..."
- **Progress bar**: "0 of N critical items completed"
- **"What to do next"**: prioritized list — overdue items first, then soonest deadlines
- First item has a thicker border (most urgent)
- **Reference section**: non-critical items with no deadline (paint colors, fixture models)
- **Contact builder**: "Contact Oakwood Builders" with email/phone

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

## What to Verify During Demo

- [ ] Builder login works, dashboard shows data
- [ ] Home detail shows items grouped by category
- [ ] Readiness checklist shows 3 checks
- [ ] Item status changes persist (Done, N/A)
- [ ] Completion % recalculates correctly
- [ ] Buyer login works, buyer dashboard shows branded content
- [ ] Priority feed ranks overdue items first
- [ ] Warranty detail shows manufacturer, deadline, registration URL
- [ ] "Mark as Registered" updates status
- [ ] Proof upload form appears on warranty items
- [ ] Utility detail shows provider info and transfer instructions
- [ ] Info items show reference content (paint colors)
- [ ] Document upload works
- [ ] Activity log shows entries with timestamps
- [ ] Fresh signup creates starter template
- [ ] Home creation clones template items with correct deadlines
- [ ] Builder branding (colors) applies to buyer pages
