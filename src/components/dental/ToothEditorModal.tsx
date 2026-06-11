import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Plus, BookOpen } from 'lucide-react';
import { MultiSelectCombobox } from './MultiSelectCombobox';
import type { ToothRecord, VisualState, ToothPresenceStatus, DentalFinding, FindingCategory, FindingSeverity, FindingStatus, PlannedWorkRecord } from '../../types';
import { tabsByPresenceStatus, defaultDiagnoses, defaultWorks } from '../../config/clinicalDictionaries';
import type { ClinicalZone } from '../../types';
import { calculateVisualState } from '../../utils/visualStateCalculator';

interface ToothEditorModalProps {
  isOpen: boolean;
  tooth: ToothRecord | null;
  patientId: string;
  existingFindings: DentalFinding[];
  onClose: () => void;
  onSave: (tooth: ToothRecord, findingData: Partial<DentalFinding> | null) => void;
}

const PRESENCE_STATUSES: { value: ToothPresenceStatus; label: string }[] = [
  { value: 'natural', label: 'Естественный зуб' },
  { value: 'missing', label: 'Отсутствует (давно)' },
  { value: 'extracted_recent', label: 'Недавно удален (лунка)' },
  { value: 'implant', label: 'Имплант' },
  { value: 'root_remnant', label: 'Остаток корня' },
  { value: 'primary', label: 'Молочный зуб' },
  { value: 'unerupted', label: 'Непрорезавшийся' },
  { value: 'impacted', label: 'Ретинированный' },
  { value: 'supernumerary', label: 'Сверхкомплектный' },
];

const VISUAL_STATES: { value: VisualState; label: string }[] = [
  { value: 'healthy', label: 'Здоров (Белый)' },
  { value: 'caries', label: 'Кариес (Оранжевый)' },
  { value: 'filled', label: 'Пломба (Синий)' },
  { value: 'missing', label: 'Удалён (Прозрачный)' },
  { value: 'crown', label: 'Коронка (Желтый)' },
  { value: 'implant', label: 'Имплант (Фиолетовый)' },
  { value: 'root', label: 'Корень (Красный)' },
  { value: 'pulpitis', label: 'Пульпит (Светло-красный)' },
  { value: 'periodontitis', label: 'Периодонтит (Розовый)' },
  { value: 'needs_treatment', label: 'Требует лечения (Янтарный)' },
  { value: 'sensitivity', label: 'Чувствительность (Голубой)' },
  { value: 'crack', label: 'Повреждение/Трещина (Светло-бордовый)' },
  { value: 'hygiene_required', label: 'Нарушение гигиены (Жёлтый)' },
];

