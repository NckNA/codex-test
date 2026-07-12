import type { Appointment } from '../../types';
import { buildPatientAppointmentSummaryByPatientId } from '../../domain/appointmentSummary';

export interface PatientVisitSummary {
  lastVisit?: Date;
  nextVisit?: Date;
}

export type PatientVisitSummaryByPatientId = Record<string, PatientVisitSummary>;

export const PatientListVisitSummaryAggregator = {
  getVisitSummaryByPatientId(
    appointments: Appointment[],
    now = new Date(),
  ): PatientVisitSummaryByPatientId {
    const summaries = buildPatientAppointmentSummaryByPatientId(appointments, now);
    const visits: PatientVisitSummaryByPatientId = {};

    for (const [patientId, summary] of Object.entries(summaries)) {
      visits[patientId] = {
        lastVisit: summary.previousAppointment
          ? new Date(summary.previousAppointment.start)
          : undefined,
        nextVisit: summary.nextAppointment
          ? new Date(summary.nextAppointment.start)
          : undefined,
      };
    }

    return visits;
  },
};
