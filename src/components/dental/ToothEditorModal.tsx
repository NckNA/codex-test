import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BookOpen, Plus, RefreshCcw, Save, X } from 'lucide-react';
import type {
  ClinicalZone,
  DentalFinding,
  FindingCategory,
  FindingSeverity,
  FindingStatus,
  PlannedWorkRecord,
  ToothPresenceStatus,
  ToothRecord,
  ToothVisualState,
} from '../../types';
import { normalizeToothRecord } from '../../utils/dentalChartNormalization';
import type { ToothZone } from './ToothZoneSelectorModal';
import {
  defaultClinicalWorks,
  defaultDiagnoses,
  getAvailableZonesForPresence,
  getBaseWorksByPresenceAndZone,
  getDiagnosesByPresenceAndZone,
  getWorksByDiagnoses,
  getWorksByPresenceAndZone,
  type ClinicalWork,
} from '../../config/clinicalDictionaries';

interface ToothEditorModalProps {
  isOpen: boolean;
  tooth: ToothRecord | null;
  patientId: string;
  existingFindings: DentalFinding[];
  defaultZone?: ToothZone;
  onClose: () => void;
  onSave: (tooth: ToothRecord, findingData: Partial<DentalFinding> | null) => void;
}

const PRESENCE_STATUSES: { value: ToothPresenceStatus; label: string; hint: string }[] = [
  { value: 'natural', label: 'Естественный зуб', hint: 'Обычный постоянный зуб' },
  { value: 'missing', label: 'Отсутствует', hint: 'Зуб удалён или отсутствует' },
  { value: 'implant', label: 'Имплант', hint: 'Установлен имплант' },
  { value: 'root_remnant', label: 'Остаток корня', hint: 'Коронковая часть отсутствует' },
  { value: 'deciduous', label: 'Молочный зуб', hint: 'Временный зуб' },
  { value: 'impacted', label: 'Ретинированный', hint: 'Не прорезался / расположен неправильно' },
];

const VISUAL_STATES: { value: ToothVisualState; label: string }[] = [
  { value: 'healthy', label: 'Здоров' },
  { value: 'caries', label: 'Кариес' },
  { value: 'filled', label: 'Пломба' },
  { value: 'missing', label: 'Удалён / отсутствует' },
  { value: 'crown', label: 'Коронка' },
  { value: 'implant', label: 'Имплант' },
  { value: 'root', label: 'Корень' },
  { value: 'pulpitis', label: 'Пульпит' },
  { value: 'periodontitis', label: 'Периодонтит' },
  { value: 'needs_treatment', label: 'Требует лечения' },
];

const ZONE_LABELS: Record<ClinicalZone, string> = {
  crown: 'Коронка',
  endodontics: 'Каналы',
  root: 'Корень',
  periodontium: 'Десна',
  bone: 'Кость',
  orthopedics: 'Ортопедия',
  planning: 'Планирование',
};

const ZONE_HINTS: Record<ClinicalZone, string> = {
  crown: 'Диагнозы и работы по коронковой части зуба',
  endodontics: 'Эндодонтия, пульпа и корневые каналы',
  root: 'Корень, верхушка корня и периапикальные изменения',
  periodontium: 'Десна, пародонт и мягкие ткани',
  bone: 'Костная ткань и хирургическое планирование',
  orthopedics: 'Ортопедические конструкции и протезирование',
  planning: 'Планирование восстановления отсутствующего зуба',
};

type CheckboxItem = {
  id: string;
  name: string;
  description?: string;
  price?: number;
};

function mapToClinicalZone(zone?: ToothZone): ClinicalZone {
  if (zone === 'gum') return 'periodontium';
  if (zone === 'root') return 'endodontics';
  if (zone === 'bone') return 'bone';
  return 'crown';
}

function clearVisualOverride(tooth: ToothRecord): ToothRecord {
  const nextTooth = { ...tooth };
  delete nextTooth.visualStateOverride;
  return nextTooth;
}

