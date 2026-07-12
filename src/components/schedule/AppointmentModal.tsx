import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AlertCircle, ExternalLink } from 'lucide-react';
import type { Appointment, AppointmentStatus, CancellationSource, PaymentType, Source, Doctor, Patient } from '../../types';
import { AppointmentCancellationDialog } from './AppointmentCancellationDialog';
import { AppointmentNoShowDialog } from './AppointmentNoShowDialog';
import {
  canHardDeleteAppointment,
  canManageAppointmentLifecycle,
  canTransitionAppointmentLifecycle,
  cancellationSourceLabel,
  isTerminalAppointmentLifecycle,
} from './appointmentLifecycle';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (appointment: Appointment) => Promise<boolean>;
  onCancel?: (appointment: Appointment, source: CancellationSource, reason: string) => Promise<Appointment | null>;
  onMarkNoShow?: (appointment: Appointment, reason: string) => Promise<Appointment | null>;
  onDelete?: (id: string) => Promise<boolean>;
  role?: string;
  initialData?: Partial<Appointment>;
  appointments: Appointment[];
  doctors: Doctor[];
  patients: Patient[];
  isSaving?: boolean;
  isReconciling?: boolean;
  serverError?: string | null;
}

const defaultForm = (): Partial<Appointment> => ({
  patientId: '',
  doctorId: '',
  cabinet: '',
  service: '',
  start: '',
  end: '',
  status: 'new',
  paymentType: 'unpaid',
  source: 'walk_in',
  price: 0,
  comment: '',
});

