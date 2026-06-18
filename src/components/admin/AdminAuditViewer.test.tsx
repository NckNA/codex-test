// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AdminAuditViewer } from './AdminAuditViewer';
import { AdminAuditPage } from '../../pages/AdminAuditPage';
import { Sidebar } from '../layout/Sidebar';
import * as AuthContextModule from '../../contexts/AuthContext';
import * as TenantContextModule from '../../contexts/TenantContext';
import {
  canViewAdminAudit,
  useAuditActivityEvents,
  type UseAuditActivityEventsResult,
} from '../../data/hooks/useAuditActivityEvents';
import type { ActivityEvent, AuditEvent } from '../../data/repositories/AuditActivityRepository';

vi.mock('../../data/hooks/useAuditActivityEvents', async () => {
  const actual = await vi.importActual<typeof import('../../data/hooks/useAuditActivityEvents')>('../../data/hooks/useAuditActivityEvents');
  return {
    ...actual,
    useAuditActivityEvents: vi.fn(),
  };
});

const mockedUseAuditActivityEvents = vi.mocked(useAuditActivityEvents);

function defaultHookResult(overrides: Partial<UseAuditActivityEventsResult> = {}): UseAuditActivityEventsResult {
  return {
    activityEvents: [],
    auditEvents: [],
    isLoading: false,
    isError: false,
    error: null,
    refresh: vi.fn(async () => undefined),
    isEnabled: true,
    ...overrides,
  };
}

const activityEvent: ActivityEvent = {
  id: 'activity-1',
  tenantId: 'tenant-1',
  patientId: 'patient-1',
  auditEventId: 'audit-hidden-id',
  actorUserId: 'actor-1',
  category: 'patient',
  type: 'patient.updated',
  title: 'Пациент обновлён',
  description: 'Изменены безопасные поля карточки',
  sourceType: 'patient',
  sourceId: 'patient-1',
  sourceStatus: 'active',
  visibility: 'admin',
  severity: 'info',
  occurredAt: '2026-06-18T09:00:00.000Z',
  metadata: { shouldNotRender: 'metadata-secret-value' },
  isArchived: false,
  createdAt: '2026-06-18T09:00:01.000Z',
};

const auditEvent: AuditEvent = {
  id: 'audit-1',
  tenantId: 'tenant-1',
  actorUserId: 'actor-2',
  actorRole: 'authenticated',
  actorTenantRole: 'clinic_admin',
  actorDisplayName: 'Admin User',
  action: 'patient.update',
  category: 'patient',
  severity: 'warning',
  targetType: 'patient',
  targetId: 'patient-1',
  patientId: 'patient-1',
  beforeData: { shouldNotRender: 'before-secret-value' },
  afterData: { shouldNotRender: 'after-secret-value' },
  diffData: { shouldNotRender: 'diff-secret-value' },
  redactionLevel: 'standard',
  reason: 'Проверка доступа',
  metadata: { shouldNotRender: 'audit-metadata-secret-value' },
  createdAt: '2026-06-18T10:00:00.000Z',
  appointmentId: null,
  visitId: null,
  encounterId: null,
  treatmentPlanId: null,
  treatmentStageId: null,
  findingId: null,
  fileId: null,
  paymentId: null,
  stockMovementId: null,
  requestId: null,
  sessionId: null,
  ipAddress: null,
  userAgent: null,
};

const mockUseAuth = (overrides: Partial<ReturnType<typeof AuthContextModule.useAuth>> = {}) => {
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
    user: { id: 'user-1', email: 'admin@example.com' },
    isLoading: false,
    error: null,
    authMode: 'supabase-active',
    signIn: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  });
};

const mockUseTenant = (role: string | null, tenantId = 'tenant-1') => {
  vi.spyOn(TenantContextModule, 'useTenant').mockReturnValue({
    activeTenant: tenantId ? { tenantId, tenantName: 'Clinic', role: role ?? undefined } : null,
    availableTenants: tenantId ? [{ tenantId, tenantName: 'Clinic', role: role ?? undefined }] : [],
    setActiveTenant: vi.fn(),
    isLoading: false,
    error: null,
  });
};

async function renderNode(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
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
  vi.restoreAllMocks();
  mockedUseAuditActivityEvents.mockReset();
  document.body.innerHTML = '';
});

