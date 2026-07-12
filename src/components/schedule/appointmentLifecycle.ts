import type { AppointmentStatus, CancellationSource } from '../../types';

export type AppointmentLifecycleRole = string | null | undefined;

export const CANCELLATION_SOURCE_LABELS: Record<CancellationSource, string> = {
  patient: 'Пациент',
  clinic: 'Клиника',
  doctor: 'Врач',
  technical: 'Техническая причина',
  other: 'Другое',
};

export const cancellationSourceLabel = (source?: CancellationSource): string => (
  source ? CANCELLATION_SOURCE_LABELS[source] : 'Не указано'
);

export const canManageAppointmentLifecycle = (role: AppointmentLifecycleRole): boolean => (
  role === 'clinic_owner' || role === 'clinic_admin' || role === 'registrar'
);

export const canHardDeleteAppointment = (role: AppointmentLifecycleRole): boolean => (
  role === 'clinic_owner' || role === 'clinic_admin'
);

export const canTransitionAppointmentLifecycle = (status: AppointmentStatus): boolean => (
  status === 'new' || status === 'confirmed'
);

export const isTerminalAppointmentLifecycle = (status: AppointmentStatus): boolean => (
  status === 'cancelled' || status === 'no_show'
);
