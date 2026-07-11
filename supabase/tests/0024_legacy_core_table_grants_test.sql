\set ON_ERROR_STOP on
\echo 'LEGACY-CORE-TABLE-GRANTS-RECOVERY-001 local SQL validation'

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(p_condition boolean, p_message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE(p_condition, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'ASSERTION FAILED: %', p_message;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.expect_error(p_sql text, p_expected text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_message text;
BEGIN
  BEGIN
    EXECUTE p_sql;
    RAISE EXCEPTION 'ASSERTION FAILED: expected error containing "%"', p_expected;
  EXCEPTION WHEN OTHERS THEN
    v_message := SQLERRM;
    IF v_message LIKE 'ASSERTION FAILED:%' THEN
      RAISE;
    END IF;
    IF position(lower(p_expected) in lower(v_message)) = 0 THEN
      RAISE EXCEPTION 'ASSERTION FAILED: expected "%", got "%"', p_expected, v_message;
    END IF;
  END;
END;
$$;

CREATE TEMP TABLE expected_authenticated_legacy_privileges (
  table_name text PRIMARY KEY,
  can_select boolean NOT NULL,
  can_insert boolean NOT NULL,
  can_update boolean NOT NULL,
  can_delete boolean NOT NULL
) ON COMMIT DROP;

INSERT INTO expected_authenticated_legacy_privileges VALUES
  ('tenants', true, false, false, false),
  ('profiles', false, false, false, false),
  ('tenant_users', true, false, false, false),
  ('subscriptions', false, false, false, false),
  ('audit_logs', false, false, false, false),
  ('patients', true, true, true, false),
  ('doctors', true, false, false, false),
  ('appointments', true, true, true, true),
  ('chief_complaints', true, true, true, false),
  ('dental_charts', true, true, true, false),
  ('tooth_states', true, true, true, false),
  ('findings', true, true, true, false),
  ('treatment_plans', true, false, false, true),
  ('treatment_stages', true, false, false, false),
  ('documents', false, false, false, false),
  ('integration_tokens', false, false, false, false);

-- Exact authenticated matrix based on current repository calls.
SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM expected_authenticated_legacy_privileges e
    WHERE has_table_privilege('authenticated', format('public.%I', e.table_name), 'SELECT') <> e.can_select
       OR has_table_privilege('authenticated', format('public.%I', e.table_name), 'INSERT') <> e.can_insert
       OR has_table_privilege('authenticated', format('public.%I', e.table_name), 'UPDATE') <> e.can_update
       OR has_table_privilege('authenticated', format('public.%I', e.table_name), 'DELETE') <> e.can_delete
  ),
  'authenticated legacy privilege matrix matches current application needs'
);

-- No unexpected destructive/DDL-adjacent privilege remains on any legacy table.
SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM expected_authenticated_legacy_privileges e
    CROSS JOIN (VALUES ('REFERENCES'), ('TRIGGER'), ('TRUNCATE')) p(privilege_name)
    WHERE has_table_privilege('authenticated', format('public.%I', e.table_name), p.privilege_name)
  ),
  'authenticated has no REFERENCES, TRIGGER or TRUNCATE privilege on legacy tables'
);

SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM expected_authenticated_legacy_privileges e
    CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('REFERENCES'), ('TRIGGER'), ('TRUNCATE')) p(privilege_name)
    WHERE has_table_privilege('anon', format('public.%I', e.table_name), p.privilege_name)
  ),
  'anon has no protected legacy table privilege'
);

SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
    WHERE n.nspname = 'public'
      AND c.relname IN (SELECT table_name FROM expected_authenticated_legacy_privileges)
      AND a.grantee = 0
  ),
  'PUBLIC has no direct legacy table privileges'
);