describe('admin audit access helpers', () => {
  it.each(['clinic_owner', 'clinic_admin'])('allows %s', (role) => {
    expect(canViewAdminAudit(role)).toBe(true);
  });

  it.each(['doctor', 'registrar', 'receptionist', 'cashier', null, undefined, 'platform_admin'])('blocks %s', (role) => {
    expect(canViewAdminAudit(role)).toBe(false);
  });
});

describe('AdminAuditPage access guard', () => {
  it.each(['clinic_owner', 'clinic_admin'])('renders viewer for %s', async (role) => {
    mockUseAuth();
    mockUseTenant(role);
    mockedUseAuditActivityEvents.mockReturnValue(defaultHookResult({ activityEvents: [activityEvent] }));

    const { container, root } = await renderNode(<AdminAuditPage />);

    expect(container.textContent).toContain('Журнал действий');
    expect(mockedUseAuditActivityEvents).toHaveBeenCalled();

    await unmount(root, container);
  });

  it.each(['doctor', 'registrar', 'receptionist', 'cashier'])('blocks %s and does not query repository hook', async (role) => {
    mockUseAuth();
    mockUseTenant(role);
    mockedUseAuditActivityEvents.mockReturnValue(defaultHookResult());

    const { container, root } = await renderNode(<AdminAuditPage />);

    expect(container.textContent).toContain('Доступ запрещён');
    expect(mockedUseAuditActivityEvents).not.toHaveBeenCalled();

    await unmount(root, container);
  });

  it('blocks no-tenant state and does not query repository hook', async () => {
    mockUseAuth();
    mockUseTenant(null, '');
    mockedUseAuditActivityEvents.mockReturnValue(defaultHookResult());

    const { container, root } = await renderNode(<AdminAuditPage />);

    expect(container.textContent).toContain('Клиника не назначена');
    expect(mockedUseAuditActivityEvents).not.toHaveBeenCalled();

    await unmount(root, container);
  });
});

