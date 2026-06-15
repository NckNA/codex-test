-- 0010_clinical_dictionary_template_bootstrap.sql
-- Adds reusable clinical dictionary templates and an explicit tenant-scoped bootstrap RPC.

CREATE TABLE IF NOT EXISTS public.clinical_dictionary_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clinical_dictionary_template_items (
  template_id uuid NOT NULL REFERENCES public.clinical_dictionary_templates(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  type text NOT NULL CHECK (type IN ('diagnosis', 'work')),
  name text NOT NULL,
  description text,
  allowed_presence_statuses text[] NOT NULL DEFAULT '{}',
  allowed_zones text[] NOT NULL DEFAULT '{}',
  work_access_type text CHECK (work_access_type IS NULL OR work_access_type IN ('base_available', 'status_available', 'requires_diagnosis')),
  allowed_diagnosis_ids text[] NOT NULL DEFAULT '{}',
  price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  visual_priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (template_id, item_id),

  CONSTRAINT check_template_dictionary_item_type_rules CHECK (
    (type = 'diagnosis' AND work_access_type IS NULL AND allowed_diagnosis_ids = '{}'::text[]) OR
    (type = 'work' AND work_access_type IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_clinical_dictionary_templates_active_key
  ON public.clinical_dictionary_templates(key, is_active);

CREATE INDEX IF NOT EXISTS idx_clinical_dictionary_template_items_template_type
  ON public.clinical_dictionary_template_items(template_id, type);

ALTER TABLE public.clinical_dictionary_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_dictionary_template_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view active clinical dictionary templates"
  ON public.clinical_dictionary_templates;
CREATE POLICY "Authenticated users can view active clinical dictionary templates"
  ON public.clinical_dictionary_templates
  FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated users can view active clinical dictionary template items"
  ON public.clinical_dictionary_template_items;
CREATE POLICY "Authenticated users can view active clinical dictionary template items"
  ON public.clinical_dictionary_template_items
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND template_id IN (
      SELECT id
      FROM public.clinical_dictionary_templates
      WHERE is_active = true
    )
  );

REVOKE ALL ON TABLE public.clinical_dictionary_templates FROM anon;
REVOKE ALL ON TABLE public.clinical_dictionary_templates FROM PUBLIC;
GRANT SELECT ON TABLE public.clinical_dictionary_templates TO authenticated;

REVOKE ALL ON TABLE public.clinical_dictionary_template_items FROM anon;
REVOKE ALL ON TABLE public.clinical_dictionary_template_items FROM PUBLIC;
GRANT SELECT ON TABLE public.clinical_dictionary_template_items TO authenticated;

DO $$
DECLARE
  v_template_id uuid := '00000000-0000-4000-8000-000000000010'::uuid;
BEGIN
  INSERT INTO public.clinical_dictionary_templates (
    id, key, name, description, version, is_active
  )
  VALUES (
    v_template_id,
    'default_dental_v1',
    'Default Dental Dictionary v1',
    'Reusable baseline dental diagnoses and works copied explicitly into one tenant by an authorized clinic admin or owner.',
    1,
    true
  )
  ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    version = EXCLUDED.version,
    is_active = EXCLUDED.is_active,
    updated_at = now()
  RETURNING id INTO v_template_id;

  DELETE FROM public.clinical_dictionary_template_items
  WHERE template_id = v_template_id;

  INSERT INTO public.clinical_dictionary_template_items (
    template_id,
    item_id,
    type,
    name,
    description,
    allowed_presence_statuses,
    allowed_zones,
    work_access_type,
    allowed_diagnosis_ids,
    price,
    visual_priority,
    is_active
  )
  VALUES
  (v_template_id, 'dx_caries_initial', 'diagnosis', 'Начальный кариес / white spot', NULL, ARRAY['natural', 'deciduous']::text[], ARRAY['crown']::text[], NULL, ARRAY[]::text[], 0, 20, true),
  (v_template_id, 'dx_caries_enamel', 'diagnosis', 'Кариес эмали', NULL, ARRAY['natural', 'deciduous']::text[], ARRAY['crown']::text[], NULL, ARRAY[]::text[], 0, 30, true),
  (v_template_id, 'dx_caries_dentin', 'diagnosis', 'Кариес дентина', NULL, ARRAY['natural', 'deciduous']::text[], ARRAY['crown']::text[], NULL, ARRAY[]::text[], 0, 40, true),
  (v_template_id, 'dx_deep_caries', 'diagnosis', 'Глубокий кариес', NULL, ARRAY['natural', 'deciduous']::text[], ARRAY['crown']::text[], NULL, ARRAY[]::text[], 0, 50, true),
  (v_template_id, 'dx_filling_defect', 'diagnosis', 'Нарушение краевого прилегания пломбы', NULL, ARRAY['natural']::text[], ARRAY['crown']::text[], NULL, ARRAY[]::text[], 0, 25, true),
  (v_template_id, 'dx_crown_fracture', 'diagnosis', 'Перелом коронки', NULL, ARRAY['natural', 'deciduous']::text[], ARRAY['crown']::text[], NULL, ARRAY[]::text[], 0, 45, true),
  (v_template_id, 'dx_reversible_pulpitis', 'diagnosis', 'Обратимый пульпит', NULL, ARRAY['natural', 'deciduous']::text[], ARRAY['endodontics']::text[], NULL, ARRAY[]::text[], 0, 60, true),
  (v_template_id, 'dx_irreversible_pulpitis', 'diagnosis', 'Необратимый пульпит', NULL, ARRAY['natural', 'deciduous']::text[], ARRAY['endodontics']::text[], NULL, ARRAY[]::text[], 0, 70, true),
  (v_template_id, 'dx_pulp_necrosis', 'diagnosis', 'Некроз пульпы', NULL, ARRAY['natural']::text[], ARRAY['endodontics']::text[], NULL, ARRAY[]::text[], 0, 80, true),
  (v_template_id, 'dx_previously_treated_canals', 'diagnosis', 'Ранее леченые каналы', NULL, ARRAY['natural']::text[], ARRAY['endodontics']::text[], NULL, ARRAY[]::text[], 0, 35, true),
  (v_template_id, 'dx_apical_periodontitis', 'diagnosis', 'Апикальный периодонтит', NULL, ARRAY['natural', 'root_remnant']::text[], ARRAY['root']::text[], NULL, ARRAY[]::text[], 0, 75, true),
  (v_template_id, 'dx_radicular_cyst', 'diagnosis', 'Радикулярная киста', NULL, ARRAY['natural', 'root_remnant']::text[], ARRAY['root']::text[], NULL, ARRAY[]::text[], 0, 85, true),
  (v_template_id, 'dx_root_remnant', 'diagnosis', 'Остаток корня', NULL, ARRAY['root_remnant']::text[], ARRAY['root']::text[], NULL, ARRAY[]::text[], 0, 65, true),
  (v_template_id, 'dx_root_caries', 'diagnosis', 'Кариес корня', NULL, ARRAY['natural', 'root_remnant']::text[], ARRAY['root']::text[], NULL, ARRAY[]::text[], 0, 55, true),
  (v_template_id, 'dx_gingivitis', 'diagnosis', 'Гингивит', NULL, ARRAY['natural', 'implant', 'deciduous']::text[], ARRAY['periodontium']::text[], NULL, ARRAY[]::text[], 0, 25, true),
  (v_template_id, 'dx_periodontal_pocket', 'diagnosis', 'Пародонтальный карман', NULL, ARRAY['natural', 'implant']::text[], ARRAY['periodontium']::text[], NULL, ARRAY[]::text[], 0, 45, true),
  (v_template_id, 'dx_recession', 'diagnosis', 'Рецессия десны', NULL, ARRAY['natural', 'implant']::text[], ARRAY['periodontium']::text[], NULL, ARRAY[]::text[], 0, 35, true),
  (v_template_id, 'dx_missing_tooth', 'diagnosis', 'Отсутствие зуба', NULL, ARRAY['missing']::text[], ARRAY['orthopedics', 'bone']::text[], NULL, ARRAY[]::text[], 0, 50, true),
  (v_template_id, 'dx_partial_adentia', 'diagnosis', 'Частичная адентия', NULL, ARRAY['missing']::text[], ARRAY['orthopedics', 'bone']::text[], NULL, ARRAY[]::text[], 0, 55, true),
  (v_template_id, 'dx_bone_atrophy_height', 'diagnosis', 'Атрофия костной ткани по высоте', NULL, ARRAY['missing']::text[], ARRAY['bone']::text[], NULL, ARRAY[]::text[], 0, 60, true),
  (v_template_id, 'dx_bone_atrophy_width', 'diagnosis', 'Атрофия костной ткани по ширине', NULL, ARRAY['missing']::text[], ARRAY['bone']::text[], NULL, ARRAY[]::text[], 0, 60, true),
  (v_template_id, 'dx_implant_installed', 'diagnosis', 'Установлен имплант', NULL, ARRAY['implant']::text[], ARRAY['orthopedics', 'bone']::text[], NULL, ARRAY[]::text[], 0, 30, true),
  (v_template_id, 'dx_peri_implantitis', 'diagnosis', 'Периимплантит', NULL, ARRAY['implant']::text[], ARRAY['periodontium', 'bone']::text[], NULL, ARRAY[]::text[], 0, 85, true),
  (v_template_id, 'dx_implant_crown_defect', 'diagnosis', 'Дефект коронки на импланте', NULL, ARRAY['implant']::text[], ARRAY['orthopedics']::text[], NULL, ARRAY[]::text[], 0, 40, true),
  (v_template_id, 'dx_impacted_tooth', 'diagnosis', 'Ретинированный / дистопированный зуб', NULL, ARRAY['impacted']::text[], ARRAY['bone']::text[], NULL, ARRAY[]::text[], 0, 70, true),
  (v_template_id, 'work_fissure_sealing', 'work', 'Герметизация фиссур', NULL, ARRAY['natural', 'deciduous']::text[], ARRAY['crown']::text[], 'requires_diagnosis', ARRAY['dx_caries_initial']::text[], 0, 0, true),
  (v_template_id, 'work_remineralization', 'work', 'Реминерализующая терапия', NULL, ARRAY['natural', 'deciduous']::text[], ARRAY['crown']::text[], 'requires_diagnosis', ARRAY['dx_caries_initial']::text[], 0, 0, true),
  (v_template_id, 'work_filling_1_surface', 'work', 'Пломба 1 поверхность', NULL, ARRAY['natural', 'deciduous']::text[], ARRAY['crown']::text[], 'requires_diagnosis', ARRAY['dx_caries_enamel', 'dx_caries_dentin', 'dx_filling_defect']::text[], 0, 0, true),
  (v_template_id, 'work_filling_2_surfaces', 'work', 'Пломба 2 поверхности', NULL, ARRAY['natural', 'deciduous']::text[], ARRAY['crown']::text[], 'requires_diagnosis', ARRAY['dx_caries_dentin', 'dx_deep_caries', 'dx_crown_fracture']::text[], 0, 0, true),
  (v_template_id, 'work_temporary_filling', 'work', 'Временная пломба', NULL, ARRAY['natural', 'deciduous']::text[], ARRAY['crown', 'endodontics']::text[], 'base_available', ARRAY[]::text[], 0, 0, true),
  (v_template_id, 'work_root_canal_treatment', 'work', 'Лечение корневых каналов', NULL, ARRAY['natural']::text[], ARRAY['endodontics']::text[], 'requires_diagnosis', ARRAY['dx_irreversible_pulpitis', 'dx_pulp_necrosis']::text[], 0, 0, true),
  (v_template_id, 'work_root_canal_retreatment', 'work', 'Перелечивание каналов', NULL, ARRAY['natural']::text[], ARRAY['endodontics']::text[], 'requires_diagnosis', ARRAY['dx_previously_treated_canals', 'dx_apical_periodontitis']::text[], 0, 0, true),
  (v_template_id, 'work_root_remnant_extraction', 'work', 'Удаление остатка корня', NULL, ARRAY['root_remnant']::text[], ARRAY['root']::text[], 'requires_diagnosis', ARRAY['dx_root_remnant', 'dx_root_caries']::text[], 0, 0, true),
  (v_template_id, 'work_periodontal_cleaning', 'work', 'Пародонтологическая чистка', NULL, ARRAY['natural', 'implant', 'deciduous']::text[], ARRAY['periodontium']::text[], 'requires_diagnosis', ARRAY['dx_gingivitis', 'dx_periodontal_pocket']::text[], 0, 0, true),
  (v_template_id, 'work_curettage', 'work', 'Кюретаж пародонтального кармана', NULL, ARRAY['natural']::text[], ARRAY['periodontium']::text[], 'requires_diagnosis', ARRAY['dx_periodontal_pocket']::text[], 0, 0, true),
  (v_template_id, 'work_implant_planning', 'work', 'Планирование имплантации', NULL, ARRAY['missing']::text[], ARRAY['orthopedics', 'bone']::text[], 'requires_diagnosis', ARRAY['dx_missing_tooth', 'dx_partial_adentia']::text[], 0, 0, true),
  (v_template_id, 'work_implant_installation', 'work', 'Установка импланта', NULL, ARRAY['missing']::text[], ARRAY['bone']::text[], 'requires_diagnosis', ARRAY['dx_missing_tooth', 'dx_bone_atrophy_height', 'dx_bone_atrophy_width']::text[], 0, 0, true),
  (v_template_id, 'work_bone_grafting', 'work', 'Костная пластика', NULL, ARRAY['missing']::text[], ARRAY['bone']::text[], 'requires_diagnosis', ARRAY['dx_bone_atrophy_height', 'dx_bone_atrophy_width']::text[], 0, 0, true),
  (v_template_id, 'work_implant_crown', 'work', 'Коронка на импланте', NULL, ARRAY['implant']::text[], ARRAY['orthopedics']::text[], 'requires_diagnosis', ARRAY['dx_implant_installed', 'dx_implant_crown_defect']::text[], 0, 0, true),
  (v_template_id, 'work_implant_maintenance', 'work', 'Обслуживание импланта', NULL, ARRAY['implant']::text[], ARRAY['periodontium', 'orthopedics']::text[], 'status_available', ARRAY[]::text[], 0, 0, true),
  (v_template_id, 'work_peri_implantitis_treatment', 'work', 'Лечение периимплантита', NULL, ARRAY['implant']::text[], ARRAY['periodontium', 'bone']::text[], 'requires_diagnosis', ARRAY['dx_peri_implantitis']::text[], 0, 0, true),
  (v_template_id, 'work_impacted_tooth_diagnostics', 'work', 'Диагностика ретинированного зуба', NULL, ARRAY['impacted']::text[], ARRAY['bone']::text[], 'status_available', ARRAY[]::text[], 0, 0, true),
  (v_template_id, 'work_impacted_tooth_extraction', 'work', 'Удаление ретинированного зуба', NULL, ARRAY['impacted']::text[], ARRAY['bone']::text[], 'requires_diagnosis', ARRAY['dx_impacted_tooth']::text[], 0, 0, true);
END $$;

CREATE OR REPLACE FUNCTION public.bootstrap_clinical_dictionary_from_template(
  target_tenant_id uuid,
  template_key text DEFAULT 'default_dental_v1'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_template_id uuid;
  v_inserted_count integer := 0;
  v_total_active_count integer := 0;
  v_skipped_existing_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to bootstrap clinical dictionaries'
      USING ERRCODE = '28000';
  END IF;

  IF target_tenant_id IS NULL THEN
    RAISE EXCEPTION 'target_tenant_id is required'
      USING ERRCODE = '22004';
  END IF;

  IF NOT public.has_tenant_role(
    target_tenant_id,
    ARRAY['clinic_owner'::app_role, 'clinic_admin'::app_role]
  ) THEN
    RAISE EXCEPTION 'Clinic owner or admin role is required to bootstrap clinical dictionaries'
      USING ERRCODE = '42501';
  END IF;

  SELECT t.id
  INTO v_template_id
  FROM public.clinical_dictionary_templates t
  WHERE t.key = template_key
    AND t.is_active = true
  LIMIT 1;

  IF v_template_id IS NULL THEN
    RAISE EXCEPTION 'Active clinical dictionary template not found: %', template_key
      USING ERRCODE = '22023';
  END IF;

  SELECT count(*)
  INTO v_total_active_count
  FROM public.clinical_dictionary_template_items ti
  WHERE ti.template_id = v_template_id
    AND ti.is_active = true;

  WITH inserted AS (
    INSERT INTO public.clinical_dictionary_items (
      tenant_id,
      id,
      type,
      name,
      description,
      allowed_presence_statuses,
      allowed_zones,
      work_access_type,
      allowed_diagnosis_ids,
      price,
      visual_priority,
      is_active
    )
    SELECT
      target_tenant_id,
      ti.item_id,
      ti.type,
      ti.name,
      ti.description,
      ti.allowed_presence_statuses,
      ti.allowed_zones,
      ti.work_access_type,
      ti.allowed_diagnosis_ids,
      CASE WHEN ti.type = 'work' THEN NULLIF(ti.price, 0) ELSE NULL END,
      CASE WHEN ti.type = 'diagnosis' THEN ti.visual_priority ELSE NULL END,
      ti.is_active
    FROM public.clinical_dictionary_template_items ti
    WHERE ti.template_id = v_template_id
      AND ti.is_active = true
    ON CONFLICT (tenant_id, id) DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_inserted_count FROM inserted;

  v_skipped_existing_count := v_total_active_count - v_inserted_count;

  RETURN jsonb_build_object(
    'inserted_count', v_inserted_count,
    'skipped_existing_count', v_skipped_existing_count,
    'template_key', template_key,
    'tenant_id', target_tenant_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bootstrap_clinical_dictionary_from_template(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.bootstrap_clinical_dictionary_from_template(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_clinical_dictionary_from_template(uuid, text) TO authenticated;