export function AppointmentModal({
  isOpen,
  onClose,
  onSave,
  onCancel,
  onMarkNoShow,
  onDelete,
  role,
  initialData,
  appointments,
  doctors,
  patients,
  isSaving = false,
  isReconciling = false,
  serverError = null,
}: AppointmentModalProps) {
  const isEditing = Boolean(initialData?.id);
  const navigate = useNavigate();
  const submitLockRef = useRef(false);
  const appointmentContextRef = useRef<string | null>(initialData?.id || null);
  const [isSubmittingLocally, setIsSubmittingLocally] = useState(false);
  const [formData, setFormData] = useState<Partial<Appointment>>({
    ...defaultForm(),
    ...initialData,
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const [lifecycleDialog, setLifecycleDialog] = useState<'cancel' | 'no_show' | null>(null);
  const isBusy = isSaving || isSubmittingLocally;
  const storedAppointment = isEditing ? initialData as Appointment : null;
  const isTerminal = Boolean(formData.status && isTerminalAppointmentLifecycle(formData.status));
  const canManageLifecycle = canManageAppointmentLifecycle(role);
  const canDelete = canHardDeleteAppointment(role);
  const visibleError = localError || serverError;

  useEffect(() => {
    appointmentContextRef.current = initialData?.id || null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormData({
      ...defaultForm(),
      ...initialData,
    });
    setLocalError(null);
    setIsSubmittingLocally(false);
    setLifecycleDialog(null);
    submitLockRef.current = false;
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: name === 'price' ? Number(value) : value,
    }));
    setLocalError(null);
  };

  const handleStatusChange = (status: AppointmentStatus) => {
    setFormData((previous) => ({ ...previous, status }));
    setLocalError(null);
  };

  const checkConflicts = (): boolean => {
    const proposedStart = new Date(formData.start as string).getTime();
    const proposedEnd = new Date(formData.end as string).getTime();

    for (const appointment of appointments) {
      if (appointment.id === formData.id || appointment.status === 'cancelled') continue;

      const existingStart = new Date(appointment.start).getTime();
      const existingEnd = new Date(appointment.end).getTime();
      const overlaps = proposedStart < existingEnd && proposedEnd > existingStart;
      if (!overlaps) continue;

      if (appointment.doctorId === formData.doctorId) {
        setLocalError('У врача уже есть запись на это время.');
        return true;
      }

      if (
        formData.patientId
        && appointment.patientId
        && appointment.patientId === formData.patientId
      ) {
        setLocalError('У пациента уже есть другая запись на это время.');
        return true;
      }
    }

    return false;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitLockRef.current || isSaving) return;
    setLocalError(null);

    if (!formData.doctorId || !formData.start || !formData.end) {
      setLocalError('Заполните обязательные поля: врач, начало и окончание.');
      return;
    }

    if (!formData.patientId && formData.status !== 'blocked') {
      setLocalError('Выберите пациента.');
      return;
    }

    const startTime = new Date(formData.start).getTime();
    const endTime = new Date(formData.end).getTime();
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
      setLocalError('Время окончания должно быть позже времени начала.');
      return;
    }

    if (checkConflicts()) return;

    const appointmentToSave: Appointment = {
      id: formData.id || crypto.randomUUID(),
      patientId: formData.patientId || undefined,
      doctorId: formData.doctorId,
      cabinet: formData.cabinet || doctors.find((doctor) => doctor.id === formData.doctorId)?.cabinet || 'Каб. 1',
      service: formData.service || '',
      start: formData.start,
      end: formData.end,
      status: formData.status as AppointmentStatus,
      paymentType: formData.paymentType as PaymentType,
      source: formData.source as Source,
      price: formData.price,
      comment: formData.comment,
      createdAt: formData.createdAt || new Date().toISOString(),
      updatedAt: formData.updatedAt,
    };

    submitLockRef.current = true;
    setIsSubmittingLocally(true);
    try {
      await onSave(appointmentToSave);
    } catch (error) {
      setLocalError(error instanceof Error
        ? error.message
        : 'Не удалось сохранить запись. Обновите расписание и проверьте результат.');
    } finally {
      submitLockRef.current = false;
      setIsSubmittingLocally(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !formData.id || submitLockRef.current || isSaving) return;
    submitLockRef.current = true;
    setIsSubmittingLocally(true);
    setLocalError(null);
    try {
      await onDelete(formData.id);
    } catch (error) {
      setLocalError(error instanceof Error
        ? error.message
        : 'Не удалось удалить запись. Обновите расписание.');
    } finally {
      submitLockRef.current = false;
      setIsSubmittingLocally(false);
    }
  };

  const handleCancelAppointment = async (source: CancellationSource, reason: string): Promise<Appointment | null> => {
    if (!storedAppointment || !onCancel) return null;
    const capturedAppointmentId = storedAppointment.id;
    const result = await onCancel(storedAppointment, source, reason);
    if (appointmentContextRef.current !== capturedAppointmentId) return null;
    if (result) setFormData(result);
    return result;
  };

  const handleMarkNoShow = async (reason: string): Promise<Appointment | null> => {
    if (!storedAppointment || !onMarkNoShow) return null;
    const capturedAppointmentId = storedAppointment.id;
    const result = await onMarkNoShow(storedAppointment, reason);
    if (appointmentContextRef.current !== capturedAppointmentId) return null;
    if (result) setFormData(result);
    return result;
  };

  const patientName = patients.find((patient) => patient.id === formData.patientId)?.fullName || 'Пациент не указан';
  const doctorName = doctors.find((doctor) => doctor.id === formData.doctorId)?.fullName || 'Врач не указан';

  const closeSafely = () => {
    if (!isBusy) onClose();
  };

  return (
    <>
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-3">
            {isEditing ? 'Редактирование записи' : 'Новая запись'}
            {isEditing && formData.patientId && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  if (isBusy) return;
                  onClose();
                  navigate(`/patients/${formData.patientId}`);
                }}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded-md flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                <ExternalLink className="w-3 h-3" />
                Карточка пациента
              </button>
            )}
          </h2>
          <button
            type="button"
            disabled={isBusy}
            onClick={closeSafely}
            aria-label="Закрыть"
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {visibleError && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 text-sm border border-red-200" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {visibleError}
            </div>
          )}

          {isReconciling && (
            <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm border border-blue-200" role="status">
              Проверяем, была ли запись сохранена…
            </div>
          )}

          <form id="appointment-form" onSubmit={handleSubmit} className="space-y-4">
            <fieldset disabled={isBusy || isTerminal} className="space-y-4 disabled:opacity-70">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Пациент</label>
                  <select
                    name="patientId"
                    value={formData.patientId || ''}
                    onChange={handleChange}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">-- Выберите пациента --</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>{patient.fullName} ({patient.phone})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Услуга</label>
                  <input
                    type="text"
                    name="service"
                    value={formData.service || ''}
                    onChange={handleChange}
                    placeholder="Например, Осмотр"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Врач</label>
                  <select
                    name="doctorId"
                    value={formData.doctorId || ''}
                    onChange={handleChange}
                    required
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">-- Выберите врача --</option>
                    {doctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>{doctor.fullName} ({doctor.specialization})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Кабинет</label>
                  <input
                    type="text"
                    name="cabinet"
                    value={formData.cabinet || ''}
                    onChange={handleChange}
                    placeholder="Каб. 1"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Начало</label>
                  <input
                    type="datetime-local"
                    name="start"
                    value={formData.start ? formData.start.slice(0, 16) : ''}
                    onChange={handleChange}
                    required
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Окончание</label>
                  <input
                    type="datetime-local"
                    name="end"
                    value={formData.end ? formData.end.slice(0, 16) : ''}
                    onChange={handleChange}
                    required
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Цена (₸)</label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price || 0}
                    onChange={handleChange}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Источник</label>
                  <select
                    name="source"
                    value={formData.source || 'walk_in'}
                    onChange={handleChange}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="phone">Телефон</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="instagram">Instagram</option>
                    <option value="walk_in">С улицы</option>
                    <option value="repeat">Повторный</option>
                    <option value="referral">По рекомендации</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Комментарий</label>
                <textarea
                  name="comment"
                  value={formData.comment || ''}
                  onChange={handleChange}
                  rows={2}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Статус</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'new', label: 'Новая' },
                    { value: 'confirmed', label: 'Подтвержден' },
                    { value: 'arrived', label: 'Пришел' },
                    { value: 'in_progress', label: 'В работе' },
                    { value: 'completed', label: 'Завершен' },
                  ].map((status) => (
                    <button
                      key={status.value}
                      type="button"
                      data-testid={`appointment-status-${status.value}`}
                      onClick={() => handleStatusChange(status.value as AppointmentStatus)}
                      className={`px-3 py-1 text-sm rounded-md border ${
                        formData.status === status.value
                          ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>

              {isEditing && formData.status === 'cancelled' && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" data-testid="appointment-cancellation-metadata">
                  <div className="font-semibold">Запись отменена</div>
                  <div>Дата: {formData.cancelledAt ? new Date(formData.cancelledAt).toLocaleString('ru-RU') : 'Историческая запись'}</div>
                  <div>Кто отменил: {cancellationSourceLabel(formData.cancellationSource)}</div>
                  <div>Причина: {formData.cancellationReason || 'Причина не была сохранена в прежней версии системы'}</div>
                  <div>Сотрудник: {formData.cancelledBy ? 'Сотрудник клиники' : 'Не указан'}</div>
                </div>
              )}

              {isEditing && formData.status === 'no_show' && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" data-testid="appointment-no-show-metadata">
                  <div className="font-semibold">Отмечена неявка</div>
                  <div>Дата: {formData.noShowAt ? new Date(formData.noShowAt).toLocaleString('ru-RU') : 'Историческая запись'}</div>
                  <div>Причина: {formData.noShowReason || 'Причина не была сохранена в прежней версии системы'}</div>
                  <div>Сотрудник: {formData.noShowBy ? 'Сотрудник клиники' : 'Не указан'}</div>
                </div>
              )}
            </fieldset>
          </form>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <div className="flex flex-wrap gap-2">
            {isEditing && canDelete && onDelete && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handleDelete()}
                data-testid="appointment-delete-action"
                className="px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Удалить запись
              </button>
            )}
            {isEditing && storedAppointment && canManageLifecycle && canTransitionAppointmentLifecycle(storedAppointment.status) && onMarkNoShow && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setLifecycleDialog('no_show')}
                data-testid="appointment-no-show-action"
                className="px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Отметить неявку
              </button>
            )}
            {isEditing && storedAppointment && canManageLifecycle && canTransitionAppointmentLifecycle(storedAppointment.status) && onCancel && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setLifecycleDialog('cancel')}
                data-testid="appointment-cancel-action"
                className="px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Отменить запись
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={closeSafely}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              {isTerminal ? 'Закрыть' : 'Отмена'}
            </button>
            {!isTerminal && (
              <button
                type="submit"
                form="appointment-form"
                disabled={isBusy}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBusy ? 'Сохраняем запись…' : 'Сохранить'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    {lifecycleDialog === 'cancel' && storedAppointment && (
      <AppointmentCancellationDialog
        appointment={storedAppointment}
        patientName={patientName}
        doctorName={doctorName}
        isSaving={isBusy}
        isReconciling={isReconciling}
        error={visibleError ? new Error(visibleError) : null}
        onConfirm={handleCancelAppointment}
        onClose={() => setLifecycleDialog(null)}
      />
    )}
    {lifecycleDialog === 'no_show' && storedAppointment && (
      <AppointmentNoShowDialog
        appointment={storedAppointment}
        patientName={patientName}
        doctorName={doctorName}
        isSaving={isBusy}
        isReconciling={isReconciling}
        error={visibleError ? new Error(visibleError) : null}
        onConfirm={handleMarkNoShow}
        onClose={() => setLifecycleDialog(null)}
      />
    )}
    </>
  );
}
