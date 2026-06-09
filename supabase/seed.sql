-- Mock Seed Data
-- Note: users are not inserted directly into auth.users here as they require secure auth flow.
-- Profiles and tenant_users will rely on mock IDs for local DB seeding if we want to run queries,
-- but usually, the first user is created via the Supabase Studio / Signup page.

INSERT INTO public.tenants (id, name, status) 
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Demo Clinic A', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Demo Clinic B', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO public.subscriptions (id, tenant_id, status)
VALUES
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO public.patients (id, tenant_id, first_name, last_name, phone)
VALUES
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'John', 'Doe', '+15550100'),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Jane', 'Smith', '+15550200')
ON CONFLICT DO NOTHING;