-- service_role receives ordinary CRUD only on the explicit legacy list.
SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM expected_authenticated_legacy_privileges e
    WHERE NOT has_table_privilege('service_role', format('public.%I', e.table_name), 'SELECT')
       OR NOT has_table_privilege('service_role', format('public.%I', e.table_name), 'INSERT')
       OR NOT has_table_privilege('service_role', format('public.%I', e.table_name), 'UPDATE')
       OR NOT has_table_privilege('service_role', format('public.%I', e.table_name), 'DELETE')
       OR has_table_privilege('service_role', format('public.%I', e.table_name), 'REFERENCES')
       OR has_table_privilege('service_role', format('public.%I', e.table_name), 'TRIGGER')
       OR has_table_privilege('service_role', format('public.%I', e.table_name), 'TRUNCATE')
  ),
  'service_role has exact legacy CRUD without REFERENCES, TRIGGER or TRUNCATE'
);

-- RLS and policy inventory remain unchanged and reachable.
CREATE TEMP TABLE expected_policy_counts (
  table_name text PRIMARY KEY,
  policy_count integer NOT NULL
) ON COMMIT DROP;

INSERT INTO expected_policy_counts VALUES
  ('tenants', 1),
  ('profiles', 2),
  ('tenant_users', 1),
  ('subscriptions', 1),
  ('audit_logs', 2),
  ('patients', 4),
  ('doctors', 4),
  ('appointments', 4),
  ('chief_complaints', 4),
  ('dental_charts', 4),
  ('tooth_states', 4),
  ('findings', 4),
  ('treatment_plans', 4),
  ('treatment_stages', 4),
  ('documents', 4),
  ('integration_tokens', 0);

SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM expected_policy_counts e
    JOIN pg_class c ON c.relname = e.table_name
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE c.relrowsecurity IS NOT TRUE
       OR (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = e.table_name) <> e.policy_count
  ),
  'RLS remains enabled and legacy policy counts remain unchanged'
);

-- UUID defaults mean there are no public serial/identity sequences to grant.
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM information_schema.sequences WHERE sequence_schema = 'public') = 0,
  'legacy schema has no public sequence requiring privileges'
);

-- Existing RLS helper grants remain intact and are not broadened.
SELECT pg_temp.assert_true(
  has_function_privilege('authenticated', 'public.get_user_tenants()', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.has_tenant_role(uuid,app_role[])', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.get_user_tenants()', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.has_tenant_role(uuid,app_role[])', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.get_user_tenants()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.has_tenant_role(uuid,app_role[])', 'EXECUTE'),
  'legacy RLS helper EXECUTE grants remain hardened'
);

SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_user_tenants', 'has_tenant_role')
      AND a.grantee = 0
      AND a.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute legacy RLS helpers'
);

