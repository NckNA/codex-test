// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VisitCheckInPanel } from './VisitCheckInPanel';
import type { EncounterVisitRepository, PatientVisit } from '../../data/repositories/EncounterVisitRepository';
import type { EncounterVisitRpcClient } from '../../data/repositories/EncounterVisitRpcClient';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {},
  isSupabaseConfigured: true,
}));

const baseVisit: PatientVisit = {
  id: 'visit-11111111',
  tenantId: 'tenant-1',
  patientId: 'patient-1',
  appointmentId: null,
  status: 'checked_in',
  visitType: 'regular',
  arrivedAt: '2026-06-20T08:00:00.000Z',
  checkedInAt: '2026-06-20T08:00:00.000Z',
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  archivedAt: null,
  createdBy: null,
  updatedBy: null,
  archivedBy: null,
  notes: 'Первичный приход',
  metadata: {},
  createdAt: '2026-06-20T08:00:00.000Z',
  updatedAt: '2026-06-20T08:00:00.000Z',
};

function createRepository(visits: PatientVisit[] = [baseVisit]): EncounterVisitRepository {
  return {
    listPatientVisits: vi.fn().mockResolvedValue(visits),
    getPatientVisitById: vi.fn(),
    listClinicalEncounters: vi.fn(),
    getClinicalEncounterById: vi.fn(),
    listCompletedServices: vi.fn(),
    getCompletedServiceById: vi.fn(),
    listPatientClinicalWorkflow: vi.fn(),
  } as EncounterVisitRepository;
}

function createRpcClient(): EncounterVisitRpcClient {
  return {
    checkInPatientVisit: vi.fn().mockResolvedValue(baseVisit),
    startPatientVisit: vi.fn().mockResolvedValue({ ...baseVisit, status: 'in_progress' }),
    completePatientVisit: vi.fn().mockResolvedValue({ ...baseVisit, status: 'completed' }),
    cancelPatientVisit: vi.fn().mockResolvedValue({ ...baseVisit, status: 'cancelled' }),
    createClinicalEncounter: vi.fn(),
    startClinicalEncounter: vi.fn(),
    completeClinicalEncounter: vi.fn(),
    recordCompletedService: vi.fn(),
    voidCompletedService: vi.fn(),
  } as EncounterVisitRpcClient;
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('VisitCheckInPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  async function renderPanel({
    visits = [baseVisit],
    role = 'clinic_admin',
    tenantId = 'tenant-1',
    patientId = 'patient-1',
  }: {
    visits?: PatientVisit[];
    role?: string | null;
    tenantId?: string | null;
    patientId?: string | null;
  } = {}) {
    const repository = createRepository(visits);
    const rpcClient = createRpcClient();

    await act(async () => {
      root.render(
        <VisitCheckInPanel
          tenantId={tenantId}
          patientId={patientId}
          role={role}
          repository={repository}
          rpcClient={rpcClient}
        />
      );
    });
    await flush();
    return { repository, rpcClient };
  }

  it('renders no-tenant blocked state', async () => {
    await renderPanel({ tenantId: null });

    expect(container.textContent).toContain('Не выбрана клиника.');
  });

  it('renders empty state and check-in form for admin', async () => {
    await renderPanel({ visits: [], role: 'clinic_admin' });

    expect(container.textContent).toContain('Визитов пока нет.');
    expect(container.textContent).toContain('Отметить приход');
    expect(container.textContent).toContain('Тип визита');
  });

  it('renders visit statuses and timestamps', async () => {
    await renderPanel();

    expect(container.textContent).toContain('Ожидает приёма');
    expect(container.textContent).toContain('Обычный');
    expect(container.textContent).toContain('Первичный приход');
    expect(container.textContent).toContain('20.06.2026');
  });

  it('shows checked-in allowed actions for admin', async () => {
    await renderPanel({ role: 'clinic_admin' });

    expect(container.textContent).toContain('Начать визит');
    expect(container.textContent).toContain('Завершить визит');
    expect(container.textContent).toContain('Отменить визит');
  });

  it('shows in-progress complete/cancel actions', async () => {
    await renderPanel({ visits: [{ ...baseVisit, status: 'in_progress', startedAt: '2026-06-20T08:30:00.000Z' }] });

    expect(container.textContent).not.toContain('Начать визит');
    expect(container.textContent).toContain('Завершить визит');
    expect(container.textContent).toContain('Отменить визит');
  });

  it('hides mutation buttons for completed and cancelled visits', async () => {
    await renderPanel({
      visits: [
        { ...baseVisit, id: 'visit-completed', status: 'completed', completedAt: '2026-06-20T09:00:00.000Z' },
        { ...baseVisit, id: 'visit-cancelled', status: 'cancelled', cancelledAt: '2026-06-20T09:00:00.000Z' },
      ],
    });

    expect(container.textContent).toContain('Визит завершён');
    expect(container.textContent).toContain('Визит отменён');
    expect(container.textContent).not.toContain('Начать визит');
    expect(container.textContent).not.toContain('Завершить визит');
    expect(container.textContent).not.toContain('Отменить визит');
  });

  it('registrar does not see complete button', async () => {
    await renderPanel({ role: 'registrar' });

    expect(container.textContent).toContain('Начать визит');
    expect(container.textContent).toContain('Отменить визит');
    expect(container.textContent).not.toContain('Завершить визит');
  });

  it('cashier sees no mutation actions', async () => {
    await renderPanel({ role: 'cashier' });

    expect(container.textContent).toContain('Для вашей роли действия с визитами недоступны.');
    expect(container.textContent).not.toContain('Начать визит');
    expect(container.textContent).not.toContain('Завершить визит');
    expect(container.textContent).not.toContain('Отменить визит');
    expect(container.textContent).not.toContain('Отметить приход');
  });

  it('check-in form calls the RPC client', async () => {
    const { rpcClient } = await renderPanel({ visits: [], role: 'clinic_admin' });
    const form = container.querySelector('form');
    expect(form).not.toBeNull();

    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(rpcClient.checkInPatientVisit).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      visitType: 'regular',
    }));
  });

  it('cancel form requires reason before enabling confirmation', async () => {
    await renderPanel({ role: 'clinic_admin' });

    const cancelButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Отменить визит');
    expect(cancelButton).toBeDefined();

    await act(async () => {
      cancelButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Причина отмены');
    const confirmButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Подтвердить отмену');
    expect(confirmButton).toBeDefined();
    expect(confirmButton?.hasAttribute('disabled')).toBe(true);
  });

  it('does not call clinical encounter or completed service RPCs from the UI', async () => {
    const { rpcClient } = await renderPanel({ role: 'clinic_admin' });
    const startButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Начать визит');

    await act(async () => {
      startButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(rpcClient.startPatientVisit).toHaveBeenCalled();
    expect(rpcClient.createClinicalEncounter).not.toHaveBeenCalled();
    expect(rpcClient.recordCompletedService).not.toHaveBeenCalled();
  });
});
