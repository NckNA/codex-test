import { X } from 'lucide-react';
import type {
  ChiefComplaint,
  DentalFinding,
  Patient,
  TreatmentPlan,
  TreatmentPlanStatus,
  TreatmentStageStatus,
} from '../../types';

interface TreatmentPlanPatientPreviewProps {
  patient: Patient | null;
  chiefComplaint: ChiefComplaint | null;
  findings: DentalFinding[];
  plan: TreatmentPlan | null;
  isOpen: boolean;
  onClose: () => void;
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

const FINDING_STATUS_LABELS: Record<string, string> = {
  discovered: 'Выявлено',
  recommended: 'Рекомендовано',
  included_in_plan: 'Включено в план',
  observing: 'Наблюдение',
  declined_by_patient: 'Отказ',
  completed: 'Завершено',
};

const PLAN_STATUS_LABELS: Record<TreatmentPlanStatus, string> = {
  draft: 'Черновик',
  approved: 'Согласован',
  in_progress: 'В работе',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

const STAGE_STATUS_LABELS: Record<TreatmentStageStatus, string> = {
  planned: 'Запланирован',
  in_progress: 'В работе',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

const IMPORTANT_NOTE = 'План лечения является предварительным и может быть уточнён врачом после осмотра, снимков или дополнительных данных.';

function FindingPreview({ finding }: { finding: DentalFinding }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {finding.toothNumber && (
          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md text-xs font-bold">
            Зуб {finding.toothNumber}
          </span>
        )}
        <span className="font-semibold text-slate-800">{finding.title}</span>
        <span className="px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200 text-xs">
          {CATEGORY_LABELS[finding.category] || finding.category}
        </span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[finding.severity]}`}>
          {SEVERITY_LABELS[finding.severity] || finding.severity}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-xs">
          {FINDING_STATUS_LABELS[finding.status] || finding.status}
        </span>
      </div>

      <div className="space-y-2 text-sm text-slate-600">
        {finding.description && (
          <p><span className="font-medium text-slate-700">Описание:</span> {finding.description}</p>
        )}
        {finding.riskDescription && (
          <p><span className="font-medium text-amber-700">Риск:</span> {finding.riskDescription}</p>
        )}
        {finding.recommendation && (
          <p className="rounded-md border border-blue-100 bg-white p-2 text-blue-800">
            <span className="font-medium">Рекомендация:</span> {finding.recommendation}
          </p>
        )}
      </div>
    </div>
  );
}

export function TreatmentPlanPatientPreview({
  patient,
  chiefComplaint,
  findings,
  plan,
  isOpen,
  onClose,
}: TreatmentPlanPatientPreviewProps) {
  if (!isOpen || !plan) return null;

  const linkedFindingIds = new Set(plan.stages.flatMap(stage => stage.findingIds || []));
  const linkedFindings = findings.filter(finding => linkedFindingIds.has(finding.id));
  const additionalFindings = findings.filter(finding => (
    !linkedFindingIds.has(finding.id)
    && finding.status !== 'completed'
    && (Boolean(finding.recommendation) || finding.status === 'observing' || !finding.includeInTreatmentPlan)
  ));

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-100 rounded-xl shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white rounded-t-xl">
          <h2 className="text-lg font-semibold text-slate-800">План лечения</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-4xl bg-white border border-slate-200 rounded-lg shadow-sm p-6 space-y-6">
            <header className="border-b border-slate-200 pb-5">
              <div className="text-xs uppercase tracking-wide text-blue-600 font-semibold mb-2">DentalFlow CRM</div>
              <h1 className="text-2xl font-bold text-slate-900 mb-4">План лечения</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-slate-500">Пациент</div>
                  <div className="font-semibold text-slate-800">{patient?.fullName || 'Пациент не найден'}</div>
                </div>
                <div>
                  <div className="text-slate-500">Дата</div>
                  <div className="font-semibold text-slate-800">{new Date(plan.createdAt).toLocaleDateString('ru-RU')}</div>
                </div>
                <div>
                  <div className="text-slate-500">Название плана</div>
                  <div className="font-semibold text-slate-800">{plan.title}</div>
                </div>
                <div>
                  <div className="text-slate-500">Статус плана</div>
                  <div className="font-semibold text-slate-800">{PLAN_STATUS_LABELS[plan.status]}</div>
                </div>
                <div>
                  <div className="text-slate-500">Врач</div>
                  <div className="font-semibold text-slate-800">не указан</div>
                </div>
              </div>
            </header>

            <section>
              <h3 className="text-base font-semibold text-slate-800 mb-3">1. Причина обращения</h3>
              {chiefComplaint ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <p>{chiefComplaint.text}</p>
                  <p className="mt-2 text-slate-500">
                    Связанные зубы: {chiefComplaint.relatedTeeth.length > 0 ? chiefComplaint.relatedTeeth.join(', ') : 'не указаны'}
                  </p>
                </div>
              ) : (
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Причина обращения не указана.</p>
              )}
            </section>

            <section>
              <h3 className="text-base font-semibold text-slate-800 mb-3">2. Выявленные проблемы и риски</h3>
              {linkedFindings.length > 0 ? (
                <div className="space-y-3">
                  {linkedFindings.map(finding => (
                    <FindingPreview key={finding.id} finding={finding} />
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                  Связанные с этим планом проблемы не указаны.
                </p>
              )}
            </section>

            <section>
              <h3 className="text-base font-semibold text-slate-800 mb-3">3. Основной план лечения</h3>
              {plan.stages.length > 0 ? (
                <div className="space-y-3">
                  {plan.stages.map((stage, index) => (
                    <div key={stage.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                        <div>
                          <div className="text-xs text-slate-500">Этап {index + 1}</div>
                          <div className="font-semibold text-slate-800">{stage.title}</div>
                        </div>
                        <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                          {STAGE_STATUS_LABELS[stage.status]}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2 text-sm text-slate-600">
                        {stage.teeth && stage.teeth.length > 0 && (
                          <div>
                            <span className="font-medium text-slate-700">Связанные зубы:</span> {stage.teeth.join(', ')}
                          </div>
                        )}
                        {stage.description && (
                          <div>
                            <span className="font-medium text-slate-700">Описание:</span> {stage.description}
                          </div>
                        )}
                        {stage.price > 0 && (
                          <div>
                            <span className="font-medium text-slate-700">Стоимость этапа:</span> {stage.price.toLocaleString()} ₸
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Этапы лечения не указаны.</p>
              )}
              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
                <div className="text-base font-semibold text-blue-900">
                  Ориентировочная итоговая стоимость: {plan.totalPrice > 0 ? `${plan.totalPrice.toLocaleString()} ₸` : 'не указана'}
                </div>
                {plan.totalPrice === 0 && (
                  <div className="mt-1 text-sm text-blue-800">Стоимость будет уточнена после заполнения этапов лечения.</div>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-base font-semibold text-slate-800 mb-3">4. Дополнительные рекомендации / зоны риска</h3>
              {additionalFindings.length > 0 ? (
                <div className="space-y-3">
                  {additionalFindings.map(finding => (
                    <FindingPreview key={finding.id} finding={finding} />
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                  Дополнительные рекомендации и зоны риска не указаны.
                </p>
              )}
            </section>

            <section>
              <h3 className="text-base font-semibold text-slate-800 mb-3">5. Важное примечание</h3>
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {IMPORTANT_NOTE}
              </p>
            </section>
          </div>
        </div>

        <div className="flex items-center justify-end p-4 border-t border-slate-200 bg-white rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
