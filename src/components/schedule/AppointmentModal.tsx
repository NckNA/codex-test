import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AlertCircle, ExternalLink } from 'lucide-react';
import type { Appointment, AppointmentStatus, PaymentType, Source, Doctor, Patient } from '../../types';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (appointment: Appointment) => void;
  onDelete?: (id: string) => void;
  initialData?: Partial<Appointment>;
  appointments: Appointment[];
  doctors: Doctor[];
  patients: Patient[];
}

export function AppointmentModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
  appointments,
  doctors,
  patients,
}: AppointmentModalProps) {
  const isEditing = !!initialData?.id;
  const navigate = useNavigate();

  const [formData, setFormData] = useState<Partial<Appointment>>({
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
    ...initialData,
  });

  const [error, setError] = useState<string | null>(null);

  // Reset form when opened with new data
    useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
                setFormData({
      patientId: '',
      doctorId: '',
      cabinet: '',
      start: '',
      end: '',
      status: 'new',
      paymentType: 'unpaid',
      source: 'walk_in',
      price: 0,
      service: '',
      comment: '',
      ...initialData,
    });
    setError(null);
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

          setFormData(prev => ({ ...prev, [name]: name === 'price' ? Number(value) : value }));
  };

  const handleStatusChange = (status: AppointmentStatus) => {

          setFormData(prev => ({ ...prev, status }));
  };

  const checkConflicts = () => {
    if (formData.status === 'cancelled') return false;

    const allAppointments = appointments;
    const newStart = new Date(formData.start as string).getTime();
    const newEnd = new Date(formData.end as string).getTime();

    for (const appt of allAppointments) {
      if (appt.id === formData.id) continue; // Skip self
      if (appt.status === 'cancelled') continue;

      const apptStart = new Date(appt.start).getTime();
      const apptEnd = new Date(appt.end).getTime();

      // Check overlap
      if (newStart < apptEnd && newEnd > apptStart) {
        if (appt.doctorId === formData.doctorId) {
          setError('Врач занят в это время.');
          return true;
        }
        if (appt.cabinet === formData.cabinet) {
          setError('Кабинет занят в это время.');
          return true;
        }
      }
    }
    return false;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic validation
    if (!formData.doctorId || !formData.start || !formData.end) {
      setError('Заполните обязательные поля (Врач, Время).');
      return;
    }

    if (checkConflicts()) return;

    const appointmentToSave: Appointment = {
      id: formData.id || `a${new Date().getTime()}`,
      patientId: formData.patientId,
      doctorId: formData.doctorId as string,
      cabinet: formData.cabinet || doctors.find(d => d.id === formData.doctorId)?.cabinet || 'Каб. 1',
      service: formData.service || '',
      start: formData.start as string,
      end: formData.end as string,
      status: formData.status as AppointmentStatus,
      paymentType: formData.paymentType as PaymentType,
      source: formData.source as Source,
      price: formData.price,
      comment: formData.comment,
      createdAt: formData.createdAt || new Date().toISOString(),
    };

    onSave(appointmentToSave);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-3">
            {isEditing ? 'Редактирование записи' : 'Новая запись'}
            {isEditing && formData.patientId && (
              <button
                onClick={() => {
                  onClose();
                  navigate(`/patients/${formData.patientId}`);
                }}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded-md flex items-center gap-1 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Карточка пациента
              </button>
            )}
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 text-sm border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form id="appointment-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Пациент */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Пациент (демо)</label>
                <select
                  name="patientId"
                  value={formData.patientId || ''}
                  onChange={handleChange}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">-- Выберите пациента --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.fullName} ({p.phone})</option>
                  ))}
                </select>
              </div>

              {/* Услуга */}
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

              {/* Врач */}
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
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.fullName} ({d.specialization})</option>
                  ))}
                </select>
              </div>

              {/* Кабинет */}
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

              {/* Время начала */}
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

              {/* Время конца */}
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

               {/* Цена */}
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

              {/* Источник */}
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

            {/* Комментарий */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Комментарий</label>
              <textarea
                name="comment"
                value={formData.comment || ''}
                onChange={handleChange}
                rows={2}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              ></textarea>
            </div>

            {/* Быстрые статусы */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Статус</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'new', label: 'Новая' },
                  { value: 'confirmed', label: 'Подтвержден' },
                  { value: 'arrived', label: 'Пришел' },
                  { value: 'in_progress', label: 'В работе' },
                  { value: 'completed', label: 'Завершен' },
                  { value: 'no_show', label: 'Не пришел' },
                  { value: 'cancelled', label: 'Отменен' },
                ].map(status => (
                  <button
                    key={status.value}
                    type="button"
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
          </form>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <div>
            {isEditing && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(formData.id as string)}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Удалить
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              form="appointment-form"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
