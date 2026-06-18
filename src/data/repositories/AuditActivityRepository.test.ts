import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ACTIVE_CLINIC_REQUIRED_FOR_AUDIT_ACTIVITY_ERROR,
  MAX_AUDIT_ACTIVITY_LIMIT,
  SupabaseAuditActivityRepository,
  createAuditActivityRepository,
  mapActivityEventRow,
  mapAuditEventRow,
  normalizeAuditActivityLimit,
  normalizeAuditActivityOffset,
  type AuditActivityRepository,
} from './AuditActivityRepository';

type QueryResult = {
  data: Record<string, unknown>[] | null;
  error: Error | null;
};

type QueryCall = {
  method: string;
  args: unknown[];
};

type QueryChain = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
};

function createQuery(result: QueryResult) {
  const calls: QueryCall[] = [];
  let chain: QueryChain;
  const record = (method: string, args: unknown[]) => {
    calls.push({ method, args });
    return chain;
  };

  chain = {
    select: vi.fn((...args: unknown[]) => record('select', args)),
    eq: vi.fn((...args: unknown[]) => record('eq', args)),
    in: vi.fn((...args: unknown[]) => record('in', args)),
    gte: vi.fn((...args: unknown[]) => record('gte', args)),
    lte: vi.fn((...args: unknown[]) => record('lte', args)),
    order: vi.fn((...args: unknown[]) => record('order', args)),
    range: vi.fn(async (...args: unknown[]) => {
      calls.push({ method: 'range', args });
      return result;
    }),
  };

  return { chain, calls };
}

function createRepository(result: QueryResult) {
  const query = createQuery(result);
  const client = {
    from: vi.fn(() => query.chain),
  };
  const repository = new SupabaseAuditActivityRepository(client as unknown as SupabaseClient);
  return { repository, client, calls: query.calls };
}

const tenantId = '11111111-1111-1111-1111-111111111111';
const patientId = '22222222-2222-2222-2222-222222222222';

const auditRow = {
  id: 'audit-1',
  tenant_id: tenantId,
  actor_user_id: 'user-1',
  actor_role: 'authenticated',
  actor_tenant_role: 'clinic_admin',
  actor_display_name: 'Admin',
  action: 'update',
  category: 'patient',
  severity: 'warning',
  target_type: 'patient',
  target_id: patientId,
  patient_id: patientId,
  appointment_id: 'appointment-1',
  visit_id: '33333333-3333-3333-3333-333333333333',
  encounter_id: '44444444-4444-4444-4444-444444444444',
  treatment_plan_id: 'plan-1',
  treatment_stage_id: 'stage-1',
  finding_id: 'finding-1',
  file_id: 'file-1',
  payment_id: 'payment-1',
  stock_movement_id: 'stock-1',
  before_data: { old: 'value' },
  after_data: { next: 'value' },
  diff_data: { changed: true },
  redaction_level: 'restricted',
  reason: 'correction',
  request_id: 'request-1',
  session_id: 'session-1',
  ip_address: '127.0.0.1',
  user_agent: 'vitest',
  metadata: { source: 'test' },
  created_at: '2026-06-18T08:00:00Z',
};

const activityRow = {
  id: 'activity-1',
  tenant_id: tenantId,
  patient_id: patientId,
  audit_event_id: 'audit-1',
  actor_user_id: 'user-1',
  category: 'finding',
  type: 'finding_updated',
  title: 'Находка обновлена',
  description: 'Описание',
  source_type: 'finding',
  source_id: 'finding-1',
  source_status: 'monitoring',
  visibility: 'clinical',
  severity: 'info',
  occurred_at: '2026-06-18T09:00:00Z',
  metadata: { toothId: '16' },
  is_archived: false,
  created_at: '2026-06-18T09:01:00Z',
};

function expectCall(calls: QueryCall[], method: string, ...args: unknown[]) {
  expect(calls).toContainEqual({ method, args });
}

