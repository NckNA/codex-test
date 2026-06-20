// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClinicalEncounterPanel } from './ClinicalEncounterPanel';
import type { ClinicalEncounter, EncounterVisitRepository } from '../../data/repositories/EncounterVisitRepository';
import type { EncounterVisitRpcClient } from '../../data/repositories/EncounterVisitRpcClient';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {},
  isSupabaseConfigured: true,
}));

const baseEncounter: ClinicalEncounter = {
  id: 'encounter-1',
  tenantId: 'tenant-1',
  patientId: 'patient-1',
  visitId: 'visit-1',
  appointmentId: null,
  doctorUserId: 'doctor-1',
  status: 'draft',
  encounterType: 'consultation',
  startedAt: null,
  completedAt: null,
  lockedAt: null,
  archivedAt: null,
  createdBy: null,
  updatedBy: null,
  lockedBy: null,
  archivedBy: null,
  chiefComplaintSnapshot: 'Боль при накусывании',
  clinicalSummary: null,
  correctionReason: null,
  metadata: {},
  createdAt: '2026-06-20T08:00:00.000Z',
  updatedAt: '2026-06-20T08:00:00.000Z',
};

function createRepository(encounters: ClinicalEncounter[] = [baseEncounter]): EncounterVisitRepository {
  return {
    listClinicalEncounters: vi.fn().mockResolvedValue(encounters),
  } as unknown as EncounterVisitRepository;
}

function createRpcClient(): EncounterVisitRpcClient {
  return {
    createClinicalEncounter: vi.fn().mockResolvedValue(baseEncounter),
    startClinicalEncounter: vi.fn().mockResolvedValue({ ...baseEncounter, status: 'in_progress' }),
    completeClinicalEncounter: vi.fn().mockResolvedValue({ ...baseEncounter, status: 'completed' }),
  } as unknown as EncounterVisitRpcClient;
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('ClinicalEncounterPanel', () => {
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
    encounters = [baseEncounter],
    role = 'clinic_admin',
    tenantId = 'tenant-1',
    patientId = 'patient-1',
  }: {
    encounters?: ClinicalEncounter[];
    role?: string | null;
    tenantId?: string | null;
    patientId?: string | null;
  } = {}) {
    const repository = createRepository(encounters);
    const rpcClient = createRpcClient();

    await act(async () => {
      root.render(
        <ClinicalEncounterPanel
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

    expect(container.querySelector('[data-testid="clinical-encounter-no-tenant"]')).not.toBeNull();
    expect(container.textContent).toContain('Не выбрана клиника.');
  });

  it('renders empty state and create form for admin', async () => {
    await renderPanel({ encounters: [], role: 'clinic_admin' });

    expect(container.querySelector('[data-testid="clinical-encounter-empty"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="clinical-encounter-create-form"]')).not.toBeNull();
    expect(container.textContent).toContain('Создать приём');
  });

  it('renders encounter statuses and timestamps', async () => {
    await renderPanel();

    expect(container.querySelector('[data-testid="encounter-status-draft"]')).not.toBeNull();
    expect(container.textContent).toContain('Боль при накусывании');
    expect(container.textContent).toContain('20.06.2026');
  });

  it('draft encounter shows start and complete actions for admin', async () => {
    await renderPanel({ role: 'clinic_admin' });

    expect(container.querySelector('[data-testid="encounter-start-encounter-1"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="encounter-complete-encounter-1"]')).not.toBeNull();
  });

  it('in-progress encounter shows complete action', async () => {
    await renderPanel({ encounters: [{ ...baseEncounter, status: 'in_progress', startedAt: '2026-06-20T08:30:00.000Z' }] });

    expect(container.querySelector('[data-testid="encounter-start-encounter-1"]')).toBeNull();
    expect(container.querySelector('[data-testid="encounter-complete-encounter-1"]')).not.toBeNull();
  });

  it('completed encounter hides mutation actions', async () => {
    await renderPanel({ encounters: [{ ...baseEncounter, status: 'completed', completedAt: '2026-06-20T09:00:00.000Z' }] });

    expect(container.querySelector('[data-testid="encounter-status-completed"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="encounter-start-encounter-1"]')).toBeNull();
    expect(container.querySelector('[data-testid="encounter-complete-encounter-1"]')).toBeNull();
  });

  it('registrar does not see mutation controls', async () => {
    await renderPanel({ role: 'registrar' });

    expect(container.querySelector('[data-testid="clinical-encounter-readonly"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="clinical-encounter-create-form"]')).toBeNull();
    expect(container.querySelector('[data-testid="encounter-start-encounter-1"]')).toBeNull();
    expect(container.querySelector('[data-testid="encounter-complete-encounter-1"]')).toBeNull();
  });

  it('cashier does not see mutation controls', async () => {
    await renderPanel({ role: 'cashier' });

    expect(container.querySelector('[data-testid="clinical-encounter-readonly"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="clinical-encounter-create-form"]')).toBeNull();
  });

  it('create form validates required chief complaint', async () => {
    await renderPanel({ encounters: [], role: 'clinic_admin' });
    const form = container.querySelector('form');

    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain('Укажите жалобу или причину приёма.');
  });

  it('complete form requires summary before confirmation', async () => {
    await renderPanel({ role: 'clinic_admin' });
    const completeButton = container.querySelector('[data-testid="encounter-complete-encounter-1"]') as HTMLButtonElement;

    await act(async () => {
      completeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const confirmButton = container.querySelector('[data-testid="encounter-complete-confirm-encounter-1"]') as HTMLButtonElement;
    expect(confirmButton).not.toBeNull();
    expect(confirmButton.hasAttribute('disabled')).toBe(true);
  });

  it('does not render forbidden adjacent workflow labels', async () => {
    await renderPanel({ role: 'clinic_admin' });

    expect(container.textContent).not.toContain('Оплата');
    expect(container.textContent).not.toContain('Склад');
    expect(container.textContent).not.toContain('Документы');
  });
});
