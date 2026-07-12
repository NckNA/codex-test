import { describe, expect, it } from 'vitest';
import { PatientListVisitSummaryAggregator } from './PatientListVisitSummaryAggregator';
import type { Appointment, AppointmentStatus } from '../../types';

const appointment = (
  id: string,
  patientId: string | undefined,
  start: string,
  status: AppointmentStatus = 'confirmed',
): Appointment => ({
  id,
  patientId,
  doctorId: 'doctor-1',
  cabinet: 'A1',
  service: 'Осмотр',
  start,
  end: new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString(),
  status,
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('PatientListVisitSummaryAggregator', () => {
  const now = new Date('2026-01-10T12:00:00.000Z');

  it('selects the latest past and earliest actionable future appointment', () => {
    const summary = PatientListVisitSummaryAggregator.getVisitSummaryByPatientId([
      appointment('past-1', 'patient-1', '2026-01-08T10:00:00.000Z', 'completed'),
      appointment('past-2', 'patient-1', '2026-01-09T10:00:00.000Z', 'no_show'),
      appointment('future-2', 'patient-1', '2026-01-12T10:00:00.000Z'),
      appointment('future-1', 'patient-1', '2026-01-11T10:00:00.000Z'),
    ], now);

    expect(summary['patient-1'].lastVisit?.toISOString()).toBe('2026-01-09T10:00:00.000Z');
    expect(summary['patient-1'].nextVisit?.toISOString()).toBe('2026-01-11T10:00:00.000Z');
  });

  it('excludes cancelled and malformed future terminal rows from upcoming', () => {
    const summary = PatientListVisitSummaryAggregator.getVisitSummaryByPatientId([
      appointment('cancelled', 'patient-1', '2026-01-11T09:00:00.000Z', 'cancelled'),
      appointment('completed-future', 'patient-1', '2026-01-11T10:00:00.000Z', 'completed'),
      appointment('no-show-future', 'patient-1', '2026-01-11T11:00:00.000Z', 'no_show'),
      appointment('confirmed', 'patient-1', '2026-01-11T12:00:00.000Z', 'confirmed'),
    ], now);

    expect(summary['patient-1'].nextVisit?.toISOString()).toBe('2026-01-11T12:00:00.000Z');
  });

  it('does not treat a cancelled past appointment as the previous visit', () => {
    const summary = PatientListVisitSummaryAggregator.getVisitSummaryByPatientId([
      appointment('completed', 'patient-1', '2026-01-08T10:00:00.000Z', 'completed'),
      appointment('cancelled', 'patient-1', '2026-01-09T10:00:00.000Z', 'cancelled'),
    ], now);

    expect(summary['patient-1'].lastVisit?.toISOString()).toBe('2026-01-08T10:00:00.000Z');
  });

  it('uses start >= now as the deterministic upcoming boundary', () => {
    const summary = PatientListVisitSummaryAggregator.getVisitSummaryByPatientId([
      appointment('exact-now', 'patient-1', now.toISOString(), 'confirmed'),
      appointment('one-ms-past', 'patient-1', '2026-01-10T11:59:59.999Z', 'arrived'),
    ], now);

    expect(summary['patient-1'].lastVisit?.toISOString()).toBe('2026-01-10T11:59:59.999Z');
    expect(summary['patient-1'].nextVisit?.toISOString()).toBe(now.toISOString());
  });

  it('groups multiple patients independently from one appointment array', () => {
    const summary = PatientListVisitSummaryAggregator.getVisitSummaryByPatientId([
      appointment('a', 'patient-a', '2026-01-11T10:00:00.000Z'),
      appointment('b', 'patient-b', '2026-01-09T10:00:00.000Z', 'completed'),
      appointment('c', 'patient-b', '2026-01-13T10:00:00.000Z'),
    ], now);

    expect(summary['patient-a'].lastVisit).toBeUndefined();
    expect(summary['patient-a'].nextVisit?.toISOString()).toBe('2026-01-11T10:00:00.000Z');
    expect(summary['patient-b'].lastVisit?.toISOString()).toBe('2026-01-09T10:00:00.000Z');
    expect(summary['patient-b'].nextVisit?.toISOString()).toBe('2026-01-13T10:00:00.000Z');
  });

  it('uses appointment id as a stable tie-breaker for equal start times', () => {
    const summary = PatientListVisitSummaryAggregator.getVisitSummaryByPatientId([
      appointment('z-id', 'patient-1', '2026-01-11T10:00:00.000Z'),
      appointment('a-id', 'patient-1', '2026-01-11T10:00:00.000Z'),
    ], now);

    expect(summary['patient-1'].nextVisit?.toISOString()).toBe('2026-01-11T10:00:00.000Z');
  });

  it('ignores blocked rows and rows without a patient', () => {
    const summary = PatientListVisitSummaryAggregator.getVisitSummaryByPatientId([
      appointment('blocked', undefined, '2026-01-11T10:00:00.000Z', 'blocked'),
      appointment('missing-patient', undefined, '2026-01-11T11:00:00.000Z', 'confirmed'),
    ], now);

    expect(summary).toEqual({});
  });

  it('returns no state for a patient without appointments', () => {
    const summary = PatientListVisitSummaryAggregator.getVisitSummaryByPatientId([], now);
    expect(summary['patient-none']).toBeUndefined();
  });
});
