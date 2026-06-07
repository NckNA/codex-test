import { useMemo, useState } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { storage } from '../../utils/storage';
import type { DentalFinding, FindingStatus, TreatmentPlan, TreatmentPlanStatus, TreatmentStage } from '../../types';

interface CreatePlanFromFindingsModalProps {
  patientId: string;
  isOpen: boolean;
  onClose: () => void;
  onPlanCreated: (plan: TreatmentPlan) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  caries: 'Кариес',
  missing_tooth: 'Отсутствующий зуб',
  gum_problem: 'Проблема десны',
  root_problem: 'Проблема корня',
  bite_problem: 'Проблема прикуса',
  aesthetic_problem: 'Эстетическая проблема',
  pain: 'Боль',
  risk_zone: 'Зона риска',
  hygiene: 'Гигиена',
  prosthetics: 'Протезирование',
  implantology: 'Имплантация',
  other: 'Другое',
};

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

const STATUS_LABELS: Record<string, string> = {
  discovered: 'Выявлено',
  recommended: 'Рекомендовано',
  included_in_plan: 'Включено в план',
  observing: 'Наблюдение',
  declined_by_patient: 'Отказ',
  completed: 'Завершено',
};

const ELIGIBLE_STATUSES = new Set<FindingStatus>(['discovered', 'recommended', 'observing']);
const ACTIVE_PLAN_STATUSES = new Set<TreatmentPlanStatus>(['draft', 'approved', 'in_progress']);

export function CreatePlanFromFindingsModal({
  patientId,
  isOpen,
  onClose,
  onPlanCreated,
}: CreatePlanFromFindingsModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const findings = useMemo(() => {
    if (!isOpen) return [];
    return storage.getFindings(patientId);
  }, [isOpen, patientId]);

  const plans = useMemo(() => {
    if (!isOpen) return [];
    return storage.getTreatmentPlans(patientId);
  }, [isOpen, patientId]);

  const linkedPlanByFindingId = useMemo(() => {
    const linked = new Map<string, string>();

    plans
      .filter(plan => ACTIVE_PLAN_STATUSES.has(plan.status))
      .forEach(plan => {
        plan.stages.forEach(stage => {
          stage.findingIds?.forEach(findingId => {
            if (!linked.has(findingId)) {
              linked.set(findingId, plan.title);
            }
          });
        });
      });

    return linked;
  }, [plans]);

  const visibleFindings = useMemo(() => {
    return findings.filter(finding => {
      const linkedPlanTitle = linkedPlanByFindingId.get(finding.id);
      const visibleStatus = ELIGIBLE_STATUSES.has(finding.status) || Boolean(linkedPlanTitle);
      const archivedStatus = finding.status === 'completed' || finding.status === 'declined_by_patient';

      return finding.includeInTreatmentPlan && visibleStatus && !archivedStatus;
    });
  }, [findings, linkedPlanByFindingId]);

  if (!isOpen) return null;

  const toggleFinding = (finding: DentalFinding) => {
    if (linkedPlanByFindingId.has(finding.id)) return;

    setSelectedIds(prev => (
      prev.includes(finding.id)
        ? prev.filter(id => id !== finding.id)
        : [...prev, finding.id]
    ));
  };

  const buildStageDescription = (finding: DentalFinding) => {
    return [finding.description, finding.recommendation ? `Рекомендация: ${finding.recommendation}` : '']
      .filter(Boolean)
      .join('\n\n');
  };

  const handleCreatePlan = () => {
    const selectedFindings = visibleFindings.filter(finding => selectedIds.includes(finding.id));
    if (selectedFindings.length === 0) return;

    const now = new Date().toISOString();
    const planTimestamp = Date.now();
    const stages: TreatmentStage[] = selectedFindings.map((finding, index) => ({
      id: `stage_${planTimestamp}_${index}_${finding.id}`,
      title: finding.title,
      teeth: finding.toothNumber ? [finding.toothNumber] : [],
      description: buildStageDescription(finding),
      price: 0,
      status: 'planned',
      findingIds: [finding.id],
      source: 'from_finding',
    }));

    const plan: TreatmentPlan = {
      id: `plan_${planTimestamp}`,
      patientId,
      title: `План лечения от ${new Date().toLocaleDateString('ru-RU')}`,
      status: 'draft',
      stages,
      totalPrice: 0,
      createdAt: now,
      updatedAt: now,
    };

    storage.addTreatmentPlan(patientId, plan);
    selectedFindings.forEach(finding => {
      storage.updateFinding(patientId, {
        ...finding,
        status: 'included_in_plan',
        includeInTreatmentPlan: true,
        updatedAt: now,
      });
    });

    onPlanCreated(plan);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Создать план из проблем</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {visibleFindings.length === 0 ? (
            <div className="text-center p-8 bg-slate-50 border border-slate-200 border-dashed rounded-lg flex flex-col items-center">
              <p className="text-slate-600 font-medium mb-3">Нет проблем для включения в план лечения</p>
              <div className="text-sm text-slate-500 text-left max-w-md">
                <p className="mb-2">Возможные причины:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>У пациента еще нет добавленных проблем.</li>
                  <li>В настройках существующих проблем не стоит галочка «Включить в план лечения».</li>
                  <li>Проблемы уже переведены в статус «Завершено» или «Отказ».</li>
                  <li>Все доступные проблемы уже включены в другие активные планы лечения.</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleFindings.map(finding => {
                const linkedPlanTitle = linkedPlanByFindingId.get(finding.id);
                const isLinked = Boolean(linkedPlanTitle);
                const isSelected = selectedIds.includes(finding.id);

                return (
                  <div
                    key={finding.id}
                    onClick={() => toggleFinding(finding)}
                    aria-disabled={isLinked}
                    className={`border rounded-lg p-4 transition-colors ${
                      isLinked
                        ? 'bg-slate-50 border-slate-200 opacity-75 cursor-not-allowed'
                        : isSelected
                          ? 'bg-blue-50 border-blue-300'
                          : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isLinked}
                        onChange={() => toggleFinding(finding)}
                        onClick={event => event.stopPropagation()}
                        className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          {finding.toothNumber && (
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md text-sm font-bold">
                              {finding.toothNumber}
                            </span>
                          )}
                          <span className="font-semibold text-slate-800">{finding.title}</span>
                          {isLinked && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-medium">
                              <CheckCircle className="w-3 h-3" />
                              Уже в плане{linkedPlanTitle ? `: ${linkedPlanTitle}` : ''}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3 text-xs">
                          <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            {CATEGORY_LABELS[finding.category] || finding.category}
                          </span>
                          <span className={`px-2 py-1 rounded-full font-medium ${SEVERITY_COLORS[finding.severity]}`}>
                            {SEVERITY_LABELS[finding.severity] || finding.severity}
                          </span>
                          <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                            {STATUS_LABELS[finding.status] || finding.status}
                          </span>
                        </div>

                        <div className="space-y-2 text-sm text-slate-600">
                          {finding.description && (
                            <div>
                              <span className="font-medium text-slate-700">Описание:</span> {finding.description}
                            </div>
                          )}
                          {finding.recommendation && (
                            <div className="p-2 bg-white rounded-md border border-blue-100 text-blue-800">
                              <span className="font-medium">Рекомендация:</span> {finding.recommendation}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleCreatePlan}
            disabled={selectedIds.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm"
          >
            Создать план
          </button>
        </div>
      </div>
    </div>
  );
}
