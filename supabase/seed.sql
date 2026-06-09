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

INSERT INTO public.patients (id, tenant_id, full_name, phone, source)
VALUES
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'John Doe', '+15550100', 'phone'),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Jane Smith', '+15550200', 'phone')
ON CONFLICT DO NOTHING;

INSERT INTO public.doctors (id, tenant_id, full_name, specialization, cabinet, color, active)
VALUES
  ('66666666-6666-4666-8666-666666666661', '11111111-1111-1111-1111-111111111111', 'Иванова Е.С. (Supabase)', 'Хирург-имплантолог', 'Каб. 1', 'blue', true),
  ('66666666-6666-4666-8666-666666666662', '11111111-1111-1111-1111-111111111111', 'Смирнов А.В. (Supabase)', 'Терапевт', 'Каб. 2', 'indigo', true),
  ('66666666-6666-4666-8666-666666666663', '11111111-1111-1111-1111-111111111111', 'Петров Д.Н. (Supabase)', 'Ортодонт', 'Каб. 3', 'emerald', true),
  ('66666666-6666-4666-8666-666666666664', '11111111-1111-1111-1111-111111111111', 'Сидорова О.П. (Supabase)', 'Гигиенист', 'Каб. 4', 'purple', true),
  ('66666666-6666-4666-8666-666666666665', '11111111-1111-1111-1111-111111111111', 'Кузнецов И.М. (Supabase)', 'Ортопед', 'Каб. 5', 'amber', true)
ON CONFLICT DO NOTHING;
