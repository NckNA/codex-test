import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, AlertTriangle, Activity, CheckCircle, Clock } from 'lucide-react';
import type { DentalFinding, FindingStatus } from '../../types';
import type { CreateFindingInput } from '../../data/repositories/FindingsRepository';
import { FindingModal } from './FindingModal';
import { useChiefComplaint } from '../../data/hooks/useChiefComplaint';
import { usePatientFindings } from '../../data/hooks/usePatientFindings';

interface FindingsRisksTabProps {
  patientId: string;
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

export const STATUS_LABELS: Record<FindingStatus, string> = {
  discovered: 'Выявлено',
  planned: 'В плане',
  in_treatment: 'В лечении',
  completed: 'Завершено',
  declined_by_patient: 'Отказ',
  monitoring: 'Наблюдение',
  archived: 'Архив',
};

const VALID_TEETH = new Set([
  18, 17, 16, 15, 14, 13, 12, 11,
  21, 22, 23, 24, 25, 26, 27, 28,
  48, 47, 46, 45, 44, 43, 42, 41,
  31, 32, 33, 34, 35, 36, 37, 38
]);

export function FindingsRisksTab({ patientId }: FindingsRisksTabProps) {
  const {
    findings,
    isLoading: isFindingsLoading,
    createFinding,
    updateFinding,
    deleteFinding,
  } = usePatientFindings(patientId);

  const [complaintText, setComplaintText] = useState('');
  const [complaintTeethInput, setComplaintTeethInput] = useState('');
  const [teethError, setTeethError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<DentalFinding | null>(null);

  const [isSaved, setIsSaved] = useState(false);

  const { complaint, isLoading: isComplaintLoading, isSaving: isComplaintSaving, saveComplaint } = useChiefComplaint(patientId);

  useEffect(() => {
    if (complaint) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setComplaintText(complaint.text);
      setComplaintTeethInput(complaint.relatedTeeth.join(', '));
    } else if (!isComplaintLoading) {
      setComplaintText('');
      setComplaintTeethInput('');
    }
  }, [complaint, isComplaintLoading]);

  const handleSaveComplaint = async () => {
    const rawTeeth = complaintTeethInput.split(',').map(s => s.trim()).filter(s => s !== '');
    const validTeethIds: number[] = [];
    const invalidTeeth: string[] = [];

    for (const t of rawTeeth) {
      const num = parseInt(t, 10);
      if (VALID_TEETH.has(num)) {
        validTeethIds.push(num);
      } else {
        invalidTeeth.push(t);
      }
    }

    if (invalidTeeth.length > 0) {
      setTeethError(`Некорректные номера зубов: ${invalidTeeth.join(', ')}. Введите номера в формате FDI (например: 47, 48).`);
      return;
    }

    setTeethError('');
    await saveComplaint({
      text: complaintText,
      relatedTeeth: validTeethIds,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleDelete = async (findingId: string) => {
    if (!window.confirm('Удалить эту запись?')) return;

    try {
      await deleteFinding(findingId);
    } catch (e) {
      console.error('Failed to delete finding', e);
    }
  };

  const handleStatusChange = async (finding: DentalFinding, newStatus: DentalFinding['status']) => {
    try {
      await updateFinding({
        ...finding,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Failed to update finding status', e);
    }
  };

  const handleSaveFinding = async (findingDraft: CreateFindingInput | DentalFinding): Promise<void> => {
    try {
      if ('id' in findingDraft) {
        await updateFinding(findingDraft);
      } else {
        await createFinding(findingDraft);
      }

      setIsModalOpen(false);
      setSelectedFinding(null);
    } catch (e) {
      console.error('Failed to save finding', e);
      // Important: leave modal open on error.
    }
  };

  const openModal = (finding?: DentalFinding) => {
    setSelectedFinding(finding || null);
    setIsModalOpen(true);
  };

  const categorizedFindings = {
    chiefComplaintRelated: findings.filter(f => f.isChiefComplaintRelated),
    discovered: findings.filter(f => !f.isChiefComplaintRelated && f.status === 'discovered' && f.category !== 'risk_zone'),
    riskZones: findings.filter(f => !f.isChiefComplaintRelated && (f.category === 'risk_zone' || f.status === 'monitoring')),
    inPlan: findings.filter(f => f.status === 'planned'),
    other: findings.filter(f => f.status === 'completed' || f.status === 'declined_by_patient'),
  };

  const FindingCard = ({ finding }: { finding: DentalFinding }) => (
    <div className="group bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          {finding.toothNumber && (
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md text-sm font-bold">
              {finding.toothNumber}
            </span>
          )}
          <h4 className="font-semibold text-slate-800">{finding.title}</h4>
        </div>
        <div className="flex gap-1">
          <button 
            onClick={() => openModal(finding)} 
            disabled={isFindingsLoading}
            className="p-1.5 text-slate-400 hover:text-blue-600 rounded bg-slate-50 hover:bg-blue-50 transition-colors disabled:opacity-50"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => handleDelete(finding.id)} 
            disabled={isFindingsLoading}
            className="p-1.5 text-slate-400 hover:text-red-600 rounded bg-slate-50 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3 text-xs">
        <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          {CATEGORY_LABELS[finding.category] || finding.category}
        </span>
        <span className={`px-2 py-1 rounded-full font-medium ${SEVERITY_COLORS[finding.severity]}`}>
          {SEVERITY_LABELS[finding.severity]}
        </span>
        <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
          {STATUS_LABELS[finding.status]}
        </span>
        {finding.isChiefComplaintRelated && (
          <span className="px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-100 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> По жалобе
          </span>
        )}
        {finding.includeInTreatmentPlan && finding.status !== 'planned' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-emerald-100">
            <CheckCircle className="w-3 h-3" /> В план
          </span>
        )}
      </div>

      <div className="space-y-2 text-sm text-slate-600">
        {finding.description && (
          <div><span className="font-medium text-slate-700">Описание:</span> {finding.description}</div>
        )}
        {finding.riskDescription && (
          <div><span className="font-medium text-amber-700">Риск:</span> {finding.riskDescription}</div>
        )}
        {finding.recommendation && (
          <div className="p-2 bg-blue-50 rounded-md border border-blue-100 text-blue-800">
            <span className="font-medium">Рекомендация:</span> {finding.recommendation}
          </div>
        )}
      </div>

      {finding.status !== 'planned' && finding.status !== 'completed' && (
        <div className="flex gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
          {finding.status !== 'monitoring' && (
             <button 
               onClick={() => handleStatusChange(finding, 'monitoring')} 
               disabled={isFindingsLoading}
               className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors disabled:opacity-50"
             >
               В наблюдение
             </button>
          )}
          {finding.status !== 'declined_by_patient' && (
             <button 
               onClick={() => handleStatusChange(finding, 'declined_by_patient')} 
               disabled={isFindingsLoading}
               className="text-xs px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded transition-colors disabled:opacity-50"
             >
               Отказ пациента
             </button>
          )}
          <button 
            onClick={() => handleStatusChange(finding, 'completed')} 
            disabled={isFindingsLoading}
            className="text-xs px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded transition-colors ml-auto disabled:opacity-50"
          >
            Завершить
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Проблемы и риски</h2>
          <p className="text-sm text-slate-500 mt-1">
            Проблемы, отмеченные «Включить в план лечения», можно будет объединить в план во вкладке «План лечения».
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" /> Добавить проблему
        </button>
      </div>

      {/* Основная жалоба */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 relative">
        {isComplaintLoading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-xl">
            <span className="text-sm text-slate-500">Загрузка...</span>
          </div>
        )}
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Основная жалоба
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Жалоба пациента</label>
            <textarea
              value={complaintText}
              onChange={e => setComplaintText(e.target.value)}
              rows={3}
              placeholder="Пациент обратился с жалобой..."
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Связанные зубы</label>
            <input
              type="text"
              value={complaintTeethInput}
              onChange={e => setComplaintTeethInput(e.target.value)}
              placeholder="Например: 47, 48"
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
            {teethError && (
              <p className="text-red-500 text-xs mt-1">{teethError}</p>
            )}
            <div className="mt-2 text-xs text-slate-500">Введите номера зубов через запятую.</div>
          </div>
        </div>

        <div className="flex justify-end items-center gap-3">
          {isSaved && (
            <span className="text-sm font-medium text-emerald-600 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" /> Сохранено
            </span>
          )}
            <button
              onClick={handleSaveComplaint}
              disabled={isComplaintLoading || isComplaintSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isComplaintSaving ? 'Сохранение...' : 'Сохранить жалобу'}
            </button>
        </div>

        {categorizedFindings.chiefComplaintRelated.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <h4 className="font-medium text-slate-700 mb-3 text-sm">Проблемы, связанные с жалобой:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categorizedFindings.chiefComplaintRelated.map(f => <FindingCard key={f.id} finding={f} />)}
            </div>
          </div>
        )}
      </div>

      {/* Выявленные проблемы */}
      {categorizedFindings.discovered.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-500" /> Выявленные проблемы
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categorizedFindings.discovered.map(f => <FindingCard key={f.id} finding={f} />)}
          </div>
        </section>
      )}

      {/* Зоны риска / наблюдение */}
      {categorizedFindings.riskZones.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" /> Зоны риска / наблюдение
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categorizedFindings.riskZones.map(f => <FindingCard key={f.id} finding={f} />)}
          </div>
        </section>
      )}

      {/* Включено в план лечения */}
      {categorizedFindings.inPlan.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 opacity-75">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-500" /> Включено в план лечения
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categorizedFindings.inPlan.map(f => <FindingCard key={f.id} finding={f} />)}
          </div>
        </section>
      )}

      {/* Не включено / отказ пациента / завершено */}
      {categorizedFindings.other.length > 0 && (
        <section className="bg-slate-50 rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-600 mb-4">Архив / Отказ / Завершено</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-75">
            {categorizedFindings.other.map(f => <FindingCard key={f.id} finding={f} />)}
          </div>
        </section>
      )}

      <FindingModal
        isOpen={isModalOpen}
        finding={selectedFinding}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveFinding}
      />
    </div>
  );
}