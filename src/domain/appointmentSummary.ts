import type { Appointment } from '../types';

export interface PatientAppointmentSummary {
  previousAppointment?: Appointment;
  nextAppointment?: Appointment;
}

export type PatientAppointmentSummaryByPatientId = Record<string, PatientAppointmentSummary>;

const FUTURE_TERMINAL_STATUSES = new Set<Appointment['status']>([
  'cancelled',
  'completed',
  'no_show',
  'blocked',
]);

export const compareAppointmentsByStartThenId = (left: Appointment, right: Appointment): number => {
  const startDifference = new Date(left.start).getTime() - new Date(right.start).getTime();
  if (startDifference !== 0) return startDifference;
  return left.id.localeCompare(right.id);
};

export function buildPatientAppointmentSummaryByPatientId(
  appointments: Appointment[],
  now = new Date(),
): PatientAppointmentSummaryByPatientId {
  const summaries: PatientAppointmentSummaryByPatientId = {};
  const nowTime = now.getTime();

  for (const appointment of [...appointments].sort(compareAppointmentsByStartThenId)) {
    if (!appointment.patientId || appointment.status === 'blocked') continue;

    const startTime = new Date(appointment.start).getTime();
    if (!Number.isFinite(startTime)) continue;

    const summary = summaries[appointment.patientId] ?? {};
    summaries[appointment.patientId] = summary;

    if (startTime < nowTime) {
      // Cancelled appointments remain available in history, but are not treated as a prior visit.
      // A past no-show remains the latest prior appointment fact and is intentionally included.
      if (appointment.status !== 'cancelled') {
        summary.previousAppointment = appointment;
      }
      continue;
    }

    // The exact now boundary is upcoming. Future terminal rows are malformed schedule facts,
    // so they remain visible in history but never become the next actionable appointment.
    if (!summary.nextAppointment && !FUTURE_TERMINAL_STATUSES.has(appointment.status)) {
      summary.nextAppointment = appointment;
    }
  }

  return summaries;
}

export function getPatientAppointmentSummary(
  appointments: Appointment[],
  patientId: string,
  now = new Date(),
): PatientAppointmentSummary {
  return buildPatientAppointmentSummaryByPatientId(appointments, now)[patientId] ?? {};
}