-- Newer read-only table and controlled-RPC privilege patterns are unchanged.
SELECT pg_temp.assert_true(
  has_table_privilege('authenticated', 'public.patient_visits', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.patient_visits', 'INSERT')
  AND has_table_privilege('authenticated', 'public.clinical_encounters', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.clinical_encounters', 'UPDATE')
  AND has_table_privilege('authenticated', 'public.completed_services', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.completed_services', 'DELETE')
  AND has_table_privilege('authenticated', 'public.invoices', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.invoices', 'INSERT')
  AND has_table_privilege('authenticated', 'public.payments', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.payments', 'UPDATE'),
  'encounter and finance table privilege patterns are unchanged'
);

-- Transaction-scoped identities and data.  The test does not depend on QA seed.
\set tenant_a 'a9240000-0000-4000-8000-000000000001'
\set tenant_b 'b9240000-0000-4000-8000-000000000001'
\set admin_a 'a9241000-0000-4000-8000-000000000001'
\set registrar_a 'a9241000-0000-4000-8000-000000000002'
\set doctor_user_a 'a9241000-0000-4000-8000-000000000003'
\set cashier_a 'a9241000-0000-4000-8000-000000000004'
\set no_tenant 'a9241000-0000-4000-8000-000000000005'
\set admin_b 'b9241000-0000-4000-8000-000000000001'
\set service_user 'c9241000-0000-4000-8000-000000000001'
\set patient_a 'a9242000-0000-4000-8000-000000000001'
\set patient_b 'b9242000-0000-4000-8000-000000000001'
\set patient_created 'a9242000-0000-4000-8000-000000000002'
\set doctor_a 'a9243000-0000-4000-8000-000000000001'
\set doctor_b 'b9243000-0000-4000-8000-000000000001'
\set appointment_a 'a9244000-0000-4000-8000-000000000001'
\set appointment_b 'b9244000-0000-4000-8000-000000000001'
\set appointment_created 'a9244000-0000-4000-8000-000000000002'
\set appointment_doctor_created 'a9244000-0000-4000-8000-000000000003'
\set appointment_cashier_created 'a9244000-0000-4000-8000-000000000004'
\set service_tenant 'c9240000-0000-4000-8000-000000000001'
\set service_patient 'c9242000-0000-4000-8000-000000000001'
\set service_doctor 'c9243000-0000-4000-8000-000000000001'
\set service_appointment 'c9244000-0000-4000-8000-000000000001'

INSERT INTO public.tenants(id, name) VALUES
  (:'tenant_a', 'Legacy grants tenant A'),
  (:'tenant_b', 'Legacy grants tenant B');

INSERT INTO auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  (:'admin_a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'legacy-admin-a@example.local', 'not-a-secret', now(), '{"provider":"email"}', '{}', now(), now()),
  (:'registrar_a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'legacy-registrar-a@example.local', 'not-a-secret', now(), '{"provider":"email"}', '{}', now(), now()),
  (:'doctor_user_a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'legacy-doctor-a@example.local', 'not-a-secret', now(), '{"provider":"email"}', '{}', now(), now()),
  (:'cashier_a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'legacy-cashier-a@example.local', 'not-a-secret', now(), '{"provider":"email"}', '{}', now(), now()),
  (:'no_tenant', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'legacy-no-tenant@example.local', 'not-a-secret', now(), '{"provider":"email"}', '{}', now(), now()),
  (:'admin_b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'legacy-admin-b@example.local', 'not-a-secret', now(), '{"provider":"email"}', '{}', now(), now()),
  (:'service_user', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'legacy-service@example.local', 'not-a-secret', now(), '{"provider":"email"}', '{}', now(), now());

INSERT INTO public.profiles(id, first_name) VALUES
  (:'admin_a', 'Admin A'),
  (:'registrar_a', 'Registrar A'),
  (:'doctor_user_a', 'Doctor A'),
  (:'cashier_a', 'Cashier A'),
  (:'no_tenant', 'No Tenant'),
  (:'admin_b', 'Admin B');

INSERT INTO public.tenant_users(tenant_id, user_id, role) VALUES
  (:'tenant_a', :'admin_a', 'clinic_admin'),
  (:'tenant_a', :'registrar_a', 'registrar'),
  (:'tenant_a', :'doctor_user_a', 'doctor'),
  (:'tenant_a', :'cashier_a', 'cashier'),
  (:'tenant_b', :'admin_b', 'clinic_admin');

INSERT INTO public.patients(id, tenant_id, full_name, phone, source) VALUES
  (:'patient_a', :'tenant_a', 'Patient A', '+77000000001', 'phone'),
  (:'patient_b', :'tenant_b', 'Patient B', '+77000000002', 'phone');

INSERT INTO public.doctors(id, tenant_id, full_name, specialization, cabinet) VALUES
  (:'doctor_a', :'tenant_a', 'Doctor A', 'therapist', 'A-1'),
  (:'doctor_b', :'tenant_b', 'Doctor B', 'therapist', 'B-1');

INSERT INTO public.appointments(id, tenant_id, patient_id, doctor_id, service, status, start_time, end_time) VALUES
  (:'appointment_a', :'tenant_a', :'patient_a', :'doctor_a', 'Tenant A fixture', 'new', '2026-08-01T09:00:00Z', '2026-08-01T10:00:00Z'),
  (:'appointment_b', :'tenant_b', :'patient_b', :'doctor_b', 'Tenant B fixture', 'new', '2026-08-01T09:00:00Z', '2026-08-01T10:00:00Z');

-- Valid tenant admin: membership, tenant, patient, doctor and appointment reads.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.tenant_users) = 4
  AND (SELECT count(*) FROM public.tenant_users WHERE tenant_id = :'tenant_b') = 0,
  'authenticated user reads memberships only inside own tenant'
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.tenants) = 1
  AND EXISTS (SELECT 1 FROM public.tenants WHERE id = :'tenant_a')
  AND NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = :'tenant_b'),
  'authenticated user reads own tenant only'
);
SELECT pg_temp.expect_error('select count(*) from public.profiles', 'permission denied');
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.patients) = 1
  AND EXISTS (SELECT 1 FROM public.patients WHERE id = :'patient_a')
  AND NOT EXISTS (SELECT 1 FROM public.patients WHERE id = :'patient_b'),
  'authenticated user reads own-tenant patients only'
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.doctors) = 1
  AND EXISTS (SELECT 1 FROM public.doctors WHERE id = :'doctor_a')
  AND NOT EXISTS (SELECT 1 FROM public.doctors WHERE id = :'doctor_b'),
  'authenticated user reads own-tenant doctors only'
);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.appointments) = 1
  AND EXISTS (SELECT 1 FROM public.appointments WHERE id = :'appointment_a')
  AND NOT EXISTS (SELECT 1 FROM public.appointments WHERE id = :'appointment_b'),
  'authenticated user reads own-tenant appointments only'
);

INSERT INTO public.patients(id, tenant_id, full_name, phone, source)
VALUES (:'patient_created', :'tenant_a', 'Created by authenticated', '+77000000003', 'phone');
UPDATE public.patients SET notes = 'updated by authenticated' WHERE id = :'patient_created';
SELECT pg_temp.assert_true(
  (SELECT notes FROM public.patients WHERE id = :'patient_created') = 'updated by authenticated',
  'authenticated patient create and update succeed under RLS'
);
SELECT pg_temp.expect_error(
  format('insert into public.patients(id,tenant_id,full_name) values(%L::uuid,%L::uuid,%L)', 'b9242000-0000-4000-8000-000000000099', :'tenant_b', 'cross tenant denied'),
  'row-level security'
);
UPDATE public.patients SET notes = 'cross tenant mutation' WHERE id = :'patient_b';
SELECT pg_temp.assert_true(
  NOT EXISTS (SELECT 1 FROM public.patients WHERE id = :'patient_b'),
  'cross-tenant patient remains invisible after update attempt'
);
SELECT pg_temp.expect_error(
  format('delete from public.patients where id=%L::uuid', :'patient_created'),
  'permission denied'
);

-- Doctor repository is read-only in the current application.
SELECT pg_temp.expect_error(
  format('insert into public.doctors(id,tenant_id,full_name) values(%L::uuid,%L::uuid,%L)', 'a9243000-0000-4000-8000-000000000099', :'tenant_a', 'unexpected direct doctor writer'),
  'permission denied'
);
SELECT pg_temp.expect_error(
  format('update public.doctors set full_name=%L where id=%L::uuid', 'unexpected update', :'doctor_a'),
  'permission denied'
);

-- Migration 0025 preserves the legacy grants matrix but closes direct appointment
-- INSERT/UPDATE through an authoritative trigger. Current members write via RPC.
SELECT pg_temp.expect_error(
  format('insert into public.appointments(id,tenant_id,patient_id,doctor_id,status,start_time,end_time) values(%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L,%L::timestamptz,%L::timestamptz)', 'a9244000-0000-4000-8000-000000000097', :'tenant_a', :'patient_a', :'doctor_a', 'new', '2026-08-01T10:00:00Z', '2026-08-01T11:00:00Z'),
  'Недостаточно прав'
);
SELECT (public.create_appointment(:'tenant_a', :'patient_a', :'doctor_a', '2026-08-01T10:00:00Z', '2026-08-01T11:00:00Z', '', 'Created by admin', 'new', NULL, NULL, NULL, NULL, 'legacy-grants-admin-create')->'appointment'->>'id') AS appointment_created \gset
SELECT pg_temp.expect_error(
  format('update public.appointments set status=%L where id=%L::uuid', 'confirmed', :'appointment_created'),
  'Недостаточно прав'
);
SELECT pg_temp.expect_error(
  format('insert into public.appointments(id,tenant_id,patient_id,doctor_id,status,start_time,end_time) values(%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L,%L::timestamptz,%L::timestamptz)', 'b9244000-0000-4000-8000-000000000099', :'tenant_b', :'patient_b', :'doctor_b', 'new', '2026-08-01T10:00:00Z', '2026-08-01T11:00:00Z'),
  'Недостаточно прав'
);

-- Current broad appointment role policy is now enforced through RPC, while
-- direct table mutations remain blocked for doctor and cashier as well.
SELECT set_config('request.jwt.claim.sub', :'doctor_user_a', true);
SELECT (public.create_appointment(:'tenant_a', :'patient_a', :'doctor_a', '2026-08-01T12:00:00Z', '2026-08-01T13:00:00Z', '', 'Doctor policy evidence', 'new', NULL, NULL, NULL, NULL, 'legacy-grants-doctor-create')->'appointment'->>'id') AS appointment_doctor_created \gset
SELECT pg_temp.expect_error(
  format('update public.appointments set status=%L where id=%L::uuid', 'arrived', :'appointment_doctor_created'),
  'Недостаточно прав'
);
SELECT set_config('request.jwt.claim.sub', :'cashier_a', true);
SELECT (public.create_appointment(:'tenant_a', :'patient_a', :'doctor_a', '2026-08-01T13:00:00Z', '2026-08-01T14:00:00Z', '', 'Cashier policy evidence', 'new', NULL, NULL, NULL, NULL, 'legacy-grants-cashier-create')->'appointment'->>'id') AS appointment_cashier_created \gset
SELECT pg_temp.expect_error(
  format('update public.appointments set status=%L where id=%L::uuid', 'confirmed', :'appointment_cashier_created'),
  'Недостаточно прав'
);

-- Registrar has DELETE table privilege but existing RLS prevents deletion.
SELECT set_config('request.jwt.claim.sub', :'registrar_a', true);
DELETE FROM public.appointments WHERE id = :'appointment_created';
SELECT pg_temp.assert_true(
  EXISTS (SELECT 1 FROM public.appointments WHERE id = :'appointment_created'),
  'registrar cannot delete appointment under current RLS'
);

-- Admin delete remains available.
SELECT set_config('request.jwt.claim.sub', :'admin_a', true);
DELETE FROM public.appointments WHERE id = :'appointment_created';
SELECT pg_temp.assert_true(
  NOT EXISTS (SELECT 1 FROM public.appointments WHERE id = :'appointment_created'),
  'clinic admin can delete appointment under current RLS'
);

-- No-membership user receives no clinic data and cannot write into a tenant.
SELECT set_config('request.jwt.claim.sub', :'no_tenant', true);
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.tenant_users) = 0
  AND (SELECT count(*) FROM public.tenants) = 0
  AND (SELECT count(*) FROM public.patients) = 0
  AND (SELECT count(*) FROM public.doctors) = 0
  AND (SELECT count(*) FROM public.appointments) = 0,
  'no-membership authenticated user receives no tenant data'
);
SELECT pg_temp.expect_error(
  format('insert into public.patients(id,tenant_id,full_name) values(%L::uuid,%L::uuid,%L)', 'a9242000-0000-4000-8000-000000000099', :'tenant_a', 'no tenant denied'),
  'row-level security'
);

