import React, { useState, useEffect } from 'react';
import { X, RefreshCcw } from 'lucide-react';
import { SuggestionInput } from './SuggestionInput';
import { ToothZone } from './ToothZoneSelectorModal';
import type { ToothRecord, ToothCondition, ToothSurface, DentalFinding, FindingCategory, FindingSeverity, FindingStatus } from '../../types';

interface ToothEditorModalProps {
  isOpen: boolean;
  tooth: ToothRecord | null;
  patientId: string;
  existingFindings: DentalFinding[];
  defaultZone?: ToothZone;
  onClose: () => void;
  onSave: (tooth: ToothRecord, findingData: Partial<DentalFinding> | null) => void;
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

export function ToothEditorModal({ isOpen, tooth, defaultZone, onClose, onSave }: ToothEditorModalProps) {
  const [formData, setFormData] = useState<Partial<ToothRecord>>({});
  const [activeZone, setActiveZone] = useState<ToothZone>('crown');

  const [createFinding, setCreateFinding] = useState(false);
  const [findingData, setFindingData] = useState<Partial<DentalFinding>>({
    title: '',
    category: 'other',
    severity: 'medium',
    description: '',
    riskDescription: '',
    recommendation: '',
    isChiefComplaintRelated: false,
    includeInTreatmentPlan: false,
    status: 'discovered'
  });

  useEffect(() => {
    if (isOpen && tooth) {
      setActiveZone(defaultZone || 'crown');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({ ...tooth, surfaces: tooth.surfaces || [] });
      setCreateFinding(false);
      setFindingData({
        title: '',
        category: 'other',
        severity: 'medium',
        description: '',
        riskDescription: '',
        recommendation: '',
        isChiefComplaintRelated: false,
        includeInTreatmentPlan: false,
        status: 'discovered'
      });
    }
  }, [isOpen, tooth]);

  if (!isOpen || !tooth) return null;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'condition' && tooth) {
      applyDefaultFindingSuggestion(value as ToothCondition, tooth.toothNumber);
    }
  };

  const applyDefaultFindingSuggestion = (condition: ToothCondition, toothNumber: number) => {
    if (condition === 'caries') {
      setFindingData(prev => ({ ...prev, category: 'caries', title: `Кариес ${toothNumber} зуба`, severity: 'medium', description: 'Выявлено кариозное поражение.', recommendation: 'Рекомендовано лечение кариеса.' }));
    } else if (condition === 'missing') {
      setFindingData(prev => ({ ...prev, category: 'missing_tooth', title: `Отсутствует ${toothNumber} зуб`, severity: 'medium', description: 'Зуб отсутствует.', recommendation: 'Рекомендована консультация по восстановлению зубного ряда.' }));
    } else if (condition === 'pulpitis') {
      setFindingData(prev => ({ ...prev, category: 'pain', title: `Подозрение на пульпит ${toothNumber} зуба`, severity: 'high', description: 'Требуется клиническая оценка и лечение каналов по показаниям.', recommendation: 'Рекомендовано лечение у врача-стоматолога.' }));
    } else if (condition === 'periodontitis') {
      setFindingData(prev => ({ ...prev, category: 'root_problem', title: `Проблема корня / периодонта ${toothNumber} зуба`, severity: 'high', description: 'Выявлены признаки проблемы в области корня/периодонта.', recommendation: 'Рекомендована дополнительная диагностика и лечение по показаниям.' }));
    } else if (condition === 'needs_treatment') {
      setFindingData(prev => ({ ...prev, category: 'other', title: `Требует лечения ${toothNumber} зуб`, severity: 'medium', description: 'Зуб требует внимания врача.', recommendation: 'Рекомендовано включить в план лечения.' }));
    } else {
      setFindingData(prev => ({ ...prev, title: '', description: '', recommendation: '' }));
    }
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

    let findingPayload: Partial<DentalFinding> | null = null;
    if (createFinding) {
      findingPayload = { ...findingData };
      if (findingPayload.includeInTreatmentPlan) {
        findingPayload.status = 'recommended';
      }
    }

    onSave({
      ...tooth,
      ...formData,
      updatedAt: new Date().toISOString()
    } as ToothRecord, findingPayload);
  };

  const handleReset = () => {

    setFormData({
      toothNumber: tooth.toothNumber,
      condition: 'healthy',
      surfaces: [],
      crown: '',
      workCrown: '',
      root: '',
      workRoot: '',
      gum: '',
      workGum: '',
      bone: '',
      workBone: '',
      canal: '',
      workCanal: '',
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

        <div className="flex border-b border-slate-200">
          <button type="button" onClick={() => setActiveZone('crown')} className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${activeZone === 'crown' ? 'border-blue-500 text-blue-700 bg-blue-50/30' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>Коронка</button>
          <button type="button" onClick={() => setActiveZone('root')} className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${activeZone === 'root' ? 'border-purple-500 text-purple-700 bg-purple-50/30' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>Каналы</button>
          <button type="button" onClick={() => setActiveZone('gum')} className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${activeZone === 'gum' ? 'border-rose-500 text-rose-700 bg-rose-50/30' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>Десна</button>
          <button type="button" onClick={() => setActiveZone('bone')} className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${activeZone === 'bone' ? 'border-amber-500 text-amber-700 bg-amber-50/30' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>Кость</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <form id="tooth-form" onSubmit={handleSubmit} className="space-y-6">
            
            {activeZone === 'crown' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
                {/* A. Basic condition */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-sm font-semibold text-slate-800 mb-2">Основное состояние зуба</label>
                  <select
                    name="condition"
                    value={formData.condition || 'healthy'}
                    onChange={handleChange}
                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm font-medium bg-white shadow-sm"
                  >
                    {CONDITIONS.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {/* B. Surfaces */}
                {['caries', 'filled', 'needs_treatment'].includes(formData.condition || '') && (
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <label className="block text-sm font-semibold text-slate-800 mb-3">Поверхности</label>
                    <div className="flex flex-wrap gap-2">
                      {SURFACES.map(s => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => handleSurfaceToggle(s.value)}
                          className={`px-4 py-2 text-sm rounded-lg border transition-all ${
                            (formData.surfaces || []).includes(s.value)
                              ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold shadow-inner'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* C. Crown */}
                <SuggestionInput
                  label="Проблема: Коронка / Реставрация"
                  name="crown"
                  value={formData.crown || ''}
                  onChange={handleChange as unknown as (e: React.ChangeEvent<HTMLInputElement>) => void}
                  placeholder="Материал, дефекты..."
                  suggestions={[
                    "Кариес эмали", "Кариес дентина", "Глубокий кариес", 
                    "Скол эмали", "Скол коронки", "Дефект пломбы", "Вторичный кариес"
                  ]}
                />
                
                <SuggestionInput
                  label="Запланированная работа (Коронка)"
                  name="workCrown"
                  value={formData.workCrown || ''}
                  onChange={handleChange as unknown as (e: React.ChangeEvent<HTMLInputElement>) => void}
                  placeholder="План лечения..."
                  suggestions={[
                    "Фотополимерная реставрация", "Керамическая вкладка", 
                    "Металлокерамическая коронка", "Циркониевая коронка", "Винир"
                  ]}
                />
              </div>
            )}

            {activeZone === 'root' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
                <SuggestionInput
                  label="Проблема: Корни / Каналы"
                  name="canal"
                  value={formData.canal || ''}
                  onChange={handleChange as unknown as (e: React.ChangeEvent<HTMLInputElement>) => void}
                  placeholder="Пломбировка, изменения..."
                  suggestions={[
                    "Каналы запломбированы до верхушки", "Каналы недопломбированы", 
                    "Пустой канал", "Анкерный штифт", "Стекловолоконный штифт", 
                    "Обломок инструмента", "Перфорация"
                  ]}
                />
                <SuggestionInput
                  label="Запланированная работа (Каналы)"
                  name="workCanal"
                  value={formData.workCanal || ''}
                  onChange={handleChange as unknown as (e: React.ChangeEvent<HTMLInputElement>) => void}
                  placeholder="План лечения..."
                  suggestions={[
                    "Механическая и медикаментозная обработка", "Распломбировка каналов", 
                    "Пломбировка гуттаперчей", "Установка СВШ"
                  ]}
                />
              </div>
            )}

            {activeZone === 'gum' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
                <SuggestionInput
                  label="Проблема: Десна / Мягкие ткани"
                  name="gum"
                  value={formData.gum || ''}
                  onChange={handleChange as unknown as (e: React.ChangeEvent<HTMLInputElement>) => void}
                  placeholder="Рецессия, воспаление..."
                  suggestions={[
                    "Гингивит", "Рецессия десны", "Кровоточивость при зондировании", 
                    "Пародонтальный карман", "Свищ", "Отек"
                  ]}
                />
                <SuggestionInput
                  label="Запланированная работа (Десна)"
                  name="workGum"
                  value={formData.workGum || ''}
                  onChange={handleChange as unknown as (e: React.ChangeEvent<HTMLInputElement>) => void}
                  placeholder="План лечения..."
                  suggestions={[
                    "Закрытый кюретаж", "Открытый кюретаж", "Вектор-терапия", 
                    "Пластика десны", "Удаление зубных отложений"
                  ]}
                />
              </div>
            )}

            {activeZone === 'bone' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
                <SuggestionInput
                  label="Проблема: Костная ткань"
                  name="bone"
                  value={formData.bone || ''}
                  onChange={handleChange as unknown as (e: React.ChangeEvent<HTMLInputElement>) => void}
                  placeholder="Резорбция, карманы..."
                  suggestions={[
                    "Без видимых изменений", "Убыль костной ткани 1/3", 
                    "Убыль костной ткани 1/2", "Киста", "Гранулема", "Остеосклероз"
                  ]}
                />
                <SuggestionInput
                  label="Запланированная работа (Костная ткань)"
                  name="workBone"
                  value={formData.workBone || ''}
                  onChange={handleChange as unknown as (e: React.ChangeEvent<HTMLInputElement>) => void}
                  placeholder="План лечения..."
                  suggestions={[
                    "Резекция верхушки корня", "Цистотомия", 
                    "Направленная костная регенерация", "Удаление зуба"
                  ]}
                />
              </div>
            )}

            {/* G. Clinical notes */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <label className="block text-sm font-semibold text-slate-800 mb-2">Клинические заметки</label>
              <textarea
                name="notes"
                value={formData.notes || ''}
                onChange={handleChange}
                rows={3}
                placeholder="Дополнительная информация о зубе для врача..."
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none bg-slate-50 hover:bg-white transition-colors"
              ></textarea>
            </div>

            {/* H. Linked problem / finding */}
            <div className="pt-2">
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createFinding}
                    onChange={(e) => setCreateFinding(e.target.checked)}
                    className="w-5 h-5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-semibold text-blue-900">Создать или обновить проблему по этому зубу</span>
                </label>

                {createFinding && (
                  <div className="mt-5 space-y-5 bg-white p-5 rounded-xl border border-blue-100 shadow-sm">
                    <label className="flex items-center gap-2 cursor-pointer pb-2 border-b border-slate-100">
                      <input
                        type="checkbox"
                        checked={findingData.isChiefComplaintRelated}
                        onChange={(e) => setFindingData({ ...findingData, isChiefComplaintRelated: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-700">Связано с основной жалобой</span>
                    </label>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Название проблемы <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={findingData.title || ''}
                        onChange={(e) => setFindingData({ ...findingData, title: e.target.value })}
                        required
                        placeholder="Например: Глубокий кариес"
                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50 hover:bg-white transition-colors"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Категория <span className="text-red-500">*</span></label>
                        <select
                          value={findingData.category}
                          onChange={(e) => setFindingData({ ...findingData, category: e.target.value as FindingCategory })}
                          required
                          className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50 hover:bg-white transition-colors"
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
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Серьезность <span className="text-red-500">*</span></label>
                        <select
                          value={findingData.severity}
                          onChange={(e) => setFindingData({ ...findingData, severity: e.target.value as FindingSeverity })}
                          required
                          className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50 hover:bg-white transition-colors"
                        >
                          <option value="low">Низкая</option>
                          <option value="medium">Средняя</option>
                          <option value="high">Высокая</option>
                          <option value="urgent">Срочно</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Статус <span className="text-red-500">*</span></label>
                        <select
                          value={findingData.status}
                          onChange={(e) => setFindingData({ ...findingData, status: e.target.value as FindingStatus })}
                          required
                          className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50 hover:bg-white transition-colors"
                        >
                          <option value="discovered">Выявлено</option>
                          <option value="recommended">Рекомендовано</option>
                          <option value="included_in_plan">Включено в план</option>
                          <option value="observing">Наблюдение</option>
                          <option value="declined_by_patient">Пациент отказался</option>
                          <option value="completed">Завершено</option>
                        </select>
                      </div>
                      <div className="flex items-center pt-6">
                        <label className="flex items-center gap-2 cursor-pointer bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 w-full hover:bg-blue-100 transition-colors">
                          <input
                            type="checkbox"
                            checked={findingData.includeInTreatmentPlan}
                            onChange={(e) => setFindingData({ ...findingData, includeInTreatmentPlan: e.target.checked })}
                            className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm font-semibold text-blue-800">В план лечения</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Описание (для врача)</label>
                      <textarea
                        value={findingData.description || ''}
                        onChange={(e) => setFindingData({ ...findingData, description: e.target.value })}
                        rows={2}
                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none bg-slate-50 hover:bg-white transition-colors"
                      ></textarea>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Описание рисков (пациенту)</label>
                      <textarea
                        value={findingData.riskDescription || ''}
                        onChange={(e) => setFindingData({ ...findingData, riskDescription: e.target.value })}
                        rows={2}
                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none bg-slate-50 hover:bg-white transition-colors"
                      ></textarea>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Рекомендация</label>
                      <input
                        type="text"
                        value={findingData.recommendation || ''}
                        onChange={(e) => setFindingData({ ...findingData, recommendation: e.target.value })}
                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-slate-50 hover:bg-white transition-colors"
                      />
                    </div>
                  </div>
                )}
              </div>
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
