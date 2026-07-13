import { describe, expect, it, vi } from 'vitest';
import { MockCommunicationAdapter } from './adapters/MockCommunicationAdapter';
import { NoopCommunicationAdapter } from './adapters/NoopCommunicationAdapter';
import type { CommunicationCommand } from './CommunicationCommand';

const command: CommunicationCommand = {
  tenantId: 'tenant-a',
  operationId: 'operation-a',
  reminderJobId: 'job-a',
  appointmentId: 'appointment-a',
  patientId: 'patient-a',
  contactId: 'contact-a',
  purposeCode: 'appointment_confirmation_request',
  channel: 'sms',
  language: 'ru',
  maskedDestination: '+7700***4567',
  destinationFingerprint: 'b'.repeat(64),
  operationKey: 'communication-operation-a',
  variables: { patient_first_name: 'Анна' },
  requestedAt: '2026-07-13T12:00:00.000Z',
};

describe.each([
  ['noop', new NoopCommunicationAdapter()],
  ['mock', new MockCommunicationAdapter()],
] as const)('%s communication adapter', (_name, adapter) => {
  it('performs no network request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network forbidden'));
    const prepared = await adapter.prepare(command);
    const result = await adapter.simulate(prepared, 'success');
    expect(result.code).toBe('accepted');
    expect(result.accepted).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('normalizes failure and uncertainty states', async () => {
    const prepared = await adapter.prepare(command);
    const temporary = await adapter.simulate(prepared, 'temporary_failure');
    const permanent = await adapter.simulate(prepared, 'permanent_failure');
    const timeout = await adapter.simulate(prepared, 'timeout_after_acceptance');

    expect(temporary).toMatchObject({ code: 'temporary_failure', retryable: true, uncertain: false });
    expect(permanent).toMatchObject({ code: 'permanent_failure', retryable: false, uncertain: false });
    expect(timeout).toMatchObject({ code: 'timeout_after_acceptance', retryable: false, uncertain: true });
  });

  it('recovers the deterministic persisted simulation result', async () => {
    const prepared = await adapter.prepare(command);
    const simulated = await adapter.simulate(prepared, 'unknown');
    const recovered = await adapter.recover(prepared, simulated.externalOperationId);
    expect(recovered).toEqual(simulated);
  });
});