describe('AdminAuditViewer rendering and filters', () => {
  it('renders activity safe fields without dumping metadata JSON or opaque audit id', async () => {
    mockedUseAuditActivityEvents.mockReturnValue(defaultHookResult({ activityEvents: [activityEvent] }));

    const { container, root } = await renderNode(<AdminAuditViewer tenantId="tenant-1" role="clinic_admin" />);

    expect(container.textContent).toContain('Пациент обновлён');
    expect(container.textContent).toContain('Изменены безопасные поля карточки');
    expect(container.textContent).toContain('patient.updated');
    expect(container.textContent).not.toContain('metadata-secret-value');
    expect(container.textContent).not.toContain('audit-hidden-id');

    await unmount(root, container);
  });

  it('renders audit safe fields without dumping before/after/diff/metadata JSON', async () => {
    mockedUseAuditActivityEvents
      .mockReturnValueOnce(defaultHookResult({ activityEvents: [activityEvent] }))
      .mockReturnValue(defaultHookResult({ auditEvents: [auditEvent] }));

    const { container, root } = await renderNode(<AdminAuditViewer tenantId="tenant-1" role="clinic_admin" />);
    const auditTab = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Аудит');

    await act(async () => {
      auditTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('patient.update');
    expect(container.textContent).toContain('Admin User');
    expect(container.textContent).toContain('Проверка доступа');
    expect(container.textContent).not.toContain('before-secret-value');
    expect(container.textContent).not.toContain('after-secret-value');
    expect(container.textContent).not.toContain('diff-secret-value');
    expect(container.textContent).not.toContain('audit-metadata-secret-value');

    await unmount(root, container);
  });

  it('renders loading, empty, and error states', async () => {
    mockedUseAuditActivityEvents.mockReturnValue(defaultHookResult({ isLoading: true }));
    const loading = await renderNode(<AdminAuditViewer tenantId="tenant-1" role="clinic_admin" />);
    expect(loading.container.textContent).toContain('Загрузка журнала');
    await unmount(loading.root, loading.container);

    mockedUseAuditActivityEvents.mockReturnValue(defaultHookResult());
    const empty = await renderNode(<AdminAuditViewer tenantId="tenant-1" role="clinic_admin" />);
    expect(empty.container.textContent).toContain('Событий по выбранным фильтрам нет');
    await unmount(empty.root, empty.container);

    mockedUseAuditActivityEvents.mockReturnValue(defaultHookResult({ error: new Error('RLS failed'), isError: true }));
    const error = await renderNode(<AdminAuditViewer tenantId="tenant-1" role="clinic_admin" />);
    expect(error.container.textContent).toContain('Не удалось загрузить журнал');
    expect(error.container.textContent).toContain('RLS failed');
    await unmount(error.root, error.container);
  });

  it('passes activity filters to hook', async () => {
    mockedUseAuditActivityEvents.mockReturnValue(defaultHookResult({ activityEvents: [activityEvent] }));
    const { container, root } = await renderNode(<AdminAuditViewer tenantId="tenant-1" role="clinic_admin" />);

    const selects = Array.from(container.querySelectorAll('select'));
    await act(async () => {
      selects[0].value = 'patient';
      selects[0].dispatchEvent(new Event('change', { bubbles: true }));
      selects[1].value = 'warning';
      selects[1].dispatchEvent(new Event('change', { bubbles: true }));
      selects[2].value = 'clinical';
      selects[2].dispatchEvent(new Event('change', { bubbles: true }));
    });

    const latestCall = mockedUseAuditActivityEvents.mock.calls.at(-1)?.[0];
    expect(latestCall).toMatchObject({
      tenantId: 'tenant-1',
      role: 'clinic_admin',
      activeTab: 'activity',
      filters: expect.objectContaining({ category: 'patient', severity: 'warning', visibility: 'clinical' }),
    });

    await unmount(root, container);
  });

  it('passes audit filters to hook and paginates', async () => {
    mockedUseAuditActivityEvents
      .mockReturnValueOnce(defaultHookResult({ activityEvents: [activityEvent] }))
      .mockReturnValue(defaultHookResult({ auditEvents: Array.from({ length: 50 }, (_, index) => ({ ...auditEvent, id: `audit-${index}` })) }));

    const { container, root } = await renderNode(<AdminAuditViewer tenantId="tenant-1" role="clinic_admin" />);
    const auditTab = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Аудит');

    await act(async () => {
      auditTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const selects = Array.from(container.querySelectorAll('select'));
    const targetTypeInput = container.querySelector('input[placeholder="patient, file..."]') as HTMLInputElement;
    const patientIdInput = container.querySelector('input[placeholder="UUID пациента"]') as HTMLInputElement;
    const actorUserIdInput = container.querySelector('input[placeholder="UUID пользователя"]') as HTMLInputElement;
    await act(async () => {
      selects[0].value = 'patient';
      selects[0].dispatchEvent(new Event('change', { bubbles: true }));
      targetTypeInput.value = 'patient';
      targetTypeInput.dispatchEvent(new Event('input', { bubbles: true }));
      targetTypeInput.dispatchEvent(new Event('change', { bubbles: true }));
      patientIdInput.value = 'patient-1';
      patientIdInput.dispatchEvent(new Event('input', { bubbles: true }));
      patientIdInput.dispatchEvent(new Event('change', { bubbles: true }));
      actorUserIdInput.value = 'actor-2';
      actorUserIdInput.dispatchEvent(new Event('input', { bubbles: true }));
      actorUserIdInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const nextButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Далее');
    await act(async () => {
      nextButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const latestCall = mockedUseAuditActivityEvents.mock.calls.at(-1)?.[0];
    expect(latestCall).toMatchObject({
      activeTab: 'audit',
      filters: expect.objectContaining({
        category: 'patient',
        limit: 50,
        offset: 50,
      }),
    });

    await unmount(root, container);
  });

  it('does not render an unavailable backend as data table', async () => {
    mockedUseAuditActivityEvents.mockReturnValue(defaultHookResult({ isEnabled: false }));

    const { container, root } = await renderNode(<AdminAuditViewer tenantId="tenant-1" role="clinic_admin" backendAvailable={false} />);

    expect(container.textContent).toContain('Журнал недоступен');

    await unmount(root, container);
  });
});

describe('Sidebar admin audit navigation', () => {
  it.each(['clinic_owner', 'clinic_admin'])('shows nav item for %s', async (role) => {
    mockUseTenant(role);
    const { container, root } = await renderNode(<MemoryRouter><Sidebar /></MemoryRouter>);

    expect(container.textContent).toContain('Журнал действий');

    await unmount(root, container);
  });

  it.each(['doctor', 'registrar', 'receptionist', 'cashier', null])('hides nav item for %s', async (role) => {
    mockUseTenant(role);
    const { container, root } = await renderNode(<MemoryRouter><Sidebar /></MemoryRouter>);

    expect(container.textContent).not.toContain('Журнал действий');

    await unmount(root, container);
  });
});
