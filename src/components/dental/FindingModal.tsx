import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { DentalFinding, FindingCategory, FindingSeverity, FindingStatus } from '../../types';
import { storage } from '../../utils/storage';

interface FindingModalProps {
  isOpen: boolean;
  patientId: string;
  finding?: DentalFinding | null;
  onClose: () => void;
  onSave: () => void;
}

export function FindingModal({ isOpen, patientId, finding, onClose, onSave }: FindingModalProps) {
  const [formData, setFormData] = useState<Partial<DentalFinding>>({
    category: 'caries',
    severity: 'medium',
    status: 'discovered',
    isChiefComplaintRelated: false,
    includeInTreatmentPlan: true,
  });

  useEffect(() => {
    if (isOpen) {
      if (finding) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFormData({ ...finding });
      } else {

        setFormData({
          category: 'caries',
          severity: 'medium',
          status: 'discovered',
          isChiefComplaintRelated: false,
          includeInTreatmentPlan: true,
          title: '',
          description: '',
          riskDescription: '',
          recommendation: '',
          toothNumber: undefined,
        });
      }
    }
  }, [isOpen, finding]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (finding) {
      storage.updateFinding(patientId, formData as DentalFinding);
    } else {
      storage.addFinding(patientId, formData as Omit<DentalFinding, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>);
    }
    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">
            {finding ? 'Редактировать проблему/риск' : 'Новая проблема/риск'}
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <form id="finding-form" onSubmit={handleSubmit} className="space-y-4">

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Зуб (необязательно)</label>
                <input
                  type="number"
                  value={formData.toothNumber || ''}
                  onChange={e => setFormData({ ...formData, toothNumber: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                  placeholder="Номер зуба"
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div className="flex items-center pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isChiefComplaintRelated || false}
                    onChange={e => setFormData({ ...formData, isChiefComplaintRelated: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Связано с жалобой</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Название <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={formData.title || ''}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="Краткое название"
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Категория <span className="text-red-500">*</span></label>
                <select
                  required
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value as FindingCategory })}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="caries">Кариес</option>
                  <option value="missing_tooth">Отсутствующий зуб</option>
                  <option value="gum_problem">Проблема десны</option>
                  <option value="root_problem">Проблема корня</option>
                  <option value="bite_problem">Проблема прикуса</option>
                  <option value="aesthetic_problem">Эстетическая проблема</option>
                  <option value="pain">Боль</option>
                  <option value="risk_zone">Зона риска</option>
                  <option value="hygiene">Гигиена</option>
                  <option value="prosthetics">Протезирование</option>
                  <option value="implantology">Имплантация</option>
                  <option value="other">Другое</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Серьезность <span className="text-red-500">*</span></label>
                <select
                  required
                  value={formData.severity}
                  onChange={e => setFormData({ ...formData, severity: e.target.value as FindingSeverity })}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="low">Низкая</option>
                  <option value="medium">Средняя</option>
                  <option value="high">Высокая</option>
                  <option value="urgent">Срочно</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Статус <span className="text-red-500">*</span></label>
              <select
                required
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value as FindingStatus })}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="discovered">Выявлено</option>
                <option value="recommended">Рекомендовано</option>
                <option value="included_in_plan">Включено в план</option>
                <option value="observing">Наблюдение</option>
                <option value="declined_by_patient">Пациент отказался</option>
                <option value="completed">Завершено</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Описание (для врача)</label>
              <textarea
                value={formData.description || ''}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              ></textarea>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Описание рисков (пациенту)</label>
              <textarea
                value={formData.riskDescription || ''}
                onChange={e => setFormData({ ...formData, riskDescription: e.target.value })}
                rows={2}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              ></textarea>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Рекомендация</label>
              <input
                type="text"
                value={formData.recommendation || ''}
                onChange={e => setFormData({ ...formData, recommendation: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div className="pt-3 border-t border-slate-100">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.includeInTreatmentPlan || false}
                  onChange={e => setFormData({ ...formData, includeInTreatmentPlan: e.target.checked })}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-blue-800">Включить в план лечения</span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Сделайте проблему доступной для выбора при составлении плана во вкладке «План лечения».
                  </p>
                </div>
              </label>
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
            form="finding-form"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}