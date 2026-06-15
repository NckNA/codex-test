-- Migration: Harden SECURITY DEFINER RLS helper function grants
-- Filename: 0008_harden_rls_helper_function_grants.sql
-- Scope: grant-only hardening for expected RLS helper functions.

REVOKE EXECUTE ON FUNCTION public.get_user_tenants() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_tenants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_tenants() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tenants() TO service_role;

REVOKE EXECUTE ON FUNCTION public.has_tenant_role(uuid, app_role[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_tenant_role(uuid, app_role[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(uuid, app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(uuid, app_role[]) TO service_role;