RESET ROLE;

-- Anonymous access remains blocked before RLS can expose any protected row.
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error('select count(*) from public.tenant_users', 'permission denied');
SELECT pg_temp.expect_error('select count(*) from public.patients', 'permission denied');
SELECT pg_temp.expect_error(
  format('insert into public.appointments(id,tenant_id,status,start_time,end_time) values(%L::uuid,%L::uuid,%L,%L::timestamptz,%L::timestamptz)', 'a9244000-0000-4000-8000-000000000097', :'tenant_a', 'new', '2026-08-01T14:00:00Z', '2026-08-01T15:00:00Z'),
  'permission denied'
);
RESET ROLE;

-- service_role can perform controlled setup and cleanup without frontend use.
SET LOCAL ROLE service_role;
INSERT INTO public.tenants(id, name) VALUES (:'service_tenant', 'Service-role fixture tenant');
INSERT INTO public.profiles(id, first_name) VALUES (:'service_user', 'Service Fixture');
INSERT INTO public.tenant_users(tenant_id, user_id, role) VALUES (:'service_tenant', :'service_user', 'clinic_admin');
INSERT INTO public.patients(id, tenant_id, full_name) VALUES (:'service_patient', :'service_tenant', 'Service Fixture Patient');
INSERT INTO public.doctors(id, tenant_id, full_name) VALUES (:'service_doctor', :'service_tenant', 'Service Fixture Doctor');
INSERT INTO public.appointments(id, tenant_id, patient_id, doctor_id, status, start_time, end_time)
VALUES (:'service_appointment', :'service_tenant', :'service_patient', :'service_doctor', 'new', '2026-08-02T09:00:00Z', '2026-08-02T10:00:00Z');
SELECT pg_temp.assert_true(
  EXISTS (SELECT 1 FROM public.tenants WHERE id = :'service_tenant')
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = :'service_user')
  AND EXISTS (SELECT 1 FROM public.tenant_users WHERE tenant_id = :'service_tenant' AND user_id = :'service_user')
  AND EXISTS (SELECT 1 FROM public.patients WHERE id = :'service_patient')
  AND EXISTS (SELECT 1 FROM public.doctors WHERE id = :'service_doctor')
  AND EXISTS (SELECT 1 FROM public.appointments WHERE id = :'service_appointment'),
  'service_role creates controlled core QA fixtures'
);
DELETE FROM public.appointments WHERE id = :'service_appointment';
DELETE FROM public.doctors WHERE id = :'service_doctor';
DELETE FROM public.patients WHERE id = :'service_patient';
DELETE FROM public.tenant_users WHERE tenant_id = :'service_tenant' AND user_id = :'service_user';
DELETE FROM public.profiles WHERE id = :'service_user';
DELETE FROM public.tenants WHERE id = :'service_tenant';
SELECT pg_temp.assert_true(
  NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = :'service_tenant')
  AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = :'service_user')
  AND NOT EXISTS (SELECT 1 FROM public.tenant_users WHERE tenant_id = :'service_tenant')
  AND NOT EXISTS (SELECT 1 FROM public.patients WHERE id = :'service_patient')
  AND NOT EXISTS (SELECT 1 FROM public.doctors WHERE id = :'service_doctor')
  AND NOT EXISTS (SELECT 1 FROM public.appointments WHERE id = :'service_appointment'),
  'service_role cleans controlled core QA fixtures'
);
RESET ROLE;

-- Unknown clinic roles remain impossible at the enum boundary.
SELECT pg_temp.expect_error(
  format('insert into public.tenant_users(tenant_id,user_id,role) values(%L::uuid,%L::uuid,%L)', :'tenant_a', :'no_tenant', 'unknown_role'),
  'invalid input value for enum app_role'
);

ROLLBACK;
\echo 'LEGACY-CORE-TABLE-GRANTS-RECOVERY-001 SQL validation passed'