function createRecordId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `planned_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getFirstAvailableZone(presenceStatus: ToothPresenceStatus, preferredZone?: ClinicalZone): ClinicalZone {
  const availableZones = getAvailableZonesForPresence(presenceStatus);

  if (preferredZone && availableZones.includes(preferredZone)) {
    return preferredZone;
  }

  return availableZones[0] || 'crown';
}

function deriveVisualState(
  presenceStatus: ToothPresenceStatus,
  diagnosisIds: string[],
  plannedWorkIds: string[],
  fallbackCondition: ToothVisualState,
): ToothVisualState {
  if (presenceStatus === 'missing') return 'missing';
  if (presenceStatus === 'implant') return 'implant';
  if (presenceStatus === 'root_remnant') return 'root';

  const diagnosisSet = new Set(diagnosisIds);
  const workSet = new Set(plannedWorkIds);

  if (['dx_irreversible_pulpitis', 'dx_reversible_pulpitis', 'dx_pulp_necrosis'].some((id) => diagnosisSet.has(id))) {
    return 'pulpitis';
  }

  if (['dx_apical_periodontitis', 'dx_periodontal_pocket', 'dx_peri_implantitis', 'dx_radicular_cyst'].some((id) => diagnosisSet.has(id))) {
    return 'periodontitis';
  }

  if (['dx_caries_initial', 'dx_caries_enamel', 'dx_caries_dentin', 'dx_deep_caries', 'dx_root_caries'].some((id) => diagnosisSet.has(id))) {
    return 'caries';
  }

  if (['work_implant_crown', 'work_crown'].some((id) => workSet.has(id))) {
    return 'crown';
  }

  if (fallbackCondition !== 'healthy') return fallbackCondition;
  return diagnosisIds.length > 0 || plannedWorkIds.length > 0 ? 'needs_treatment' : 'healthy';
}

function formatPrice(price?: number): string | null {
  if (typeof price !== 'number') return null;
  return `${price.toLocaleString('ru-RU')} ₸`;
}

function getWorkIds(records: PlannedWorkRecord[]): string[] {
  return [...new Set(records.map((record) => record.workId))];
}

function getZoneWorkIds(records: PlannedWorkRecord[], zone: ClinicalZone): string[] {
  return records.filter((record) => record.zone === zone).map((record) => record.workId);
}

function toCheckboxItem(item: { id: string; name: string; description?: string; price?: number }): CheckboxItem {
  const checkboxItem: CheckboxItem = {
    id: item.id,
    name: item.name,
  };

  if (item.description) checkboxItem.description = item.description;
  if (typeof item.price === 'number') checkboxItem.price = item.price;

  return checkboxItem;
}

function ClinicalCheckboxList({
  items,
  selectedIds,
  onToggle,
}: {
  items: CheckboxItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const isSelected = selectedIds.includes(item.id);
        const price = formatPrice(item.price);

        return (
          <label
            key={item.id}
            className={`flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors cursor-pointer ${
              isSelected
                ? 'border-blue-300 bg-blue-50 text-blue-950'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggle(item.id)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="flex-1">
              <span className="font-medium">{item.name}</span>
              {item.description && <span className="block text-xs text-slate-500 mt-0.5">{item.description}</span>}
              {price && <span className="block text-xs font-semibold text-slate-500 mt-1">{price}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function ToothEditorModal({ isOpen, tooth, defaultZone, onClose, onSave }: ToothEditorModalProps) {
  const [formData, setFormData] = useState<ToothRecord | null>(null);
  const [activeZone, setActiveZone] = useState<ClinicalZone>('crown');
  const [manualVisualState, setManualVisualState] = useState(false);
  const [createFinding, setCreateFinding] = useState(false);

  useEffect(() => {
    if (isOpen && tooth) {
      const normalizedTooth = normalizeToothRecord(tooth);
      const preferredZone = mapToClinicalZone(defaultZone);
      const nextZone = getFirstAvailableZone(normalizedTooth.presenceStatus || 'natural', preferredZone);

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData(normalizedTooth);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveZone(nextZone);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setManualVisualState(Boolean(normalizedTooth.visualStateOverride));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCreateFinding(false);
    }
  }, [isOpen, tooth, defaultZone]);

  const currentPresence = formData?.presenceStatus || 'natural';
  const availableZones = useMemo(() => getAvailableZonesForPresence(currentPresence), [currentPresence]);
  const currentZone = availableZones.includes(activeZone) ? activeZone : getFirstAvailableZone(currentPresence);
  const diagnosisIds = formData?.diagnoses || [];
  const plannedWorkRecords = formData?.plannedWorkRecords || [];
  const plannedWorkIds = getWorkIds(plannedWorkRecords);
  const currentZoneWorkIds = getZoneWorkIds(plannedWorkRecords, currentZone);

  const availableDiagnoses = useMemo(
    () => getDiagnosesByPresenceAndZone(currentPresence, currentZone),
    [currentPresence, currentZone],
  );

  const allZoneWorks = useMemo(
    () => getWorksByPresenceAndZone(currentPresence, currentZone),
    [currentPresence, currentZone],
  );

  const baseWorks = useMemo(
    () => getBaseWorksByPresenceAndZone(currentPresence, currentZone),
    [currentPresence, currentZone],
  );

  const treatmentWorks = useMemo(
    () => getWorksByDiagnoses(currentPresence, currentZone, diagnosisIds).filter((work) => work.workAccessType === 'requires_diagnosis'),
    [currentPresence, currentZone, diagnosisIds],
  );

  if (!isOpen || !tooth || !formData) return null;

  const automaticVisualState = deriveVisualState(currentPresence, diagnosisIds, plannedWorkIds, formData.condition);
  const computedVisualState = manualVisualState && formData.visualStateOverride
    ? formData.visualStateOverride
    : automaticVisualState;

  const presenceLabel = PRESENCE_STATUSES.find((status) => status.value === currentPresence)?.label || currentPresence;
  const visualLabel = VISUAL_STATES.find((state) => state.value === computedVisualState)?.label || computedVisualState;
  const hasZoneData = availableDiagnoses.length > 0 || allZoneWorks.length > 0;

  const setPresenceStatus = (presenceStatus: ToothPresenceStatus) => {
    const nextZone = getFirstAvailableZone(presenceStatus);

    setFormData((prev) => {
      if (!prev) return prev;
      return {
        ...clearVisualOverride(prev),
        presenceStatus,
        diagnoses: [],
        plannedWorks: [],
        plannedWorkRecords: [],
      };
    });
    setManualVisualState(false);
    setActiveZone(nextZone);
  };

  const toggleDiagnosis = (diagnosisId: string) => {
    setFormData((prev) => {
      if (!prev) return prev;

      const nextDiagnosisIds = prev.diagnoses?.includes(diagnosisId)
        ? prev.diagnoses.filter((id) => id !== diagnosisId)
        : [...(prev.diagnoses || []), diagnosisId];
      const allowedWorkIds = new Set(
        getWorksByDiagnoses(prev.presenceStatus || 'natural', currentZone, nextDiagnosisIds).map((work) => work.id),
      );
      const nextRecords = (prev.plannedWorkRecords || []).filter((record) => (
        record.zone !== currentZone || allowedWorkIds.has(record.workId)
      ));

      return {
        ...prev,
        diagnoses: nextDiagnosisIds,
        plannedWorkRecords: nextRecords,
        plannedWorks: getWorkIds(nextRecords),
      };
    });
  };

  const toggleWork = (work: ClinicalWork) => {
    setFormData((prev) => {
      if (!prev) return prev;

      const currentRecords = prev.plannedWorkRecords || [];
      const hasWork = currentRecords.some((record) => record.zone === currentZone && record.workId === work.id);
      const now = new Date().toISOString();
      const nextRecords = hasWork
        ? currentRecords.filter((record) => !(record.zone === currentZone && record.workId === work.id))
        : [...currentRecords, {
          id: createRecordId(),
          workId: work.id,
          zone: currentZone,
          status: 'planned',
          createdAt: now,
          updatedAt: now,
        }];

      return {
        ...prev,
        plannedWorkRecords: nextRecords,
        plannedWorks: getWorkIds(nextRecords),
      };
    });
  };

  const setVisualStateOverride = (visualState: ToothVisualState) => {
    setFormData((prev) => prev ? { ...prev, visualStateOverride: visualState } : prev);
  };

  const resetToHealthy = () => {
    const now = new Date().toISOString();

    setFormData({
      ...clearVisualOverride(formData),
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
      notes: '',
      presenceStatus: 'natural',
      visualState: 'healthy',
      diagnoses: [],
      plannedWorks: [],
      plannedWorkRecords: [],
      completedWorks: [],
      updatedAt: now,
    });
    setManualVisualState(false);
    setActiveZone('crown');
    setCreateFinding(false);
  };

  const buildFindingPayload = (): Partial<DentalFinding> | null => {
    if (!createFinding) return null;

    const selectedDiagnosisNames = diagnosisIds.map((id) => defaultDiagnoses.find((diagnosis) => diagnosis.id === id)?.name || id);
    const selectedWorkNames = plannedWorkIds.map((id) => defaultClinicalWorks.find((work) => work.id === id)?.name || id);

    return {
      title: `Клиническая запись: зуб ${tooth.toothNumber}`,
      category: 'other' as FindingCategory,
      severity: 'medium' as FindingSeverity,
      description: [
        `Анатомический статус: ${presenceLabel}`,
        `Зона: ${ZONE_LABELS[currentZone]}`,
        selectedDiagnosisNames.length > 0 ? `Диагнозы: ${selectedDiagnosisNames.join(', ')}` : '',
        selectedWorkNames.length > 0 ? `Работы: ${selectedWorkNames.join(', ')}` : '',
        formData.notes ? `Заметка: ${formData.notes}` : '',
      ].filter(Boolean).join(' | '),
      status: 'discovered' as FindingStatus,
      isChiefComplaintRelated: false,
      includeInTreatmentPlan: selectedWorkNames.length > 0,
    };
  };

  const handleSave = () => {
    const nextToothBase: ToothRecord = {
      ...clearVisualOverride(formData),
      condition: computedVisualState,
      visualState: computedVisualState,
      plannedWorks: getWorkIds(formData.plannedWorkRecords || []),
      updatedAt: new Date().toISOString(),
    };
    const nextTooth = manualVisualState
      ? { ...nextToothBase, visualStateOverride: formData.visualStateOverride || computedVisualState }
      : nextToothBase;

    onSave(nextTooth, buildFindingPayload());
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              Зуб <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">{tooth.toothNumber}</span>
            </h2>
            <p className="text-sm text-slate-500 mt-1">Клиническая запись · {presenceLabel}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <aside className="space-y-5">
            <section className="bg-blue-50/60 p-4 rounded-xl border border-blue-100 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1.5">Анатомический статус</label>
                <select
                  value={currentPresence}
                  onChange={(event) => setPresenceStatus(event.target.value as ToothPresenceStatus)}
                  className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {PRESENCE_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-blue-700/80">
                  {PRESENCE_STATUSES.find((status) => status.value === currentPresence)?.hint}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1.5">Отображение на формуле</label>
                {!manualVisualState ? (
                  <div className="p-3 bg-white border border-blue-200 rounded-lg text-sm text-slate-700 space-y-2">
                    <div>
                      Расчётное состояние: <span className="font-semibold">{visualLabel}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setManualVisualState(true);
                        setVisualStateOverride(computedVisualState);
                      }}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 underline"
                    >
                      Изменить вручную
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <select
                      value={formData.visualStateOverride || computedVisualState}
                      onChange={(event) => setVisualStateOverride(event.target.value as ToothVisualState)}
                      className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {VISUAL_STATES.map((state) => (
                        <option key={state.value} value={state.value}>{state.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setManualVisualState(false);
                        setFormData((prev) => prev ? clearVisualOverride(prev) : prev);
                      }}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700 underline"
                    >
                      Вернуть автоматический расчёт
                    </button>
                  </div>
                )}
              </div>
            </section>

            <section>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Общие заметки</label>
              <textarea
                value={formData.notes || ''}
                onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[110px] resize-none"
                placeholder="Дополнительные комментарии врача..."
              />
            </section>

            <section className="bg-orange-50 p-4 rounded-xl border border-orange-100">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createFinding}
                  onChange={(event) => setCreateFinding(event.target.checked)}
                  className="mt-0.5 h-4 w-4 text-orange-500 border-slate-300 rounded focus:ring-orange-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-orange-900">Создать клиническую проблему</span>
                  <span className="block text-xs text-orange-700 mt-1">Находка будет создана по выбранным диагнозам, зоне и заметке врача.</span>
                </span>
              </label>
            </section>
          </aside>

          <main className="min-w-0 flex flex-col">
            <div className="flex overflow-x-auto border-b border-slate-200 mb-4" style={{ scrollbarWidth: 'none' }}>
              {availableZones.map((zone) => (
                <button
                  key={zone}
                  type="button"
                  onClick={() => setActiveZone(zone)}
                  className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                    currentZone === zone
                      ? 'border-blue-500 text-blue-700 bg-blue-50/40'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {ZONE_LABELS[zone]}
                </button>
              ))}
            </div>

            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800">{ZONE_LABELS[currentZone]}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{ZONE_HINTS[currentZone]}</p>
            </div>

            {!hasZoneData ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">Справочник не настроен для этой зоны</p>
                <p className="text-xs text-slate-400 mt-1">Диагнозы и работы появятся после настройки справочников.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {availableDiagnoses.length > 0 && (
                  <section className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                      Диагнозы / состояния
                    </h3>
                    <ClinicalCheckboxList
                      items={availableDiagnoses.map(toCheckboxItem)}
                      selectedIds={diagnosisIds}
                      onToggle={toggleDiagnosis}
                    />
                  </section>
                )}

                {baseWorks.length > 0 && (
                  <section className="bg-blue-50/40 p-4 rounded-xl border border-blue-100">
                    <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Plus className="w-3.5 h-3.5" />
                      Базовые / доступные работы
                    </h3>
                    <ClinicalCheckboxList
                      items={baseWorks.map(toCheckboxItem)}
                      selectedIds={currentZoneWorkIds}
                      onToggle={(id) => {
                        const work = baseWorks.find((item) => item.id === id);
                        if (work) toggleWork(work);
                      }}
                    />
                  </section>
                )}

                <section className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-100">
                  <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5" />
                    Лечебные работы
                  </h3>
                  {allZoneWorks.some((work) => work.workAccessType === 'requires_diagnosis') && diagnosisIds.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">Выберите диагноз выше, чтобы увидеть доступные лечебные работы.</p>
                  ) : treatmentWorks.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">Нет лечебных работ для выбранных диагнозов в этой зоне.</p>
                  ) : (
                    <ClinicalCheckboxList
                      items={treatmentWorks.map(toCheckboxItem)}
                      selectedIds={currentZoneWorkIds}
                      onToggle={(id) => {
                        const work = treatmentWorks.find((item) => item.id === id);
                        if (work) toggleWork(work);
                      }}
                    />
                  )}
                </section>
              </div>
            )}
          </main>
        </div>

        <div className="flex items-center justify-between gap-3 p-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={resetToHealthy}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCcw className="w-4 h-4" /> Сбросить
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
              type="button"
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
            >
              <Save className="w-4 h-4" />
              Сохранить изменения
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
