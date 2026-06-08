// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { PatientListVisitSummaryAggregator } from './PatientListVisitSummaryAggregator';
import type { Appointment } from '../../types';

describe('PatientListVisitSummaryAggregator', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('calculates lastVisit and nextVisit per patient', async () => {
    const now = new Date('2026-01-10T12:00:00.000Z');
    const past = new Date('2026-01-09T12:00:00.000Z').toISOString();
    const future = new Date('2026-01-11T12:00:00.000Z').toISOString();

    const appts: Appointment[] = [
      { id: '1', patientId: 'patient_1', doctorId: 'd1', cabinet: 'c1', service: 's1', start: past, end: past, status: 'completed', createdAt: 'now' },
      { id: '2', patientId: 'patient_1', doctorId: 'd1', cabinet: 'c1', service: 's1', start: future, end: future, status: 'confirmed', createdAt: 'now' },
      { id: '3', patientId: 'patient_2', doctorId: 'd1', cabinet: 'c1', service: 's1', start: future, end: future, status: 'confirmed', createdAt: 'now' }
    ];
    localStorage.setItem('df_appointments', JSON.stringify(appts));

    const summaryMap = await PatientListVisitSummaryAggregator.getVisitSummaryByPatientId(now);

    expect(summaryMap['patient_1'].lastVisit?.toISOString()).toBe(past);
    expect(summaryMap['patient_1'].nextVisit?.toISOString()).toBe(future);

    expect(summaryMap['patient_2'].lastVisit).toBeUndefined();
    expect(summaryMap['patient_2'].nextVisit?.toISOString()).toBe(future);
  });

  it('ignores appointments without patientId', async () => {
    const now = new Date('2026-01-10T12:00:00.000Z');
    const appts = [
      { id: '1', doctorId: 'd1', cabinet: 'c1', service: 's1', start: now.toISOString(), end: now.toISOString(), status: 'confirmed', createdAt: 'now' }
    ] as Appointment[];
    
    localStorage.setItem('df_appointments', JSON.stringify(appts));

    const summaryMap = await PatientListVisitSummaryAggregator.getVisitSummaryByPatientId(now);
    expect(Object.keys(summaryMap)).toHaveLength(0);
  });

  it('ignores blocked and cancelled appointments', async () => {
    const now = new Date('2026-01-10T12:00:00.000Z');
    const past = new Date('2026-01-09T12:00:00.000Z').toISOString();

    const appts: Appointment[] = [
      { id: '1', patientId: 'patient_2', doctorId: 'd1', cabinet: 'c1', service: 's1', start: past, end: past, status: 'cancelled', createdAt: 'now' },
      { id: '2', patientId: 'patient_2', doctorId: 'd1', cabinet: 'c1', service: 's1', start: past, end: past, status: 'blocked', createdAt: 'now' }
    ];
    localStorage.setItem('df_appointments', JSON.stringify(appts));

    const summaryMap = await PatientListVisitSummaryAggregator.getVisitSummaryByPatientId(now);
    // Current behavior returns empty object if no valid appts
    expect(summaryMap['patient_2']).toBeUndefined();
  });

  it('handles patients without appointments', async () => {
    const now = new Date('2026-01-10T12:00:00.000Z');
    localStorage.setItem('df_appointments', JSON.stringify([]));

    const summaryMap = await PatientListVisitSummaryAggregator.getVisitSummaryByPatientId(now);
    expect(summaryMap['patient_3']).toBeUndefined();
  });

  it('does not mutate appointments storage', async () => {
    const now = new Date('2026-01-10T12:00:00.000Z');
    const apptsData = JSON.stringify([
      { id: '1', patientId: 'patient_1', doctorId: 'd1', cabinet: 'c1', service: 's1', start: now.toISOString(), end: now.toISOString(), status: 'completed', createdAt: 'now' }
    ]);
    localStorage.setItem('df_appointments', apptsData);

    await PatientListVisitSummaryAggregator.getVisitSummaryByPatientId(now);

    expect(localStorage.getItem('df_appointments')).toBe(apptsData);
  });
});
