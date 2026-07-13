/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCommunicationOperations } from '../../data/hooks/useCommunicationOperations';
import { CommunicationOperationsPanel } from './CommunicationOperationsPanel';

vi.mock('../../data/hooks/useCommunicationOperations', () => ({
  useCommunicationOperations: vi.fn(),
}));

const item = {
  job: {
    id: 'job-a',
    tenantId: 'tenant-a',
    appointmentId: 'appointment-a',
    patientId: 'patient-a',
    reminderType: 'confirmation_request',
    executionMode: 'manual',
    dueAt: '2026-07-14T10:00:00Z',
    originalDueAt: '2026-07-14T10:00:00Z',
    state: 'scheduled',
    operationalState: 'ready',
    appointmentUpdatedAt: 'appointment-version',
    policyVersion: 1,
    planKey: 'a'.repeat(64),
    payloadFingerprint: 'b'.repeat(64),
    priority: 100,
    createdAt: '2026-07-13T10:00:00Z',
    updatedAt: 'job-version',
    metadata: {},
  },
  appointment: {
    id: 'appointment-a',
    patientId: 'patient-a',
    doctorId: 'doctor-a',
    cabinet: '1',
    service: 'Осмотр',
    start: '2026-07-20T10:00:00Z',
    end: '2026-07-20T11:00:00Z',
    status: 'new',
    createdAt: '2026-07-01T10:00:00Z',
    updatedAt: 'appointment-version',
  },
  patient: { id: 'patient-a', fullName: 'Пациент Тестовый', phone: '+77000000000' },
  doctor: { id: 'doctor-a', fullName: 'Врач Тестовый', specialization: 'Терапевт', cabinet: '1' },
  attemptCount: 0,
} as any;

const route = {
  id: 'route-a',
  tenantId: 'tenant-a',
  channel: 'sms',
  adapterCode: 'mock',
  enabled: true,
  simulationOnly: true,
  priority: 100,
  configurationVersion: 1,
  createdAt: '2026-07-13T10:00:00Z',
  updatedAt: '2026-07-13T10:00:00Z',
};

const operation = {
  id: 'operation-a',
  tenantId: 'tenant-a',
  reminderJobId: 'job-a',
  appointmentId: 'appointment-a',
  patientId: 'patient-a',
  contactId: 'contact-a',
  purposeCode: 'appointment_confirmation_request',
  channel: 'sms',
  language: 'ru',
  state: 'simulation_uncertain',
  operationKey: 'prepare-operation-a',
  payloadFingerprint: 'a'.repeat(64),
  appointmentUpdatedAt: 'appointment-version',
  reminderJobUpdatedAt: 'job-version',
  contactUpdatedAt: 'contact-version',
  policyVersion: 1,
  eligibilityVersion: 1,
  routeId: 'route-a',
  routeVersion: 1,
  adapterCode: 'mock',
  adapterResultCode: 'timeout_after_acceptance',
  uncertain: true,
  preparedAt: '2026-07-13T11:00:00Z',
  updatedAt: '2026-07-13T11:05:00Z',
  eligibilitySnapshot: {},
  consentSnapshot: {},
  suppressionSnapshot: {},
  contactSnapshot: { maskedDestination: '+7700***0000' },
  appointmentSnapshot: {},
  routeSnapshot: { simulationOnly: true },
  command: {},
  metadata: {},
};

const makeHook = (overrides: Record<string, unknown> = {}) => ({
  routes: [route],
  operations: [operation],
  loading: false,
  preparing: null,
  simulating: null,
  recovering: null,
  error: null,
  canRead: true,
  canManage: true,
  refresh: vi.fn().mockResolvedValue(undefined),
  prepare: vi.fn().mockResolvedValue({ operation, replayed: false }),
  simulate: vi.fn().mockResolvedValue({ operation, replayed: false }),
  recover: vi.fn().mockResolvedValue({ operation, replayed: true }),
  upsertRoute: vi.fn().mockResolvedValue(route),
  disableRoute: vi.fn().mockResolvedValue({ ...route, enabled: false }),
  clearError: vi.fn(),
  ...overrides,
});

const mount = async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<CommunicationOperationsPanel reminderItems={[item]} />);
  });
  return { container, root };
};

describe('CommunicationOperationsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCommunicationOperations).mockReturnValue(makeHook() as any);
  });

  it('shows an explicit simulation warning and no real-send action label', async () => {
    const { container, root } = await mount();
    expect(container.textContent).toContain('Это тестовая операция. Сообщение пациенту не отправляется.');
    expect(container.querySelector('button')?.textContent).not.toBe('Отправить');
    expect(container.textContent).not.toContain('Доставить');
    expect(container.textContent).not.toContain('Написать пациенту');
    await act(async () => root.unmount());
    container.remove();
  });

  it('shows masked destination and preserves uncertainty', async () => {
    const { container, root } = await mount();
    expect(container.textContent).toContain('+7700***0000');
    expect(container.textContent).toContain('Неопределённый результат сохраняется');
    expect(container.querySelector('[data-testid="recover-operation-a"]')).not.toBeNull();
    await act(async () => root.unmount());
    container.remove();
  });

  it('keeps registrar read-only with no prepare or simulation controls', async () => {
    vi.mocked(useCommunicationOperations).mockReturnValue(makeHook({ canManage: false }) as any);
    const { container, root } = await mount();
    expect(container.textContent).toContain('Регистратор видит готовность');
    expect(container.querySelector('[data-testid="prepare-communication-operation"]')).toBeNull();
    expect(container.querySelector('[data-testid="simulate-operation-a"]')).toBeNull();
    await act(async () => root.unmount());
    container.remove();
  });

  it('allows owner/admin to prepare a selected reminder operation', async () => {
    const hook = makeHook();
    vi.mocked(useCommunicationOperations).mockReturnValue(hook as any);
    const { container, root } = await mount();
    const jobSelect = container.querySelector('select[aria-label="Задача напоминания"]') as HTMLSelectElement;
    await act(async () => {
      jobSelect.value = 'job-a';
      jobSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const prepareButton = container.querySelector('[data-testid="prepare-communication-operation"]') as HTMLButtonElement;
    await act(async () => { prepareButton.click(); });
    expect(hook.prepare).toHaveBeenCalledWith(item, 'sms');
    await act(async () => root.unmount());
    container.remove();
  });
});
