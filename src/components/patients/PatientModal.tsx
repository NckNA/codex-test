import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import type { Patient, Source, PatientSource, PatientLeadStatus } from '../../types';

interface PatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (patient: Patient) => void;
  initialData?: Partial<Patient>;
}

export function PatientModal({ isOpen, onClose, onSave, initialData }: PatientModalProps) {
  const isEditing = !!initialData?.id;

  const [formData, setFormData] = useState<Partial<Patient>>({
    fullName: '',
    phone: '',
    birthDate: '',
    source: 'walk_in',
    status: 'active',
    notes: '',
    allergies: '',
    balance: 0,
    bonusBalance: 0,
    integration: undefined,
    ...initialData,
  });

  const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && initialData) {
    // eslint-disable-next-line react-hooks/set-state-in-effect
            setFormData(prev => ({
        ...prev,
        fullName: initialData.fullName || '',
        phone: initialData.phone || '',
        birthDate: initialData.birthDate || '',
        source: initialData.source || 'walk_in',
        status: initialData.status || 'active',
        notes: initialData.notes || '',
        allergies: initialData.allergies || '',
        balance: initialData.balance || 0,
        bonusBalance: initialData.bonusBalance || 0,
        integration: initialData.integration,
        id: initialData.id,
      }));
      setError(null);
    } else if (isOpen) {

                setFormData({
            fullName: '',
            phone: '',
            birthDate: '',
            source: 'walk_in',
            status: 'active',
            notes: '',
            allergies: '',
            balance: 0,
            bonusBalance: 0,
        });
        setError(null);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

          setFormData(prev => ({
      ...prev,
      [name]: (name === 'balance' || name === 'bonusBalance') ? Number(value) : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const fullName = formData.fullName?.trim();
    const phone = formData.phone?.trim();

    if (!fullName || !phone) {
      setError('Имя и Телефон обязательны для заполнения.');
      return;
    }

    const patientToSave: Patient = {
      id: formData.id || crypto.randomUUID(),
      fullName,
      phone,
      birthDate: formData.birthDate,
      source: formData.source as Source,
      status: formData.status as string,
      notes: formData.notes,
      allergies: formData.allergies,
      balance: formData.balance || 0,
      bonusBalance: formData.bonusBalance || 0,
      integration: formData.integration,
      createdAt: formData.createdAt || new Date().toISOString(),
    };

    onSave(patientToSave);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">
            {isEditing ? 'Редактирование пациента' : 'Новый пациент'}
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

          <form id="patient-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* ФИО */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ФИО <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName || ''}
                  onChange={handleChange}
                  placeholder="Иванов Иван Иванович"
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* Телефон */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Телефон <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone || ''}
                  onChange={handleChange}
                  placeholder="+7 (999) 000-0000"
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* Дата рождения */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Дата рождения</label>
                <input
                  type="date"
                  name="birthDate"
                  value={formData.birthDate || ''}
                  onChange={handleChange}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              

              {/* Статус */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Статус</label>
                <select
                  name="status"
                  value={formData.status || 'active'}
                  onChange={handleChange}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="active">Активный</option>
                  <option value="archived">Архив</option>
                </select>
              </div>

              {/* Аллергии */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Аллергии</label>
                <input
                  type="text"
                  name="allergies"
                  value={formData.allergies || ''}
                  onChange={handleChange}
                  placeholder="Нет или перечислить..."
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* Баланс */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Баланс (₸)</label>
                <input
                  type="number"
                  name="balance"
                  value={formData.balance || 0}
                  onChange={handleChange}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* Бонусный Баланс */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Бонусный баланс</label>
                <input
                  type="number"
                  name="bonusBalance"
                  value={formData.bonusBalance || 0}
                  onChange={handleChange}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>

            {/* Заметки */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Заметки</label>
              <textarea
                name="notes"
                value={formData.notes || ''}
                onChange={handleChange}
                rows={3}
                placeholder="Дополнительная информация..."
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              ></textarea>
            </div>

          
            {/* Блок Источник и CRM */}
            <div className="pt-4 border-t border-slate-200 mt-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Источник и CRM</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Источник пациента</label>
                  <select
                    name="integration_source"
                    value={formData.integration?.source || 'manual'}
                    onChange={(e) => {
                      const val = e.target.value as PatientSource;
                      setFormData(prev => ({
                        ...prev,
                        integration: {
                          ...(prev.integration || { leadStatus: 'new_lead' }),
                          source: val
                        }
                      }));
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="manual">Добавлен вручную</option>
                    <option value="instagram">Instagram</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="website">Сайт</option>
                    <option value="phone">Телефон звонок</option>
                    <option value="amocrm">amoCRM</option>
                    <option value="referral">По рекомендации</option>
                    <option value="other">Другое</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Статус лида</label>
                  <select
                    name="integration_leadStatus"
                    value={formData.integration?.leadStatus || 'new_lead'}
                    onChange={(e) => {
                      const val = e.target.value as PatientLeadStatus;
                      setFormData(prev => ({
                        ...prev,
                        integration: {
                          ...(prev.integration || { source: 'manual' }),
                          leadStatus: val
                        }
                      }));
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="new_lead">Новый лид</option>
                    <option value="contacted">Взят в работу</option>
                    <option value="scheduled">Записан</option>
                    <option value="arrived">Пришел</option>
                    <option value="treatment_plan_created">План составлен</option>
                    <option value="treatment_plan_approved">План согласован</option>
                    <option value="declined">Отказ</option>
                    <option value="lost">Закрыт и не реализован</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Комментарий к источнику</label>
                  <input
                    type="text"
                    name="integration_sourceComment"
                    value={formData.integration?.sourceComment || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        integration: {
                          ...(prev.integration || { source: 'manual', leadStatus: 'new_lead' }),
                          sourceComment: val
                        }
                      }));
                    }}
                    placeholder="Например: акция на имплантацию"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
            </div>

          </form>
        </div>

        <div className="flex items-center justify-end p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors"
          >
            Отмена
          </button>
          <button
            type="submit"
            form="patient-form"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
