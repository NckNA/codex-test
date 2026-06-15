-- Migration: Add transactional RPC for saving treatment plan and synchronizing its stages
-- Filename: 0006_treatment_plan_stage_sync_rpc.sql

CREATE OR REPLACE FUNCTION save_treatment_plan_with_stages(
  p_tenant_id uuid,
  p_patient_id uuid,
  p_plan_id uuid,
  p_title text,
  p_status text,
  p_total_price numeric,
  p_stages jsonb
) RETURNS uuid AS $$
DECLARE
  stage_item jsonb;
  stage_id uuid;
  stage_title text;
  stage_teeth integer[];
  stage_description text;
  stage_price numeric;
  stage_status text;
  stage_finding_ids uuid[];
  stage_source text;
  stage_order_index integer;
  submitted_stage_ids uuid[] := '{}';
BEGIN
  -- 1. Validate plan ownership if plan exists
  IF EXISTS (
    SELECT 1 FROM treatment_plans 
    WHERE id = p_plan_id AND (tenant_id <> p_tenant_id OR patient_id <> p_patient_id)
  ) THEN
    RAISE EXCEPTION 'Invalid plan/tenant/patient ownership';
  END IF;

  -- 2. Insert or update the plan
  INSERT INTO treatment_plans (id, tenant_id, patient_id, title, status, total_price, updated_at)
  VALUES (p_plan_id, p_tenant_id, p_patient_id, p_title, p_status, p_total_price, now())
  ON CONFLICT (id) DO UPDATE 
  SET title = EXCLUDED.title,
      status = EXCLUDED.status,
      total_price = EXCLUDED.total_price,
      updated_at = now();

  -- 3. Process each stage in the JSON payload
  IF p_stages IS NOT NULL AND jsonb_typeof(p_stages) = 'array' THEN
    FOR stage_order_index IN 0 .. jsonb_array_length(p_stages) - 1 LOOP
      stage_item := p_stages -> stage_order_index;
      
      -- Extract fields from JSON
      stage_id := (stage_item ->> 'id')::uuid;
      stage_title := stage_item ->> 'title';
      stage_description := stage_item ->> 'description';
      stage_price := COALESCE((stage_item ->> 'price')::numeric, 0);
      stage_status := COALESCE(stage_item ->> 'status', 'planned');
      stage_source := stage_item ->> 'source';
      
      -- Convert teeth (which is a JSON array of ints) to integer[]
      IF stage_item -> 'teeth' IS NOT NULL AND jsonb_typeof(stage_item -> 'teeth') = 'array' THEN
        SELECT COALESCE(array_agg(val::integer), '{}'::integer[]) INTO stage_teeth
        FROM jsonb_array_elements_text(stage_item -> 'teeth') AS val;
      ELSE
        stage_teeth := '{}'::integer[];
      END IF;

      -- Convert findingIds (which is a JSON array of uuids) to uuid[]
      IF stage_item -> 'findingIds' IS NOT NULL AND jsonb_typeof(stage_item -> 'findingIds') = 'array' THEN
        SELECT array_agg(val::uuid) INTO stage_finding_ids
        FROM jsonb_array_elements_text(stage_item -> 'findingIds') AS val;
      ELSE
        stage_finding_ids := NULL;
      END IF;

      -- Keep track of submitted stage IDs to delete the missing ones later
      submitted_stage_ids := array_append(submitted_stage_ids, stage_id);

      -- Validate stage ownership if stage exists
      IF EXISTS (
        SELECT 1 FROM treatment_stages 
        WHERE id = stage_id AND (tenant_id <> p_tenant_id OR treatment_plan_id <> p_plan_id)
      ) THEN
        RAISE EXCEPTION 'Invalid stage ownership';
      END IF;

      -- Insert or update stage
      INSERT INTO treatment_stages (
        id, tenant_id, treatment_plan_id, title, teeth, description, price, status, finding_ids, source, order_index, updated_at
      ) VALUES (
        stage_id, p_tenant_id, p_plan_id, stage_title, stage_teeth, stage_description, stage_price, stage_status, stage_finding_ids, stage_source, stage_order_index, now()
      ) ON CONFLICT (id) DO UPDATE
      SET title = EXCLUDED.title,
          teeth = EXCLUDED.teeth,
          description = EXCLUDED.description,
          price = EXCLUDED.price,
          status = EXCLUDED.status,
          finding_ids = EXCLUDED.finding_ids,
          source = EXCLUDED.source,
          order_index = EXCLUDED.order_index,
          updated_at = now();
    END LOOP;
  END IF;

  -- 4. Delete any stages belonging to this plan that are NOT in the submitted payload
  DELETE FROM treatment_stages
  WHERE tenant_id = p_tenant_id 
    AND treatment_plan_id = p_plan_id 
    AND NOT (id = ANY(submitted_stage_ids));

  RETURN p_plan_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- Revoke default broad execution privilege from public
REVOKE EXECUTE ON FUNCTION save_treatment_plan_with_stages(uuid, uuid, uuid, text, text, numeric, jsonb) FROM public;

-- Grant execution privilege only to authenticated users
GRANT EXECUTE ON FUNCTION save_treatment_plan_with_stages(uuid, uuid, uuid, text, text, numeric, jsonb) TO authenticated;
