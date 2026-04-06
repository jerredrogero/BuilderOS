-- =============================================================================
-- BuilderOS Demo Seed Data
-- =============================================================================
-- Creates one builder account, one buyer account, a project, a home with
-- cloned template items, and an accepted invitation. Run via:
--   npx supabase db reset
-- =============================================================================

-- Fixed UUIDs for deterministic seeding
-- Builder auth user
SELECT extensions.uuid_generate_v4(); -- ensure extension loaded

DO $$
DECLARE
  v_builder_user_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_buyer_user_id   uuid := 'b2222222-2222-2222-2222-222222222222';
  v_builder_id      uuid := 'c3333333-3333-3333-3333-333333333333';
  v_project_id      uuid := 'd4444444-4444-4444-4444-444444444444';
  v_template_id     uuid := 'e5555555-5555-5555-5555-555555555555';
  v_home_id         uuid := 'f6666666-6666-6666-6666-666666666666';
  v_invitation_id   uuid := 'a7777777-7777-7777-7777-777777777777';
  v_close_date      date := CURRENT_DATE + INTERVAL '7 days';
  v_ti              record;
  v_item_id         uuid;
BEGIN

  -- =========================================================================
  -- 1. Create auth users (builder + buyer)
  -- =========================================================================
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, is_sso_user
  ) VALUES (
    v_builder_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'builder@demo.com',
    crypt('demo1234', gen_salt('bf')),
    now(),
    '{"full_name": "Mike Oakwood"}'::jsonb,
    now(), now(), '', '', false
  ), (
    v_buyer_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'buyer@demo.com',
    crypt('demo1234', gen_salt('bf')),
    now(),
    '{"full_name": "Sarah Chen"}'::jsonb,
    now(), now(), '', '', false
  );

  -- Identities (required for Supabase Auth to recognize password logins)
  INSERT INTO auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_builder_user_id, v_builder_user_id, v_builder_user_id::text, 'email',
    jsonb_build_object('sub', v_builder_user_id::text, 'email', 'builder@demo.com'),
    now(), now(), now()
  ), (
    v_buyer_user_id, v_buyer_user_id, v_buyer_user_id::text, 'email',
    jsonb_build_object('sub', v_buyer_user_id::text, 'email', 'buyer@demo.com'),
    now(), now(), now()
  );

  -- Profiles are auto-created by the trigger, but let's ensure they exist
  INSERT INTO profiles (id, email, full_name) VALUES
    (v_builder_user_id, 'builder@demo.com', 'Mike Oakwood'),
    (v_buyer_user_id, 'buyer@demo.com', 'Sarah Chen')
  ON CONFLICT (id) DO NOTHING;

  -- =========================================================================
  -- 2. Create builder tenant
  -- =========================================================================
  INSERT INTO builders (id, name, slug, primary_color, accent_color, contact_email, contact_phone, welcome_message)
  VALUES (
    v_builder_id,
    'Oakwood Builders',
    'oakwood-builders-demo',
    '#1e3a5f',
    '#e67e22',
    'builder@demo.com',
    '(555) 123-4567',
    'Congratulations on your new home! We''ve put together everything you need to get settled in. Start with the items marked "Critical" — these have deadlines you don''t want to miss.'
  );

  -- =========================================================================
  -- 3. Create memberships
  -- =========================================================================
  INSERT INTO memberships (user_id, builder_id, role) VALUES
    (v_builder_user_id, v_builder_id, 'owner'),
    (v_buyer_user_id, v_builder_id, 'buyer');

  -- =========================================================================
  -- 4. Create project
  -- =========================================================================
  INSERT INTO projects (id, builder_id, name, city, state, zip_code, subdivision)
  VALUES (
    v_project_id,
    v_builder_id,
    'Oakwood Estates Phase 1',
    'Austin',
    'TX',
    '78745',
    'Oakwood Estates'
  );

  -- =========================================================================
  -- 5. Create starter template
  -- =========================================================================
  INSERT INTO templates (id, builder_id, name, description, is_starter)
  VALUES (
    v_template_id,
    v_builder_id,
    'Standard Home Handoff',
    'Pre-loaded template for single-family home handoffs.',
    true
  );

  -- Template items
  INSERT INTO template_items (template_id, type, category, title, is_critical, due_date_offset, registration_deadline_offset, responsible_party, manufacturer, registration_url, utility_type, metadata, sort_order) VALUES
    -- HVAC
    (v_template_id, 'warranty', 'HVAC', 'HVAC System Warranty', true, NULL, 30, 'buyer', 'Carrier', 'https://www.carrier.com/residential/en/us/warranty-registration/', NULL, '{}', 0),
    (v_template_id, 'document', 'HVAC', 'HVAC Owner''s Manual', false, NULL, NULL, NULL, NULL, NULL, NULL, '{}', 1),
    -- Appliances
    (v_template_id, 'warranty', 'Appliances', 'Dishwasher Warranty', true, NULL, 30, 'buyer', 'Bosch', 'https://www.bosch-home.com/us/support/warranty', NULL, '{}', 0),
    (v_template_id, 'warranty', 'Appliances', 'Refrigerator Warranty', true, NULL, 30, 'buyer', 'Samsung', 'https://www.samsung.com/us/support/warranty/', NULL, '{}', 1),
    (v_template_id, 'warranty', 'Appliances', 'Range/Oven Warranty', true, NULL, 30, 'buyer', 'GE Appliances', 'https://www.geappliances.com/register', NULL, '{}', 2),
    -- Roofing
    (v_template_id, 'warranty', 'Roofing', 'Roof Warranty', true, NULL, 60, 'buyer', 'GAF', 'https://www.gaf.com/en-us/for-homeowners/warranty-registration', NULL, '{}', 0),
    -- Plumbing
    (v_template_id, 'warranty', 'Plumbing', 'Water Heater Warranty', true, NULL, 30, 'buyer', 'Rheem', 'https://www.rheem.com/warranty-registration/', NULL, '{}', 0),
    -- Utilities
    (v_template_id, 'utility', 'Utilities', 'Electric Service Transfer', true, 7, NULL, NULL, NULL, NULL, 'electric', '{"provider_name": "Austin Energy", "provider_phone": "(512) 494-9400", "provider_url": "https://austinenergy.com", "transfer_instructions": "Call Austin Energy to transfer service to your name. Have your closing date and new address ready. Allow 2-3 business days for processing."}', 0),
    (v_template_id, 'utility', 'Utilities', 'Gas Service Transfer', true, 7, NULL, NULL, NULL, NULL, 'gas', '{"provider_name": "Texas Gas Service", "provider_phone": "(800) 700-2443", "provider_url": "https://texasgasservice.com", "transfer_instructions": "Call Texas Gas Service to start service. You''ll need your new address and a valid ID. Same-day service is usually available."}', 1),
    (v_template_id, 'utility', 'Utilities', 'Water Service Transfer', true, 7, NULL, NULL, NULL, NULL, 'water', '{"provider_name": "Austin Water", "provider_phone": "(512) 972-0101", "provider_url": "https://www.austintexas.gov/department/austin-water", "transfer_instructions": "Visit Austin Water online or call to set up your account. Bring a copy of your closing documents."}', 2),
    (v_template_id, 'utility', 'Utilities', 'Internet Service Setup', false, 14, NULL, NULL, NULL, NULL, 'internet', '{"provider_name": "AT&T Fiber / Google Fiber", "provider_phone": "", "provider_url": "", "transfer_instructions": "Check availability at your address. AT&T and Google Fiber both serve Oakwood Estates. Schedule installation at least 1 week in advance."}', 3),
    -- Paint & Finishes
    (v_template_id, 'info', 'Paint & Finishes', 'Interior Paint Colors', false, NULL, NULL, NULL, NULL, NULL, NULL, '{"content": "Living Room / Main Areas: Sherwin-Williams SW 7015 Repose Gray\nBedrooms: Sherwin-Williams SW 7012 Creamy\nBathrooms: Sherwin-Williams SW 6119 Antique White\nTrim & Doors: Sherwin-Williams SW 7006 Extra White (semi-gloss)\nCeiling: Flat white"}', 0),
    -- Fixtures
    (v_template_id, 'info', 'Fixtures', 'Fixture & Appliance Model Numbers', false, NULL, NULL, NULL, NULL, NULL, NULL, '{"content": "Kitchen Faucet: Moen Arbor 7594SRS\nBathroom Faucets: Delta Foundations B2515LF\nToilets: TOTO Drake CST744S\nGarage Door Opener: Chamberlain B6753T\nDoorbell: Ring Video Doorbell Pro 2"}', 0),
    -- Move-In Checklist
    (v_template_id, 'checklist', 'Move-In', 'Test smoke and CO detectors', true, 3, NULL, NULL, NULL, NULL, NULL, '{}', 0),
    (v_template_id, 'checklist', 'Move-In', 'Locate water shut-off valve', true, 3, NULL, NULL, NULL, NULL, NULL, '{}', 1),
    (v_template_id, 'checklist', 'Move-In', 'Locate electrical panel', true, 3, NULL, NULL, NULL, NULL, NULL, '{}', 2),
    -- Documents
    (v_template_id, 'document', 'Closing', 'Closing Documents', false, NULL, NULL, NULL, NULL, NULL, NULL, '{}', 0),
    (v_template_id, 'document', 'Home', 'Home Maintenance Guide', false, NULL, NULL, NULL, NULL, NULL, NULL, '{}', 0);

  -- =========================================================================
  -- 6. Create home (cloned from template)
  -- =========================================================================
  INSERT INTO homes (id, builder_id, project_id, template_id, address, lot_number, close_date, handoff_status, completion_pct)
  VALUES (
    v_home_id,
    v_builder_id,
    v_project_id,
    v_template_id,
    '4821 Oakwood Trail, Austin, TX 78745',
    '12',
    v_close_date,
    'activated',
    0
  );

  -- Clone template items into home items
  FOR v_ti IN
    SELECT * FROM template_items WHERE template_id = v_template_id ORDER BY sort_order
  LOOP
    v_item_id := gen_random_uuid();

    INSERT INTO home_items (
      id, home_id, builder_id, type, category, title, description,
      sort_order, status, source, template_item_id, due_date,
      is_critical, registration_status, registration_deadline,
      responsible_party, manufacturer, registration_url,
      utility_type, metadata
    ) VALUES (
      v_item_id,
      v_home_id,
      v_builder_id,
      v_ti.type,
      v_ti.category,
      v_ti.title,
      v_ti.description,
      v_ti.sort_order,
      'pending',
      'template',
      v_ti.id,
      CASE WHEN v_ti.due_date_offset IS NOT NULL THEN v_close_date + v_ti.due_date_offset ELSE NULL END,
      v_ti.is_critical,
      CASE WHEN v_ti.type = 'warranty' THEN 'not_started' ELSE NULL END,
      CASE WHEN v_ti.registration_deadline_offset IS NOT NULL THEN v_close_date + v_ti.registration_deadline_offset ELSE NULL END,
      v_ti.responsible_party,
      v_ti.manufacturer,
      v_ti.registration_url,
      v_ti.utility_type,
      v_ti.metadata
    );
  END LOOP;

  -- =========================================================================
  -- 7. Create invitation (already accepted)
  -- =========================================================================
  INSERT INTO invitations (id, home_id, builder_id, email, role, status, sent_at, accepted_at)
  VALUES (
    v_invitation_id,
    v_home_id,
    v_builder_id,
    'buyer@demo.com',
    'primary_buyer',
    'accepted',
    now() - INTERVAL '2 days',
    now() - INTERVAL '1 day'
  );

  -- =========================================================================
  -- 8. Create home assignment
  -- =========================================================================
  INSERT INTO home_assignments (home_id, user_id, role)
  VALUES (v_home_id, v_buyer_user_id, 'primary_buyer');

  -- =========================================================================
  -- 9. Seed activity log
  -- =========================================================================
  INSERT INTO activity_log (builder_id, home_id, actor_type, actor_id, action, metadata, created_at) VALUES
    (v_builder_id, v_home_id, 'user', v_builder_user_id, 'home_created', '{"template_id": "' || v_template_id || '"}', now() - INTERVAL '3 days'),
    (v_builder_id, v_home_id, 'user', v_builder_user_id, 'status_changed', '{"new_status": "ready"}', now() - INTERVAL '3 days'),
    (v_builder_id, v_home_id, 'user', v_builder_user_id, 'invitation_sent', '{"email": "buyer@demo.com"}', now() - INTERVAL '2 days'),
    (v_builder_id, v_home_id, 'user', v_buyer_user_id, 'invitation_accepted', '{}', now() - INTERVAL '1 day');

END;
$$;
