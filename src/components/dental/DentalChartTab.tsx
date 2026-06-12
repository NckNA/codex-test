import { useState, useEffect } from 'react';
import { ToothGrid, type DentitionMode } from './ToothGrid';
import { ToothEditorModal } from './ToothEditorModal';
import type { ToothRecord, DentalFinding } from '../../types';
import type { ToothStatusFindingInput } from '../../data/orchestrators/ClinicalWorkflowOrchestrator';
import { Save, AlertTriangle } from 'lucide-react';
import { useDentalChart } from '../../data/hooks/useDentalChart';
import { usePatientFindings } from '../../data/hooks/usePatientFindings';
import { useClinicalWorkflow } from '../../data/hooks/useClinicalWorkflow';

interface DentalChartTabProps {
  patientId: string;
}

function normalizeFindingPayload(
  findingPayload: Partial<DentalFinding> | null
): ToothStatusFindingInput | null {
  if (!findingPayload?.title || !findingPayload.category || !findingPayload.severity) {
    return null;
  }

  return {
    title: findingPayload.title,
    category: findingPayload.category,
    severity: findingPayload.severity,
    description: findingPayload.description,
    riskDescription: findingPayload.riskDescription,
    recommendation: findingPayload.recommendation,
    isChiefComplaintRelated: findingPayload.isChiefComplaintRelated,
    includeInTreatmentPlan: findingPayload.includeInTreatmentPlan,
    status: findingPayload.status,
    clinicalZone: findingPayload.clinicalZone,
    diagnosisIds: findingPayload.diagnosisIds,
    plannedWorkIds: findingPayload.plannedWorkIds,
    plannedWorkRecordIds: findingPayload.plannedWorkRecordIds,
  };
}

export function DentalChartTab({ patientId }: DentalChartTabProps) {
  const {
    dentalChart,
    isLoading: isChartLoading,
    saveDentalChart,
    refetch: refetchDentalChart,
  } = useDentalChart(patientId);

  const {
    findings,
    refetch: refetchFindings,
  } = usePatientFindings(patientId);

  const { applyToothStatusChange } = useClinicalWorkflow();

  const [selectedTooth, setSelectedTooth] = useState<ToothRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dentitionMode, setDentitionMode] = useState<DentitionMode>('adult');

  const [complaints, setComplaints] = useState('');
  const [diagnosis, setDiagnosis] = useState('');

  // Sync text fields when chart loads
  useEffect(() => {
    if (dentalChart) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setComplaints(dentalChart.complaints || '');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDiagnosis(dentalChart.diagnosis || '');
    }
  }, [dentalChart]);

  if (isChartLoading && !dentalChart) return null;
  if (!dentalChart) return null;

  const handleToothClick = (tooth: ToothRecord) => {
    setSelectedTooth(tooth);
    setIsModalOpen(true);
  };

  const handleDentitionModeChange = (mode: DentitionMode) => {
    setDentitionMode(mode);
    setSelectedTooth(null);
    setIsModalOpen(false);
  };

  const handleSaveTooth = async (
    updatedTooth: ToothRecord,
    findingPayload: Partial<DentalFinding> | null
  ) => {
    if (!dentalChart) return;

    const normalizedFindingPayload = normalizeFindingPayload(findingPayload);

    try {
      await applyToothStatusChange({
        patientId,
        chart: dentalChart,
        updatedTooth,
        findingPayload: normalizedFindingPayload,
      });

      await refetchDentalChart();
      await refetchFindings();

      setIsModalOpen(false);
    } catch (e) {
      console.error('Failed to save tooth update', e);
      // Important: leave modal open on error.
    }
  };

  const summary = {
    active: findings.filter(f => ['discovered', 'recommended', 'included_in_plan', 'observing'].includes(f.status)).length,
    highUrgent: findings.filter(f => ['high', 'urgent'].includes(f.severity) && ['discovered', 'recommended', 'included_in_plan'].includes(f.status)).length,
    inPlan: findings.filter(f => f.status === 'included_in_plan').length,
    observing: findings.filter(f => f.status === 'observing').length,
  };

  const handleSaveTextData = async () => {
    if (!dentalChart) return;
    const newChart = {
      ...dentalChart,
      complaints,
      diagnosis,
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveDentalChart(newChart);
    } catch (e) {
      console.error('Failed to save dental chart text data', e);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="p-3 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 flex flex-wrap items-center gap-2">
          Зубная карта (FDI)
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            {dentitionMode === 'adult' ? 'Постоянная' : 'Молочная'}
          </span>
        </h3>
      </div>

      <div className="flex flex-col lg:flex-row">
        <div className="min-w-0 flex-1 bg-slate-50 p-4 border-b lg:border-b-0 lg:border-r border-slate-200">
          <ToothGrid
            teeth={dentalChart.teeth}
            findings={findings}
            onToothClick={handleToothClick}
            selectedToothNumber={selectedTooth?.toothNumber}
            dentitionMode={dentitionMode}
            onDentitionModeChange={handleDentitionModeChange}
          />
        </div>

        <div className="w-full lg:w-56 bg-white p-4 shrink-0 flex flex-col">
          <h4 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Проблемы по карте
          </h4>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Активных проблем:</span>
              <span className="font-semibold text-slate-800">{summary.active}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Высокий риск/срочно:</span>
              <span className="font-semibold text-red-600">{summary.highUrgent}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">В плане лечения:</span>
              <span className="font-semibold text-emerald-600">{summary.inPlan}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">В наблюдении:</span>
              <span className="font-semibold text-blue-600">{summary.observing}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white border-t border-slate-200">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Жалобы</label>
          <textarea
            value={complaints}
            onChange={e => setComplaints(e.target.value)}
            rows={4}
            placeholder="Жалобы пациента..."
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none bg-slate-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Клиническая картина</label>
          <textarea
            value={diagnosis}
            onChange={e => setDiagnosis(e.target.value)}
            rows={4}
            placeholder="Описание клинической картины..."
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none bg-slate-50"
          />
        </div>
      </div>

      <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
        <button
          onClick={handleSaveTextData}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Save className="w-4 h-4" />
          Сохранить текст
        </button>
      </div>

      <ToothEditorModal
        isOpen={isModalOpen}
        patientId={patientId}
        existingFindings={findings}
        tooth={selectedTooth}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTooth}
      />
    </div>
  );
}