export function ToothEditorModal({ isOpen, tooth, onClose, onSave }: ToothEditorModalProps) {
  const [formData, setFormData] = useState<Partial<ToothRecord>>({});
  const [activeTab, setActiveTab] = useState<ClinicalZone>('crown');
  const [createFinding, setCreateFinding] = useState(false);

  useEffect(() => {
    if (isOpen && tooth) {
      const presence = tooth.presenceStatus || 'natural';
      const availableTabs = tabsByPresenceStatus[presence] || tabsByPresenceStatus['natural'];
      setActiveTab(availableTabs[0]?.id || 'crown');
      setFormData({
        ...tooth,
        diagnoses: tooth.diagnoses || [],
        plannedWorks: tooth.plannedWorks || [],
        plannedWorkRecords: tooth.plannedWorkRecords || [],
        isVisualStateManual: tooth.isVisualStateManual || false,
        visualStateOverride: tooth.visualStateOverride || tooth.visualState,
      });
      setCreateFinding(false);
    }
  }, [isOpen, tooth]);

  if (!isOpen || !tooth || !formData.presenceStatus) return null;

  const currentPresence = formData.presenceStatus;
  const currentTabs = tabsByPresenceStatus[currentPresence] || [];

  // --- Seed data fallback: use defaultDiagnoses / defaultWorks as the base.
  // When an admin dictionary is later introduced, replace these with:
  // const activeDiagnoses = adminDictionaries?.diagnoses ?? defaultDiagnoses;
  const activeDiagnoses = defaultDiagnoses;
  const activeWorks = defaultWorks;

  // Filter by current presence status AND active tab/zone
  const availableDiagnoses = activeDiagnoses.filter(d =>
    d.allowedPresenceStatuses.includes(currentPresence) && d.allowedZones.includes(activeTab)
  );

  const allAvailableWorks = activeWorks.filter(w =>
    w.allowedPresenceStatuses.includes(currentPresence) && w.allowedZones.includes(activeTab)
  );

  const baseWorks = allAvailableWorks.filter(w => w.workAccessType === 'base_available');

  const statusAvailableWorks = allAvailableWorks.filter(w => w.workAccessType === 'status_available');

  const selectedDiagnosisIds = formData.diagnoses || [];
  const treatmentWorks = allAvailableWorks.filter(w => {
    if (w.workAccessType !== 'requires_diagnosis') return false;
    return selectedDiagnosisIds.some(diagId => w.allowedDiagnosisIds.includes(diagId));
  });

  const computedVisualState = formData.isVisualStateManual && formData.visualStateOverride
    ? formData.visualStateOverride
    : calculateVisualState(currentPresence, formData.diagnoses || [], formData.plannedWorkRecords || [], formData.completedWorks || []);

  const handleWorksChange = (ids: string[]) => {
    setFormData(prev => {
      const otherRecords = (prev.plannedWorkRecords || []).filter(r => r.zone !== activeTab);
      const newRecords: PlannedWorkRecord[] = ids.map(id => ({
        id: crypto.randomUUID(),
        workId: id,
        diagnosisIds: prev.diagnoses || [],
        zone: activeTab,
        toothId: tooth.toothNumber.toString(),
        status: 'planned'
      }));
      return {
        ...prev,
        plannedWorkRecords: [...otherRecords, ...newRecords],
        plannedWorks: [...new Set([...(prev.plannedWorks || []), ...ids])]
      };
    });
  };

  const currentTabWorkIds = (formData.plannedWorkRecords || [])
    .filter(r => r.zone === activeTab)
    .map(r => r.workId);

  const handlePresenceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPresence = e.target.value as ToothPresenceStatus;
    setFormData(prev => ({ ...prev, presenceStatus: newPresence, diagnoses: [], plannedWorkRecords: [], plannedWorks: [] }));
    const newTabs = tabsByPresenceStatus[newPresence] || [];
    setActiveTab(newTabs[0]?.id || 'crown');
  };

  const handleSave = () => {
    const findingData: Partial<DentalFinding> | null = createFinding ? {
      title: `Проблема: Зуб ${tooth.toothNumber}`,
      category: 'other' as FindingCategory,
      severity: 'medium' as FindingSeverity,
      description: [
        formData.notes ? `Заметка: ${formData.notes}` : '',
        selectedDiagnosisIds.length > 0
          ? `Диагнозы: ${selectedDiagnosisIds.map(id => activeDiagnoses.find(d => d.id === id)?.name || id).join(', ')}`
          : '',
        `Зона: ${currentTabs.find(t => t.id === activeTab)?.label || activeTab}`,
        `Статус: ${PRESENCE_STATUSES.find(p => p.value === currentPresence)?.label || currentPresence}`,
        `Отображение: ${VISUAL_STATES.find(s => s.value === computedVisualState)?.label || computedVisualState}`,
      ].filter(Boolean).join(' | '),
      status: 'discovered' as FindingStatus,
    } : null;

    onSave({ ...formData, visualState: computedVisualState } as ToothRecord, findingData);
  };

  const hasSeedData = availableDiagnoses.length > 0 || allAvailableWorks.length > 0;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Зуб {tooth.toothNumber}</h2>
            <p className="text-sm text-slate-500">Клиническая запись · {PRESENCE_STATUSES.find(p => p.value === currentPresence)?.label}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6">

          {/* Left Column */}
          <div className="w-full md:w-1/3 space-y-5">
            {/* Presence Status */}
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">
                  Анатомический статус
                </label>
                <select
                  value={currentPresence}
                  onChange={handlePresenceChange}
                  className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {PRESENCE_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Visual State */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-blue-700 uppercase tracking-wider">
                  Отображение на формуле
                </label>
                {!formData.isVisualStateManual ? (
                  <div className="p-3 bg-white border border-blue-200 rounded-lg text-sm text-slate-700 flex flex-col gap-2">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      Расчётный: <span className="font-semibold">{VISUAL_STATES.find(s => s.value === computedVisualState)?.label || computedVisualState}</span>
                    </span>
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, isVisualStateManual: true, visualStateOverride: computedVisualState }))}
                      className="text-xs text-blue-600 hover:text-blue-800 text-left underline"
                    >
                      Изменить вручную
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <select
                      value={formData.visualStateOverride || computedVisualState}
                      onChange={e => setFormData(prev => ({ ...prev, visualStateOverride: e.target.value as VisualState }))}
                      className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {VISUAL_STATES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, isVisualStateManual: false }))}
                      className="text-xs text-slate-500 hover:text-slate-700 text-left underline"
                    >
                      Вернуть автоматический расчёт
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Общие заметки</label>
              <textarea
                value={formData.notes || ''}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[90px] resize-none"
                placeholder="Дополнительные комментарии врача..."
              />
            </div>

            {/* Create Finding */}
            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createFinding}
                  onChange={e => setCreateFinding(e.target.checked)}
                  className="w-4 h-4 text-orange-500 border-slate-300 rounded focus:ring-orange-500"
                />
                <span className="text-sm font-medium text-orange-900">Создать находку (Проблема)</span>
              </label>
              <p className="mt-1.5 text-xs text-orange-700 ml-7">
                Будет добавлена в список проблем пациента с привязкой к зубу, зоне и заметке врача.
              </p>
            </div>
          </div>

          {/* Right Column */}
          <div className="w-full md:w-2/3 flex flex-col min-h-0">

            {/* Tabs */}
            <div className="flex overflow-x-auto border-b border-slate-200 mb-4" style={{ scrollbarWidth: 'none' }}>
              {currentTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 bg-blue-50/30'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto space-y-5 pr-1">

              {!hasSeedData ? (
                // No seed data for this zone at all
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
                  <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">Справочник не настроен для этой зоны</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Диагнозы и работы для <strong>{currentTabs.find(t => t.id === activeTab)?.label}</strong> будут добавлены в административной части.
                  </p>
                </div>
              ) : (
                <>
                  {/* Diagnoses */}
                  {availableDiagnoses.length > 0 && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                        Диагнозы / Состояния
                      </h3>
                      <MultiSelectCombobox
                        label=""
                        placeholder="Поиск диагноза..."
                        options={availableDiagnoses.map(d => ({ id: d.id, name: d.name }))}
                        selectedIds={selectedDiagnosisIds}
                        onChange={ids => setFormData(prev => ({ ...prev, diagnoses: ids }))}
                      />
                    </div>
                  )}

                  {/* Base Works */}
                  {baseWorks.length > 0 && (
                    <div className="bg-blue-50/30 p-4 rounded-xl border border-blue-100">
                      <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Plus className="w-3.5 h-3.5" />
                        Базовые работы / Профилактика
                      </h3>
                      <MultiSelectCombobox
                        label=""
                        placeholder="Поиск услуги..."
                        options={baseWorks.map(w => ({ id: w.id, name: w.name, price: w.price }))}
                        selectedIds={currentTabWorkIds}
                        onChange={handleWorksChange}
                      />
                    </div>
                  )}

                  {/* Status-available works (no diagnosis needed) */}
                  {statusAvailableWorks.length > 0 && (
                    <div className="bg-purple-50/30 p-4 rounded-xl border border-purple-100">
                      <h3 className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Plus className="w-3.5 h-3.5" />
                        Доступные по статусу зуба
                      </h3>
                      <MultiSelectCombobox
                        label=""
                        placeholder="Поиск работы..."
                        options={statusAvailableWorks.map(w => ({ id: w.id, name: w.name, price: w.price }))}
                        selectedIds={currentTabWorkIds}
                        onChange={handleWorksChange}
                      />
                    </div>
                  )}

                  {/* Treatment Works (requires diagnosis) */}
                  {allAvailableWorks.some(w => w.workAccessType === 'requires_diagnosis') && (
                    <div className="bg-emerald-50/30 p-4 rounded-xl border border-emerald-100">
                      <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Plus className="w-3.5 h-3.5" />
                        Лечебные работы
                      </h3>
                      {selectedDiagnosisIds.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">
                          Выберите диагноз выше, чтобы увидеть доступные лечебные работы.
                        </p>
                      ) : treatmentWorks.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">
                          Нет лечебных работ для выбранных диагнозов в данной зоне.
                        </p>
                      ) : (
                        <MultiSelectCombobox
                          label=""
                          placeholder="Поиск работы..."
                          options={treatmentWorks.map(w => ({ id: w.id, name: w.name, price: w.price }))}
                          selectedIds={currentTabWorkIds}
                          onChange={handleWorksChange}
                        />
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Save className="w-4 h-4" />
            Сохранить изменения
          </button>
        </div>
      </div>
    </div>
  );
}
