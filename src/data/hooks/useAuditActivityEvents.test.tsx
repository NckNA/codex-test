// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act, useEffect, type ReactNode } from 'react';
import {
  useAuditActivityEvents,
  type AuditActivityViewerFilters,
  type AuditActivityViewerTab,
  type UseAuditActivityEventsResult,
} from './useAuditActivityEvents';
import {
  createAuditActivityRepository,
  type ActivityEvent,
  type AuditActivityRepository,
  type AuditEvent,
} from '../repositories/AuditActivityRepository';

vi.mock('../repositories/AuditActivityRepository', async () => {
  const actual = await vi.importActual<typeof import('../repositories/AuditActivityRepository')>('../repositories/AuditActivityRepository');
  return {
    ...actual,
    createAuditActivityRepository: vi.fn(),
  };
});

const mockedCreateRepository = vi.mocked(createAuditActivityRepository);
const listActivityEvents = vi.fn<AuditActivityRepository['listActivityEvents']>();
const listAuditEvents = vi.fn<AuditActivityRepository['listAuditEvents']>();
const listPatientActivityEvents = vi.fn<AuditActivityRepository['listPatientActivityEvents']>();

const activityEvent: ActivityEvent = {
  id: 'activity-1',
  tenantId: 'tenant-1',
  patientId: 'patient-1',
  auditEventId: 'audit-1',
  actorUserId: 'actor-1',
  category: 'patient',
  type: 'patient.updated',
  title: 'Patient updated',
  description: 'Safe summary',
  sourceType: 'patient',
  sourceId: 'patient-1',
  sourceStatus: 'active',
  visibility: 'admin',
  severity: 'info',
  occurredAt: '2026-06-18T09:00:00.000Z',
  metadata: {},
  isArchived: false,
  createdAt: '2026-06-18T09:00:01.000Z',
};

const auditEvent: AuditEvent = {
  id: 'audit-1',
  tenantId: 'tenant-1',
  actorUserId: 'actor-1',
  actorRole: 'authenticated',
  actorTenantRole: 'clinic_admin',
  actorDisplayName: 'Admin',
  action: 'patient.update',
  category: 'patient',
  severity: 'info',
  targetType: 'patient',
  targetId: 'patient-1',
  patientId: 'patient-1',
  redactionLevel: 'standard',
  reason: null,
  metadata: {},
  createdAt: '2026-06-18T09:00:00.000Z',
};

interface HookProbeProps {
  tenantId?: string | null;
  role?: string | null;
  activeTab: AuditActivityViewerTab;
  filters?: AuditActivityViewerFilters;
  backendAvailable?: boolean;
  onUpdate: (result: UseAuditActivityEventsResult) => void;
}

function HookProbe({ tenantId, role, activeTab, filters, backendAvailable = true, onUpdate }: HookProbeProps) {
  const result = useAuditActivityEvents({ tenantId, role, activeTab, filters, backendAvailable });
  useEffect(() => {
    onUpdate(result);
  }, [onUpdate, result]);
  return <div>{result.activityEvents.length + result.auditEvents.length}</div>;
}

async function renderNode(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
    await Promise.resolve();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return { container, root };
}

