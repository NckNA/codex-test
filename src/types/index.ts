// Common types
export interface Appointment {
  id: string;
  patientName: string;
  doctorName: string;
  timeStart: string;
  timeEnd: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  service: string;
}
