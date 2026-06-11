import { useState, useEffect } from 'react';
import { ToothGrid } from './ToothGrid';
import { ToothEditorModal } from './ToothEditorModal';
import { ToothZoneSelectorModal, ToothZone } from './ToothZoneSelectorModal';
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
  const [isZoneSelectorOpen, setIsZoneSelectorOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState<ToothZone | undefined>();

  const [complaints, setComplaints] = useState('');
  const [diagnosis, setDiagnosis] = useState('');

  // Sync text fields when chart loads
  useEffect(() => {
    if (dentalChart) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setComplaints(dentalChart.complaints || '');
       
      setDiagnosis(dentalChart.diagnosis || '');
    }
  }, [dentalChart]);

  if (isChartLoading && !dentalChart) return null;
  if (!dentalChart) return null;

  const handleToothClick = (tooth: ToothRecord) => {
    setSelectedTooth(tooth);
    setIsZoneSelectorOpen(true);
  };

  const handleZoneSelect = (zone: ToothZone) => {
    setSelectedZone(zone);
    setIsZoneSelectorOpen(false);
    setIsModalOpen(true);
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
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">Зубная карта (FDI)</h3>
      </div>

      <div className="flex flex-col lg:flex-row">
        <div className="flex-1 p-6 bg-slate-50 overflow-x-auto border-b lg:border-b-0 lg:border-r border-slate-200">
          <ToothGrid 
            teeth={dentalChart.teeth} 
            findings={findings} 
            onToothClick={handleToothClick}
            selectedToothNumber={selectedTooth?.toothNumber}
          />
        </div>

        <div className="w-full lg:w-64 bg-white p-5 shrink-0 flex flex-col">
          <h4 className="font-medium text-slate-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Проблемы по карте
          </h4>
          <div className="space-y-4 text-sm">
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

      {/* Legend */}
      <div className="px-6 py-3 border-y border-slate-200 bg-white flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm border border-slate-300 bg-white"></div> Здоров</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm border border-orange-400 bg-orange-100"></div> Кариес (C)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm border border-blue-400 bg-blue-100"></div> Пломба (F)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm border border-slate-300 bg-slate-100 opacity-50"></div> Удалён (X)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm border border-yellow-400 bg-yellow-100"></div> Коронка (Cr)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm border border-purple-400 bg-purple-100"></div> Имплант (I)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm border border-red-300 bg-red-50"></div> Корень (R)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm border border-red-500 bg-red-100"></div> Пульпит (P)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm border border-rose-500 bg-rose-100"></div> Периодонтит (Pt)</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm border border-amber-500 bg-amber-100"></div> Требует лечения (!)</div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white">
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

      <ToothZoneSelectorModal
        isOpen={isZoneSelectorOpen}
        toothNumber={selectedTooth?.toothNumber || null}
        onClose={() => setIsZoneSelectorOpen(false)}
        onSelectZone={handleZoneSelect}
      />

      <ToothEditorModal
        isOpen={isModalOpen}
        patientId={patientId}
        existingFindings={findings}
        tooth={selectedTooth}
        defaultZone={selectedZone}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTooth}
      />
    </div>
  );
}
