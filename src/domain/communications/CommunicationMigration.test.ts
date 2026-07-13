import { describe, expect, it } from 'vitest';
import migration from '../../../supabase/migrations/0032_communication_orchestration_foundation.sql?raw';

describe('communication orchestration migration contract', () => {
  it('creates tenant-scoped route and immutable operation foundations', () => {
    expect(migration).toContain('CREATE TABLE public.communication_routes');
    expect(migration).toContain('CREATE TABLE public.communication_operations');
    expect(migration).toContain('UNIQUE (tenant_id, operation_key)');
    expect(migration).toContain('FOREIGN KEY (tenant_id, reminder_job_id)');
    expect(migration).toContain('FOREIGN KEY (tenant_id, contact_id)');
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
  });

  it('contains only noop and mock adapter codes and simulation states', () => {
    expect(migration).toMatch(/adapter_code IN \('noop','mock'\)/);
    expect(migration).toContain("'simulation_uncertain'");
    expect(migration).not.toMatch(/adapter_code IN \([^)]*amocrm/);
    expect(migration).not.toMatch(/twilio|smtp|meta_graph|chats_api/i);
  });

  it('exposes preparation, simulation and recovery without delivery states', () => {
    expect(migration).toContain('prepare_communication_operation');
    expect(migration).toContain('simulate_communication_operation');
    expect(migration).toContain('recover_communication_operation');
    expect(migration).not.toMatch(/state IN \([^)]*'sent'/);
    expect(migration).not.toMatch(/state IN \([^)]*'delivered'/);
    expect(migration).not.toMatch(/state IN \([^)]*'replied'/);
  });

  it('contains no outbound network or provider credential surface', () => {
    expect(migration).not.toMatch(/https?:\/\//i);
    expect(migration).not.toMatch(/access_token|refresh_token|client_secret|service_role/i);
    expect(migration).not.toMatch(/net\.http|http_post|fetch\(|xhr/i);
  });

  it('keeps clinical and financial variables outside the allowlist', () => {
    expect(migration).toContain("'patient_first_name'");
    expect(migration).toContain("'appointment_date'");
    expect(migration).not.toMatch(/'diagnosis'\s*,\s*'complaint'/);
    expect(migration).not.toMatch(/'payment'\s*,\s*'balance'/);
  });
});