describe('AuditActivityRepository', () => {
  it('listAuditEvents requires tenantId', async () => {
    const { repository } = createRepository({ data: [], error: null });
    await expect(repository.listAuditEvents({ tenantId: '' })).rejects.toThrow(ACTIVE_CLINIC_REQUIRED_FOR_AUDIT_ACTIVITY_ERROR);
  });

  it('listActivityEvents requires tenantId', async () => {
    const { repository } = createRepository({ data: [], error: null });
    await expect(repository.listActivityEvents({ tenantId: '' })).rejects.toThrow(ACTIVE_CLINIC_REQUIRED_FOR_AUDIT_ACTIVITY_ERROR);
  });

  it('listPatientActivityEvents requires tenantId and patientId', async () => {
    const { repository } = createRepository({ data: [], error: null });
    await expect(repository.listPatientActivityEvents({ tenantId: '', patientId })).rejects.toThrow(ACTIVE_CLINIC_REQUIRED_FOR_AUDIT_ACTIVITY_ERROR);
    await expect(repository.listPatientActivityEvents({ tenantId, patientId: '' })).rejects.toThrow('Patient is required for patient activity access.');
  });

  it('listAuditEvents queries audit_events with tenant and optional filters', async () => {
    const { repository, client, calls } = createRepository({ data: [auditRow], error: null });

    const events = await repository.listAuditEvents({
      tenantId,
      categories: ['patient', 'finding'],
      severities: ['warning'],
      targetType: 'patient',
      targetId: patientId,
      patientId,
      actorUserId: 'user-1',
      createdFrom: '2026-06-01T00:00:00Z',
      createdTo: '2026-06-30T00:00:00Z',
      limit: 500,
      offset: 5,
    });

    expect(client.from).toHaveBeenCalledWith('audit_events');
    expectCall(calls, 'select', '*');
    expectCall(calls, 'eq', 'tenant_id', tenantId);
    expectCall(calls, 'in', 'category', ['patient', 'finding']);
    expectCall(calls, 'in', 'severity', ['warning']);
    expectCall(calls, 'eq', 'target_type', 'patient');
    expectCall(calls, 'eq', 'target_id', patientId);
    expectCall(calls, 'eq', 'patient_id', patientId);
    expectCall(calls, 'eq', 'actor_user_id', 'user-1');
    expectCall(calls, 'gte', 'created_at', '2026-06-01T00:00:00Z');
    expectCall(calls, 'lte', 'created_at', '2026-06-30T00:00:00Z');
    expectCall(calls, 'order', 'created_at', { ascending: false });
    expectCall(calls, 'range', 5, 204);
    expect(events[0]).toMatchObject({ id: 'audit-1', tenantId, category: 'patient', beforeData: { old: 'value' } });
  });

  it('listActivityEvents queries activity_events with tenant, visibility, source, date, and archived filters', async () => {
    const { repository, client, calls } = createRepository({ data: [activityRow], error: null });

    const events = await repository.listActivityEvents({
      tenantId,
      patientId,
      categories: ['finding'],
      visibility: ['clinical', 'admin'],
      sourceType: 'finding',
      sourceId: 'finding-1',
      occurredFrom: '2026-06-01T00:00:00Z',
      occurredTo: '2026-06-30T00:00:00Z',
      limit: 25,
      offset: 10,
    });

    expect(client.from).toHaveBeenCalledWith('activity_events');
    expectCall(calls, 'eq', 'tenant_id', tenantId);
    expectCall(calls, 'eq', 'patient_id', patientId);
    expectCall(calls, 'eq', 'is_archived', false);
    expectCall(calls, 'in', 'category', ['finding']);
    expectCall(calls, 'in', 'visibility', ['clinical', 'admin']);
    expectCall(calls, 'eq', 'source_type', 'finding');
    expectCall(calls, 'eq', 'source_id', 'finding-1');
    expectCall(calls, 'gte', 'occurred_at', '2026-06-01T00:00:00Z');
    expectCall(calls, 'lte', 'occurred_at', '2026-06-30T00:00:00Z');
    expectCall(calls, 'order', 'occurred_at', { ascending: false });
    expectCall(calls, 'order', 'created_at', { ascending: false });
    expectCall(calls, 'range', 10, 34);
    expect(events[0]).toMatchObject({ id: 'activity-1', tenantId, patientId, metadata: { toothId: '16' } });
  });

  it('listActivityEvents includes archived records only when requested', async () => {
    const active = createRepository({ data: [], error: null });
    await active.repository.listActivityEvents({ tenantId });
    expectCall(active.calls, 'eq', 'is_archived', false);

    const archived = createRepository({ data: [], error: null });
    await archived.repository.listActivityEvents({ tenantId, includeArchived: true });
    expect(archived.calls).not.toContainEqual({ method: 'eq', args: ['is_archived', false] });
  });

  it('listPatientActivityEvents filters by tenant_id and patient_id', async () => {
    const { repository, calls } = createRepository({ data: [activityRow], error: null });
    await repository.listPatientActivityEvents({ tenantId, patientId, categories: ['finding'], visibility: ['clinical'], includeArchived: true });

    expectCall(calls, 'eq', 'tenant_id', tenantId);
    expectCall(calls, 'eq', 'patient_id', patientId);
    expectCall(calls, 'in', 'category', ['finding']);
    expectCall(calls, 'in', 'visibility', ['clinical']);
    expect(calls).not.toContainEqual({ method: 'eq', args: ['is_archived', false] });
  });

  it('surfaces Supabase errors', async () => {
    const error = new Error('RLS denied');
    const { repository } = createRepository({ data: null, error });
    await expect(repository.listAuditEvents({ tenantId })).rejects.toThrow('RLS denied');
  });

  it('mappers convert snake_case rows to camelCase and default metadata', () => {
    const audit = mapAuditEventRow({ ...auditRow, metadata: null, before_data: { safe: true }, after_data: { safe: false }, diff_data: { field: ['a', 'b'] } });
    expect(audit).toMatchObject({ actorUserId: 'user-1', actorTenantRole: 'clinic_admin', targetType: 'patient', redactionLevel: 'restricted', metadata: {} });
    expect(audit.beforeData).toEqual({ safe: true });
    expect(audit.afterData).toEqual({ safe: false });
    expect(audit.diffData).toEqual({ field: ['a', 'b'] });

    const activity = mapActivityEventRow({ ...activityRow, metadata: undefined, is_archived: true });
    expect(activity).toMatchObject({ auditEventId: 'audit-1', sourceStatus: 'monitoring', isArchived: true, metadata: {} });
  });

  it('normalizes limit and offset safely', () => {
    expect(normalizeAuditActivityLimit()).toBe(50);
    expect(normalizeAuditActivityLimit(0)).toBe(1);
    expect(normalizeAuditActivityLimit(999)).toBe(MAX_AUDIT_ACTIVITY_LIMIT);
    expect(normalizeAuditActivityOffset()).toBe(0);
    expect(normalizeAuditActivityOffset(-5)).toBe(0);
    expect(normalizeAuditActivityOffset(2.9)).toBe(2);
  });

  it('factory creates only Supabase read repository and does not expose write methods', () => {
    const client = { from: vi.fn() } as unknown as SupabaseClient;
    const repository: AuditActivityRepository = createAuditActivityRepository({ backend: 'supabase', client });

    expect(repository).toBeInstanceOf(SupabaseAuditActivityRepository);
    expect('createAuditEvent' in repository).toBe(false);
    expect('createActivityEvent' in repository).toBe(false);
    expect('updateAuditEvent' in repository).toBe(false);
    expect('deleteAuditEvent' in repository).toBe(false);
  });
});