async function unmount(root: ReturnType<typeof createRoot>, container: HTMLElement) {
  await act(async () => {
    root.unmount();
  });
  container.remove();
}

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('useAuditActivityEvents', () => {
  it('does not create repository without tenantId', async () => {
    const updates: UseAuditActivityEventsResult[] = [];

    const { root, container } = await renderNode(
      <HookProbe tenantId={null} role="clinic_admin" activeTab="activity" onUpdate={(result) => updates.push(result)} />
    );

    expect(mockedCreateRepository).not.toHaveBeenCalled();
    expect(updates.at(-1)?.isEnabled).toBe(false);
    await unmount(root, container);
  });

  it.each(['doctor', 'registrar', 'receptionist', 'cashier'])('does not query for unauthorized role %s', async (role) => {
    const { root, container } = await renderNode(
      <HookProbe tenantId="tenant-1" role={role} activeTab="activity" onUpdate={vi.fn()} />
    );

    expect(mockedCreateRepository).not.toHaveBeenCalled();
    expect(listActivityEvents).not.toHaveBeenCalled();
    expect(listAuditEvents).not.toHaveBeenCalled();
    await unmount(root, container);
  });

  it('does not query when backend is unavailable', async () => {
    const { root, container } = await renderNode(
      <HookProbe tenantId="tenant-1" role="clinic_admin" activeTab="activity" backendAvailable={false} onUpdate={vi.fn()} />
    );

    expect(mockedCreateRepository).not.toHaveBeenCalled();
    await unmount(root, container);
  });

  it('calls listActivityEvents with active tenant and filters', async () => {
    const updates: UseAuditActivityEventsResult[] = [];
    listActivityEvents.mockResolvedValue([activityEvent]);
    listAuditEvents.mockResolvedValue([]);
    mockedCreateRepository.mockReturnValue({ listActivityEvents, listAuditEvents, listPatientActivityEvents });

    const { root, container } = await renderNode(
      <HookProbe
        tenantId="tenant-1"
        role="clinic_admin"
        activeTab="activity"
        filters={{
          category: 'patient',
          severity: 'warning',
          visibility: 'admin',
          includeArchived: true,
          dateFrom: '2026-06-01',
          dateTo: '2026-06-18',
          limit: 25,
          offset: 25,
        }}
        onUpdate={(result) => updates.push(result)}
      />
    );

    expect(mockedCreateRepository).toHaveBeenCalledWith({ backend: 'supabase' });
    expect(listActivityEvents).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      categories: ['patient'],
      visibility: ['admin'],
      occurredFrom: '2026-06-01T00:00:00.000Z',
      occurredTo: '2026-06-18T23:59:59.999Z',
      includeArchived: true,
      limit: 25,
      offset: 25,
    });
    expect(updates.at(-1)?.activityEvents).toEqual([activityEvent]);
    expect(listAuditEvents).not.toHaveBeenCalled();
    await unmount(root, container);
  });

  it('calls listAuditEvents with active tenant and filters', async () => {
    const updates: UseAuditActivityEventsResult[] = [];
    listActivityEvents.mockResolvedValue([]);
    listAuditEvents.mockResolvedValue([auditEvent]);
    mockedCreateRepository.mockReturnValue({ listActivityEvents, listAuditEvents, listPatientActivityEvents });

    const { root, container } = await renderNode(
      <HookProbe
        tenantId="tenant-1"
        role="clinic_owner"
        activeTab="audit"
        filters={{
          category: 'patient',
          severity: 'critical',
          targetType: ' patient ',
          patientId: ' patient-1 ',
          actorUserId: ' actor-1 ',
          dateFrom: '2026-06-01',
          dateTo: '2026-06-18',
          limit: 100,
          offset: 0,
        }}
        onUpdate={(result) => updates.push(result)}
      />
    );

    expect(listAuditEvents).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      categories: ['patient'],
      severities: ['critical'],
      targetType: 'patient',
      patientId: 'patient-1',
      actorUserId: 'actor-1',
      createdFrom: '2026-06-01T00:00:00.000Z',
      createdTo: '2026-06-18T23:59:59.999Z',
      limit: 100,
      offset: 0,
    });
    expect(updates.at(-1)?.auditEvents).toEqual([auditEvent]);
    expect(listActivityEvents).not.toHaveBeenCalled();
    await unmount(root, container);
  });

  it('surfaces repository errors', async () => {
    const updates: UseAuditActivityEventsResult[] = [];
    const failure = new Error('Repository failed');
    listActivityEvents.mockRejectedValue(failure);
    mockedCreateRepository.mockReturnValue({ listActivityEvents, listAuditEvents, listPatientActivityEvents });

    const { root, container } = await renderNode(
      <HookProbe tenantId="tenant-1" role="clinic_admin" activeTab="activity" onUpdate={(result) => updates.push(result)} />
    );

    expect(updates.at(-1)?.isError).toBe(true);
    expect(updates.at(-1)?.error?.message).toBe('Repository failed');
    await unmount(root, container);
  });

  it('never calls patient timeline activity helper or raw write methods', async () => {
    listActivityEvents.mockResolvedValue([]);
    listAuditEvents.mockResolvedValue([]);
    mockedCreateRepository.mockReturnValue({ listActivityEvents, listAuditEvents, listPatientActivityEvents });

    const { root, container } = await renderNode(
      <HookProbe tenantId="tenant-1" role="clinic_admin" activeTab="activity" onUpdate={vi.fn()} />
    );

    expect(listPatientActivityEvents).not.toHaveBeenCalled();
    expect(Object.keys(mockedCreateRepository.mock.results[0]?.value ?? {})).toEqual([
      'listActivityEvents',
      'listAuditEvents',
      'listPatientActivityEvents',
    ]);
    await unmount(root, container);
  });
});
