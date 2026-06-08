import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { DentalFinding, TreatmentPlan, TreatmentStage, TreatmentPlanStatus, TreatmentStageStatus } from '../../types';

interface TreatmentPlanModalProps {
  isOpen: boolean;
  patientId: string;
  plan: TreatmentPlan | null;
  findings: DentalFinding[];
  onClose: () => void;
  onSave: (plan: TreatmentPlan) => Promise<void>;
}

const PLAN_STATUSES: { value: TreatmentPlanStatus; label: string }[] = [
  { value: 'draft', label: 'Черновик' },
  { value: 'approved', label: 'Согласован' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'completed', label: 'Завершён' },
  { value: 'cancelled', label: 'Отменён' },
];

const STAGE_STATUSES: { value: TreatmentStageStatus; label: string }[] = [
  { value: 'planned', label: 'Запланирован' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'completed', label: 'Завершён' },
  { value: 'cancelled', label: 'Отменён' },
];

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Низкая',
  medium: 'Средняя',
  high: 'Высокая',
  urgent: 'Срочно',
};

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

export function TreatmentPlanModal({ isOpen, patientId, plan, findings, onClose, onSave }: TreatmentPlanModalProps) {
  const [formData, setFormData] = useState<Partial<TreatmentPlan>>({
    title: '',
    status: 'draft',
    stages: [],
  });

    useEffect(() => {
    if (isOpen) {
      if (plan) {
    // eslint-disable-next-line react-hooks/set-state-in-effect
        setFormData({ ...plan });
      } else {

        setFormData({
          title: '',
          status: 'draft',
          stages: [],
        });
      }
    }
  }, [isOpen, plan]);

  if (!isOpen) return null;

  const findingsById = new Map(findings.map(finding => [finding.id, finding]));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const addStage = () => {
    const newStage: TreatmentStage = {
      id: `stage_${Date.now()}`,
      title: '',
      teeth: [],
      description: '',
      price: 0,
      status: 'planned'
    };

    setFormData(prev => ({ ...prev, stages: [...(prev.stages || []), newStage] }));
  };

  const updateStage = (stageId: string, field: keyof TreatmentStage, value: string | number | number[]) => {

    setFormData(prev => ({
      ...prev,
      stages: prev.stages?.map(s => s.id === stageId ? { ...s, [field]: value } : s)
    }));
  };

  const removeStage = (stageId: string) => {

    setFormData(prev => ({
      ...prev,
      stages: prev.stages?.filter(s => s.id !== stageId)
    }));
  };

  const parseTeeth = (input: string): number[] => {
    return input.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
  };

  const calculateTotal = (stages: TreatmentStage[] = []) => {
    return stages.reduce((sum, stage) => sum + (Number(stage.price) || 0), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const stages = formData.stages || [];
    const planToSave: TreatmentPlan = {
      id: plan?.id || `plan_${Date.now()}`,
      patientId: plan?.patientId || patientId,
      title: formData.title || 'Новый план лечения',
      status: formData.status || 'draft',
      stages,
      totalPrice: calculateTotal(stages),
      createdAt: plan?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onSave(planToSave);
  };

  const total = calculateTotal(formData.stages);

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">
            {plan ? 'Редактирование плана лечения' : 'Новый план лечения'}
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <form id="plan-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Название плана</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title || ''}
                  onChange={handleChange}
                  placeholder="Например, Имплантация ВЧ"
                  required
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Статус плана</label>
                <select
                  name="status"
                  value={formData.status || 'draft'}
                  onChange={handleChange}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  {PLAN_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-slate-700">Этапы лечения</label>
                <button
                  type="button"
                  onClick={addStage}
                  className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" /> Добавить этап
                </button>
              </div>

              <div className="space-y-4">
                {(!formData.stages || formData.stages.length === 0) && (
                  <div className="text-center p-6 bg-slate-50 border border-slate-200 border-dashed rounded-lg text-slate-500 text-sm">
                    Нет добавленных этапов. Нажмите "Добавить этап".
                  </div>
                )}
                {formData.stages?.map((stage, index) => (
                  <div key={stage.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50 relative group">
                    <button
                      type="button"
                      onClick={() => removeStage(stage.id)}
                      className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="font-medium text-sm text-slate-800 mb-3">Этап {index + 1}</div>

                    {stage.findingIds && stage.findingIds.length > 0 && (
                      <div className="mb-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                        <div className="text-xs font-semibold text-blue-800 mb-2">Связанные проблемы</div>
                        <div className="space-y-2">
                          {stage.findingIds.map(findingId => {
                            const finding = findingsById.get(findingId);

                            if (!finding) {
                              return (
                                <div key={findingId} className="text-sm text-slate-500 bg-white border border-slate-200 rounded-md p-2">
                                  Связанная проблема не найдена
                                </div>
                              );
                            }

                            return (
                              <div key={findingId} className="flex flex-wrap items-center gap-2 text-sm bg-white border border-blue-100 rounded-md p-2">
                                {finding.toothNumber && (
                                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md text-xs font-bold">
                                    {finding.toothNumber}
                                  </span>
                                )}
                                <span className="font-medium text-slate-800">{finding.title}</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[finding.severity]}`}>
                                  {SEVERITY_LABELS[finding.severity] || finding.severity}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <input
                          type="text"
                          value={stage.title}
                          onChange={(e) => updateStage(stage.id, 'title', e.target.value)}
                          placeholder="Название этапа..."
                          required
                          className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={stage.teeth.join(', ')}
                          onChange={(e) => updateStage(stage.id, 'teeth', parseTeeth(e.target.value))}
                          placeholder="Зубы (через запятую, напр. 11, 21)"
                          className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <input
                          type="text"
                          value={stage.description}
                          onChange={(e) => updateStage(stage.id, 'description', e.target.value)}
                          placeholder="Описание работ..."
                          className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <select
                          value={stage.status}
                          onChange={(e) => updateStage(stage.id, 'status', e.target.value as TreatmentStageStatus)}
                          className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          {STAGE_STATUSES.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <input
                          type="number"
                          value={stage.price || ''}
                          onChange={(e) => updateStage(stage.id, 'price', Number(e.target.value))}
                          placeholder="Стоимость (₸)"
                          className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <div className="font-semibold text-slate-800">
            Итого: <span className="text-blue-600">{total.toLocaleString()} ₸</span>
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
              form="plan-form"
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
