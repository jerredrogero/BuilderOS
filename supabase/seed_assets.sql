-- Seed demo assets and link existing warranty items to them
DO $$
DECLARE
  v_home_id uuid := 'f6666666-6666-6666-6666-666666666666';
  v_builder_id uuid := 'c3333333-3333-3333-3333-333333333333';
  v_hvac_asset_id uuid;
  v_dishwasher_asset_id uuid;
  v_fridge_asset_id uuid;
  v_roof_asset_id uuid;
  v_water_heater_asset_id uuid;
BEGIN
  INSERT INTO home_assets (home_id, builder_id, category, name, manufacturer, model_number, serial_number, location)
  VALUES (v_home_id, v_builder_id, 'HVAC', 'Carrier HVAC System', 'Carrier', '24ACC636A003', NULL, 'Attic')
  RETURNING id INTO v_hvac_asset_id;

  INSERT INTO home_assets (home_id, builder_id, category, name, manufacturer, model_number, location)
  VALUES (v_home_id, v_builder_id, 'Appliances', 'Bosch Dishwasher', 'Bosch', 'SHPM88Z75N', 'Kitchen')
  RETURNING id INTO v_dishwasher_asset_id;

  INSERT INTO home_assets (home_id, builder_id, category, name, manufacturer, model_number, location)
  VALUES (v_home_id, v_builder_id, 'Appliances', 'Samsung Refrigerator', 'Samsung', 'RF28R7351SR', 'Kitchen')
  RETURNING id INTO v_fridge_asset_id;

  INSERT INTO home_assets (home_id, builder_id, category, name, manufacturer, location)
  VALUES (v_home_id, v_builder_id, 'Roofing', 'GAF Roof System', 'GAF', 'Roof')
  RETURNING id INTO v_roof_asset_id;

  INSERT INTO home_assets (home_id, builder_id, category, name, manufacturer, model_number, location)
  VALUES (v_home_id, v_builder_id, 'Plumbing', 'Rheem Water Heater', 'Rheem', 'PROG50-38N RH62', 'Garage')
  RETURNING id INTO v_water_heater_asset_id;

  -- Link warranty items to assets
  UPDATE home_items SET home_asset_id = v_hvac_asset_id
  WHERE home_id = v_home_id AND title = 'HVAC System Warranty';

  UPDATE home_items SET home_asset_id = v_dishwasher_asset_id
  WHERE home_id = v_home_id AND title = 'Dishwasher Warranty';

  UPDATE home_items SET home_asset_id = v_fridge_asset_id
  WHERE home_id = v_home_id AND title = 'Refrigerator Warranty';

  UPDATE home_items SET home_asset_id = v_roof_asset_id
  WHERE home_id = v_home_id AND title = 'Roof Warranty';

  UPDATE home_items SET home_asset_id = v_water_heater_asset_id
  WHERE home_id = v_home_id AND title = 'Water Heater Warranty';

  -- Link HVAC manual to HVAC asset
  UPDATE home_items SET home_asset_id = v_hvac_asset_id
  WHERE home_id = v_home_id AND title LIKE 'HVAC Owner%';
END;
$$;
