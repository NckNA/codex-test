import { LocalStorageAppointmentRepository } from '../repositories/AppointmentRepository';

export interface PatientVisitSummary {
  lastVisit?: Date;
  nextVisit?: Date;
}

export type PatientVisitSummaryByPatientId = Record<string, PatientVisitSummary>;

export const PatientListVisitSummaryAggregator = {
  async getVisitSummaryByPatientId(now = new Date()): Promise<PatientVisitSummaryByPatientId> {
    const visits: PatientVisitSummaryByPatientId = {};
    const appointments = await LocalStorageAppointmentRepository.listAppointments();

    const sortedAppts = [...appointments].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );

    for (const appt of sortedAppts) {
      if (!appt.patientId || appt.status === 'blocked' || appt.status === 'cancelled') continue;

      const apptDate = new Date(appt.start);
      if (!visits[appt.patientId]) {
        visits[appt.patientId] = {};
      }

      if (apptDate < now) {
        visits[appt.patientId].lastVisit = apptDate;
      } else {
        if (!visits[appt.patientId].nextVisit) {
          visits[appt.patientId].nextVisit = apptDate;
        }
      }
    }

    return visits;
  },
};
