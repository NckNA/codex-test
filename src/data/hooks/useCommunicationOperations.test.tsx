/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import type { AppointmentReminderQueueItem } from '../../types';
import {
  CommunicationOrchestrationRepositoryError,
  createCommunicationOrchestrationRepository,
} from '../repositories/CommunicationOrchestrationRepository';
import { useCommunicationOperations } from './useCommunicationOperations';

vi.mock('../../lib/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: {} }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../contexts/TenantContext', () => ({ useTenant: vi.fn() }));
vi.mock('../repositories/CommunicationOrchestrationRepository', async () => {
  const actual = await vi.importActual('../repositories/CommunicationOrchestrationRepository');
  return { ...actual as object, createCommunicationOrchestrationRepository: vi.fn() };
});

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';

const item = (): AppointmentReminderQueueItem => ({
  job: {
    id: 'job-a',
    tenantId: tenantA,
    appointmentId: 'appointment-a',
    patientId: 'patient-a',
    reminderType: 'confirmation_request',
    executionMode: 'manual',
    dueAt: '2026-07-13T10:00:00Z',
    originalDueAt: '2026-07-13T10:00:00Z',
    state: 'scheduled',
    operationalState: 'ready',
    appointmentUpdatedAt: 'appointment-version',
    policyVersion: 1,
    planKey: 'a'.repeat(64),
    payloadFingerprint: 'b'.repeat(64),
    priority: 100,
    createdAt: '2026-07-13T08:00:00Z',
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
  patient: { id: 'patient-a', fullName: 'Пациент', phone: '+77000000000' },
  doctor: { id: 'doctor-a', fullName: 'Врач', specialization: 'Терапевт', cabinet: '1' },
  attemptCount: 0,
});

const route = { id: 'route-a', tenantId: tenantA, channel: 'sms', adapterCode: 'mock', enabled: true, simulationOnly: true, priority: 100, configurationVersion: 1, createdAt: 'now', updatedAt: 'now' } as const;
const operation = {
  id: 'operation-a',
  tenantId: tenantA,
  reminderJobId: 'job-a',
  appointmentId: 'appointment-a',
  patientId: 'patient-a',
  contactId: 'contact-a',
  purposeCode: 'appointment_confirmation_request',
  channel: 'sms',
  language: 'ru',
  state: 'prepared',
  operationKey: 'prepare-key-a',
  payloadFingerprint: 'a'.repeat(64),
  appointmentUpdatedAt: 'appointment-version',
  reminderJobUpdatedAt: 'job-version',
  contactUpdatedAt: 'contact-version',
  policyVersion: 1,
  eligibilityVersion: 1,
  routeId: 'route-a',
  routeVersion: 1,
  adapterCode: 'mock',
  uncertain: false,
  preparedAt: '2026-07-13T12:00:00Z',
  updatedAt: 'operation-version',
  eligibilitySnapshot: {},
  consentSnapshot: {},
  suppressionSnapshot: {},
  contactSnapshot: { maskedDestination: '+7700***0000' },
  appointmentSnapshot: {},
  routeSnapshot: { simulationOnly: true },
  command: {} as any,
  metadata: {},
} as const;

const makeRepository = () => ({
  listCommunicationRoutes: vi.fn().mockResolvedValue([route]),
  upsertCommunicationRoute: vi.fn().mockResolvedValue({ route, changed: true, replayed: false }),
  disableCommunicationRoute: vi.fn().mockResolvedValue({ route: { ...route, enabled: false }, changed: true, replayed: false }),
  listCommunicationOperations: vi.fn().mockResolvedValue([]),
  getCommunicationOperation: vi.fn().mockResolvedValue(null),
  prepareCommunicationOperation: vi.fn().mockResolvedValue({ operation, replayed: false }),
  simulateCommunicationOperation: vi.fn().mockResolvedValue({ operation: { ...operation, state: 'simulation_succeeded', adapterResultCode: 'accepted' }, replayed: false }),
  recoverCommunicationOperation: vi.fn().mockResolvedValue({ operation: { ...operation, state: 'simulation_uncertain', uncertain: true }, replayed: true, recoveryOnly: true }),
});

describe('useCommunicationOperations', () => {
  let authState: any;
  let tenantState: any;
  let repository: ReturnType<typeof makeRepository>;
  let current: ReturnType<typeof useCommunicationOperations> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    authState = { authMode: 'supabase-active', user: { id: 'user-a' } };
    tenantState = { activeTenant: { tenantId: tenantA, role: 'clinic_admin', timezone: 'Asia/Almaty' } };
    repository = makeRepository();
    vi.mocked(useAuth).mockImplementation(() => authState);
    vi.mocked(useTenant).mockImplementation(() => tenantState);
    vi.mocked(createCommunicationOrchestrationRepository).mockReturnValue(repository as any);
  });

  const mount = async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const Harness = ({ tick = 0 }: { tick?: number }) => {
      void tick;
      current = useCommunicationOperations();
      return null;
    };
    await act(async () => { root.render(<Harness />); });
    return { root, Harness };
  };

  it('does not fetch without a tenant', async () => {
    tenantState = { activeTenant: null };
    const { root } = await mount();
    expect(createCommunicationOrchestrationRepository).not.toHaveBeenCalled();
    expect(current).toMatchObject({ routes: [], operations: [], loading: false });
    await act(async () => root.unmount());
  });

  it('loads safe routes and operations for an authorized tenant', async () => {
    const { root } = await mount();
    expect(repository.listCommunicationRoutes).toHaveBeenCalledTimes(1);
    expect(repository.listCommunicationOperations).toHaveBeenCalledWith(100);
    expect(current?.routes[0].adapterCode).toBe('mock');
    await act(async () => root.unmount());
  });

  it('keeps registrar read-only and blocks preparation', async () => {
    tenantState.activeTenant.role = 'registrar';
    const { root } = await mount();
    expect(current?.canRead).toBe(true);
    expect(current?.canManage).toBe(false);
    await expect(current!.prepare(item(), 'sms')).rejects.toMatchObject({ code: 'permission' });
    expect(repository.prepareCommunicationOperation).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it('prevents duplicate preparation while one request is active', async () => {
    let resolve!: (value: any) => void;
    repository.prepareCommunicationOperation.mockReturnValueOnce(new Promise((res) => { resolve = res; }));
    const { root } = await mount();
    let first!: Promise<any>;
    await act(async () => { first = current!.prepare(item(), 'sms'); });
    await expect(current!.prepare(item(), 'sms')).rejects.toMatchObject({ code: 'conflict' });
    await act(async () => { resolve({ operation, replayed: false }); await first; });
    expect(repository.prepareCommunicationOperation).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });

  it('retains an ambiguous simulation key and recovers uncertainty', async () => {
    repository.simulateCommunicationOperation.mockRejectedValueOnce(
      new CommunicationOrchestrationRepositoryError('operation_failed'),
    );
    repository.listCommunicationOperations
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...operation, state: 'simulation_uncertain', uncertain: true }]);
    const { root } = await mount();
    await act(async () => {
      const result = await current!.simulate(operation as any, 'timeout_after_acceptance');
      expect(result.operation).toMatchObject({ state: 'simulation_uncertain', uncertain: true });
    });
    expect(repository.recoverCommunicationOperation).toHaveBeenCalledWith(
      operation.id,
      expect.stringContaining('communication-simulate-'),
    );
    await act(async () => root.unmount());
  });

  it('clears state on tenant switch and ignores late tenant responses', async () => {
    let resolveA!: (value: any) => void;
    const repoA = { ...makeRepository(), listCommunicationRoutes: vi.fn(() => new Promise((res) => { resolveA = res; })) };
    const routeB = { ...route, id: 'route-b', tenantId: tenantB };
    const repoB = { ...makeRepository(), listCommunicationRoutes: vi.fn().mockResolvedValue([routeB]) };
    vi.mocked(createCommunicationOrchestrationRepository).mockImplementation(({ tenantId }) => (tenantId === tenantA ? repoA : repoB) as any);
    const { root, Harness } = await mount();

    tenantState = { activeTenant: { tenantId: tenantB, role: 'clinic_admin', timezone: 'Asia/Almaty' } };
    await act(async () => { root.render(<Harness tick={1} />); });
    await act(async () => { await Promise.resolve(); });
    expect(current?.routes).toEqual([routeB]);
    await act(async () => { resolveA([route]); });
    expect(current?.routes).toEqual([routeB]);
    expect(repoB.listCommunicationRoutes).toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});
