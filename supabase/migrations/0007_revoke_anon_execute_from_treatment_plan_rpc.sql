-- Migration: Revoke anon EXECUTE from treatment plan RPC
-- Filename: 0007_revoke_anon_execute_from_treatment_plan_rpc.sql

REVOKE EXECUTE ON FUNCTION public.save_treatment_plan_with_stages(uuid, uuid, uuid, text, text, numeric, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.save_treatment_plan_with_stages(uuid, uuid, uuid, text, text, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_treatment_plan_with_stages(uuid, uuid, uuid, text, text, numeric, jsonb) TO authenticated;
