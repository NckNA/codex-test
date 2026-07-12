import type {
  Appointment,
  AppointmentConfirmationState,
  AppointmentContactChannel,
  AppointmentContactOutcome,
} from '../../types';

export const CONFIRMATION_STATE_LABELS: Record<AppointmentConfirmationState, string> = {
  unconfirmed: 'Не подтверждена',
  contact_in_progress: 'Связываемся',
  confirmed: 'Подтверждена',
  unreachable: 'Не удалось связаться',
  callback_requested: 'Просит перезвонить',
};

export const CONTACT_CHANNEL_LABELS: Record<AppointmentContactChannel, string> = {
  phone: 'Телефон',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  email: 'Email',
  in_person: 'Лично',
  other: 'Другое',
};

export const CONTACT_OUTCOME_LABELS: Record<AppointmentContactOutcome, string> = {
  confirmed: 'Подтвердил',
  no_answer: 'Не ответил',
  unreachable: 'Недоступен',
  callback_requested: 'Просит перезвонить',
  declined: 'Отказался',
  wrong_number: 'Неверный номер',
  message_sent: 'Сообщение отправлено',
  other: 'Другое',
};

export const canManageAppointmentConfirmation = (role?: string | null): boolean => (
  role === 'clinic_owner' || role === 'clinic_admin' || role === 'registrar'
);

export const canUseAppointmentConfirmationActions = (appointment: Appointment): boolean => (
  appointment.status === 'new' || appointment.status === 'confirmed'
);

export const appointmentNeedsConfirmationAttention = (appointment: Appointment): boolean => (
  canUseAppointmentConfirmationActions(appointment)
  && (appointment.confirmationState || 'unconfirmed') !== 'confirmed'
);

export const confirmationStateLabel = (state?: AppointmentConfirmationState): string => (
  CONFIRMATION_STATE_LABELS[state || 'unconfirmed']
);

export const confirmationStateClassName = (state?: AppointmentConfirmationState): string => {
  switch (state || 'unconfirmed') {
    case 'confirmed': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'callback_requested': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'unreachable': return 'bg-rose-100 text-rose-800 border-rose-200';
    case 'contact_in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};
