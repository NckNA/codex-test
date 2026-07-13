import { describe, expect, it } from 'vitest';
import {
  assertSafeCommunicationCommand,
  deriveCommunicationPurpose,
  fingerprintCommunicationCommand,
  maskCommunicationDestination,
  validateCommunicationVariables,
  type CommunicationCommand,
} from './CommunicationCommand';

const command = (overrides: Partial<CommunicationCommand> = {}): CommunicationCommand => ({
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
  destinationFingerprint: 'a'.repeat(64),
  operationKey: 'communication-operation-a',
  variables: {
    patient_first_name: 'Анна',
    clinic_name: 'DentalFlow',
    appointment_date: '2026-07-14',
    appointment_time: '12:00',
    doctor_display_name: 'Доктор',
  },
  requestedAt: '2026-07-13T12:00:00.000Z',
  ...overrides,
});

describe('CommunicationCommand', () => {
  it('derives stable purposes from reminder types', () => {
    expect(deriveCommunicationPurpose('confirmation_request')).toBe('appointment_confirmation_request');
    expect(deriveCommunicationPurpose('day_before_reminder')).toBe('appointment_day_before_reminder');
    expect(deriveCommunicationPurpose('same_day_reminder')).toBe('appointment_same_day_reminder');
    expect(deriveCommunicationPurpose('control_call_task')).toBe('appointment_control_call_task');
    expect(deriveCommunicationPurpose('callback_task')).toBe('appointment_control_call_task');
  });

  it('rejects unsupported reminder types', () => {
    expect(() => deriveCommunicationPurpose('marketing_blast')).toThrow(/Unsupported/);
  });

  it('accepts only allowlisted variables', () => {
    expect(() => validateCommunicationVariables(command().variables)).not.toThrow();
    expect(() => validateCommunicationVariables({ diagnosis: 'caries' })).toThrow(/diagnosis/);
    expect(() => validateCommunicationVariables({ payment: '100' })).toThrow(/payment/);
  });

  it('masks destinations without retaining the full value', () => {
    expect(maskCommunicationDestination('+77001234567', 'sms')).toBe('+7700***4567');
    expect(maskCommunicationDestination('name@example.com', 'email')).toBe('n***@example.com');
    expect(maskCommunicationDestination('bad', 'email')).toBe('***');
  });

  it('produces deterministic fingerprints and reacts to a changed channel', async () => {
    const first = await fingerprintCommunicationCommand(command());
    const second = await fingerprintCommunicationCommand(command());
    const changed = await fingerprintCommunicationCommand(command({ channel: 'whatsapp' }));
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).toBe(second);
    expect(changed).not.toBe(first);
  });

  it('validates a safe structured command', () => {
    expect(() => assertSafeCommunicationCommand(command())).not.toThrow();
    expect(() => assertSafeCommunicationCommand(command({
      variables: { complaint: 'pain' } as never,
    }))).toThrow(/complaint/);
    expect(() => assertSafeCommunicationCommand(command({
      destinationFingerprint: 'raw-phone',
    }))).toThrow(/fingerprint/);
  });
});
