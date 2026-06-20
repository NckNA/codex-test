// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompletedServicesPanel } from './CompletedServicesPanel';
import type { CompletedService, EncounterVisitRepository } from '../../data/repositories/EncounterVisitRepository';
import type { EncounterVisitRpcClient } from '../../data/repositories/EncounterVisitRpcClient';

vi.mock('../../lib/supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: true }));

const baseService: CompletedService = {
  id: 'service-1', tenantId: 'tenant-1', patientId: 'patient-1', visitId: 'visit-1', encounterId: 'encounter-1', appointmentId: null,
  findingId: null, treatmentPlanId: 'plan-1', treatmentStageId: 'stage-1', clinicalDictionaryItemId: 'dict-1', serviceCode: 'SRV-1',
  serviceName: 'Smoke completed service', toothNumber: '16', toothSurface: 'O', quantity: 1, unitPrice: 1000,
  totalAmount: 1000, currency: 'KZT', performedBy: 'doctor-1', performedAt: '2026-06-20T08:00:00.000Z',
  status: 'completed', correctionOfId: null, correctionReason: null, voidedAt: null, voidedBy: null, archivedAt: null,
  archivedBy: null, createdBy: null, updatedBy: null, metadata: { hidden: 'metadata must not render' }, createdAt: '2026-06-20T08:00:00.000Z', updatedAt: '2026-06-20T08:00:00.000Z',
};

function createRepository(services: CompletedService[] = [baseService]): EncounterVisitRepository {
  return { listCompletedServices: vi.fn().mockResolvedValue(services) } as unknown as EncounterVisitRepository;
}

function createRpcClient(): EncounterVisitRpcClient {
  return {
    recordCompletedService: vi.fn().mockResolvedValue(baseService),
    voidCompletedService: vi.fn().mockResolvedValue({ ...baseService, status: 'voided' }),
  } as unknown as EncounterVisitRpcClient;
}

async function flush() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

describe('CompletedServicesPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  async function renderPanel({ services = [baseService], role = 'clinic_admin', tenantId = 'tenant-1', patientId = 'patient-1' }: { services?: CompletedService[]; role?: string | null; tenantId?: string | null; patientId?: string | null } = {}) {
    const repository = createRepository(services);
    const rpcClient = createRpcClient();
    await act(async () => {
      root.render(<CompletedServicesPanel tenantId={tenantId} patientId={patientId} role={role} repository={repository} rpcClient={rpcClient} />);
    });
    await flush();
    return { repository, rpcClient };
  }

  it('renders no-tenant blocked state', async () => {
    await renderPanel({ tenantId: null });
    expect(container.querySelector('[data-testid="completed-services-no-tenant"]')).not.toBeNull();
  });

  it('renders empty state and record form for admin', async () => {
    await renderPanel({ services: [], role: 'clinic_admin' });
    expect(container.querySelector('[data-testid="completed-services-empty"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="completed-service-create-form"]')).not.toBeNull();
  });

  it('renders service status, quantity, amount, date and links', async () => {
    await renderPanel();
    expect(container.querySelector('[data-testid="completed-service-status-completed"]')).not.toBeNull();
    expect(container.textContent).toContain('Smoke completed service');
    expect(container.textContent).toContain('SRV-1');
    expect(container.textContent).toContain('KZT');
    expect(container.textContent).toContain('visit-1');
    expect(container.textContent).toContain('encounter-1');
    expect(container.textContent).toContain('plan-1');
    expect(container.textContent).not.toContain('metadata must not render');
  });

  it('admin and doctor see record and void controls', async () => {
    await renderPanel({ role: 'doctor' });
    expect(container.querySelector('[data-testid="completed-service-create-form"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="completed-service-void-service-1"]')).not.toBeNull();
  });

  it('registrar does not see record or void controls but can view panel', async () => {
    const { repository } = await renderPanel({ role: 'registrar' });
    expect(repository.listCompletedServices).toHaveBeenCalled();
    expect(container.querySelector('[data-testid="completed-services-no-access"]')).toBeNull();
    expect(container.querySelector('[data-testid="completed-services-panel"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="completed-service-create-form"]')).toBeNull();
    expect(container.querySelector('[data-testid="completed-service-void-service-1"]')).toBeNull();
  });

  it('cashier does not call repository, does not see service details, and sees no-access block', async () => {
    const { repository } = await renderPanel({ role: 'cashier' });
    expect(repository.listCompletedServices).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="completed-services-no-access"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="completed-services-panel"]')).toBeNull();
    expect(container.querySelector('[data-testid="completed-service-create-form"]')).toBeNull();
    expect(container.querySelector('[data-testid="completed-service-void-service-1"]')).toBeNull();
    expect(container.textContent).not.toContain('Smoke completed service');
  });

  it('voided service hides mutation action and renders reason', async () => {
    await renderPanel({ services: [{ ...baseService, status: 'voided', correctionReason: 'Smoke void reason', voidedAt: '2026-06-20T09:00:00.000Z' }] });
    expect(container.querySelector('[data-testid="completed-service-status-voided"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="completed-service-void-service-1"]')).toBeNull();
    expect(container.textContent).toContain('Smoke void reason');
  });

  it('record form validates required fields', async () => {
    const { rpcClient } = await renderPanel({ services: [] });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="completed-service-record-submit"]')?.click();
    });
    expect(container.textContent).toContain('Название услуги обязательно.');
    expect(rpcClient.recordCompletedService).not.toHaveBeenCalled();
  });

  it('void form requires reason before submit', async () => {
    const { rpcClient } = await renderPanel();
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="completed-service-void-service-1"]')?.click();
    });
    const confirm = container.querySelector<HTMLButtonElement>('[data-testid="completed-service-void-confirm-service-1"]');
    expect(confirm?.disabled).toBe(true);
    expect(rpcClient.voidCompletedService).not.toHaveBeenCalled();
  });
});


