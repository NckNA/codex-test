import React, { useState, useEffect } from 'react';
import { X, RefreshCcw } from 'lucide-react';
import type { ToothRecord, ToothCondition, ToothSurface } from '../../types';

interface ToothEditorModalProps {
  isOpen: boolean;
  tooth: ToothRecord | null;
  onClose: () => void;
  onSave: (tooth: ToothRecord) => void;
}

const CONDITIONS: { value: ToothCondition; label: string }[] = [
  { value: 'healthy', label: 'Здоров' },
  { value: 'caries', label: 'Кариес' },
  { value: 'filled', label: 'Пломба' },
  { value: 'missing', label: 'Удалён' },
  { value: 'crown', label: 'Коронка' },
  { value: 'implant', label: 'Имплант' },
  { value: 'root', label: 'Корень' },
  { value: 'pulpitis', label: 'Пульпит' },
  { value: 'periodontitis', label: 'Периодонтит' },
  { value: 'needs_treatment', label: 'Требует лечения' },
];

const SURFACES: { value: ToothSurface; label: string }[] = [
  { value: 'occlusal', label: 'Жевательная (O)' },
  { value: 'mesial', label: 'Мезиальная (M)' },
  { value: 'distal', label: 'Дистальная (D)' },
  { value: 'vestibular', label: 'Вестибулярная (V)' },
  { value: 'oral', label: 'Оральная (L/P)' },
];

export function ToothEditorModal({ isOpen, tooth, onClose, onSave }: ToothEditorModalProps) {
  const [formData, setFormData] = useState<Partial<ToothRecord>>({});

    useEffect(() => {
    if (isOpen && tooth) {
    // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({ ...tooth, surfaces: tooth.surfaces || [] });
    }
  }, [isOpen, tooth]);

  if (!isOpen || !tooth) return null;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSurfaceToggle = (surface: ToothSurface) => {
    const current = formData.surfaces || [];
    if (current.includes(surface)) {

      setFormData(prev => ({ ...prev, surfaces: current.filter(s => s !== surface) }));
    } else {

      setFormData(prev => ({ ...prev, surfaces: [...current, surface] }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...tooth,
      ...formData,
      updatedAt: new Date().toISOString()
    } as ToothRecord);
  };

  const handleReset = () => {

    setFormData({
      toothNumber: tooth.toothNumber,
      condition: 'healthy',
      surfaces: [],
      crown: '',
      root: '',
      gum: '',
      bone: '',
      canal: '',
      notes: ''
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            Редактирование зуба <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">{tooth.toothNumber}</span>
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <form id="tooth-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Состояние */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Состояние</label>
              <select
                name="condition"
                value={formData.condition || 'healthy'}
                onChange={handleChange}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              >
                {CONDITIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Поверхности */}
            {['caries', 'filled', 'needs_treatment'].includes(formData.condition || '') && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Поверхности</label>
                <div className="flex flex-wrap gap-2">
                  {SURFACES.map(s => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => handleSurfaceToggle(s.value)}
                      className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                        (formData.surfaces || []).includes(s.value)
                          ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Десна</label>
                <input
                  type="text"
                  name="gum"
                  value={formData.gum || ''}
                  onChange={handleChange}
                  placeholder="Состояние десны..."
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Кость</label>
                <input
                  type="text"
                  name="bone"
                  value={formData.bone || ''}
                  onChange={handleChange}
                  placeholder="Состояние кости..."
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Коронка</label>
                <input
                  type="text"
                  name="crown"
                  value={formData.crown || ''}
                  onChange={handleChange}
                  placeholder="Материал..."
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Корень / Каналы</label>
                <input
                  type="text"
                  name="canal"
                  value={formData.canal || ''}
                  onChange={handleChange}
                  placeholder="Заметки по каналам..."
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Заметки</label>
              <textarea
                name="notes"
                value={formData.notes || ''}
                onChange={handleChange}
                rows={3}
                placeholder="Дополнительная информация о зубе..."
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              ></textarea>
            </div>
          </form>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCcw className="w-4 h-4" /> Сбросить (Здоров)
          </button>
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
              form="tooth-form"
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
