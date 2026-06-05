import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ClipboardList, Eye, Cloud } from 'lucide-react';
import { storage } from '../../utils/storage';
import type { TreatmentPlan } from '../../types';
import { TreatmentPlanModal } from './TreatmentPlanModal';
import { CreatePlanFromFindingsModal } from './CreatePlanFromFindingsModal';
import { TreatmentPlanPatientPreview } from './TreatmentPlanPatientPreview';

interface TreatmentPlansTabProps {
  patientId: string;
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'draft': return 'Черновик';
    case 'approved': return 'Согласован';
    case 'in_progress': return 'В работе';
    case 'completed': return 'Завершён';
    case 'cancelled': return 'Отменён';
    default: return status;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'draft': return 'bg-slate-100 text-slate-700';
    case 'approved': return 'bg-blue-100 text-blue-700';
    case 'in_progress': return 'bg-amber-100 text-amber-700';
    case 'completed': return 'bg-green-100 text-green-700';
    case 'cancelled': return 'bg-red-100 text-red-700';
    default: return 'bg-slate-100 text-slate-700';
  }
};

export function TreatmentPlansTab({ patientId }: TreatmentPlansTabProps) {
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFindingsModalOpen, setIsFindingsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<TreatmentPlan | null>(null);
  const [previewPlan, setPreviewPlan] = useState<TreatmentPlan | null>(null);

  const loadPlans = () => {
    setPlans(storage.getTreatmentPlans(patientId));
  };

    useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const handleOpenModal = (plan: TreatmentPlan | null = null) => {
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };

  const handleSavePlan = (plan: TreatmentPlan) => {
    if (selectedPlan) {
      storage.updateTreatmentPlan(patientId, plan);
    } else {
      storage.addTreatmentPlan(patientId, plan);
    }

    loadPlans();
    setIsModalOpen(false);
  };

  const handlePlanCreatedFromFindings = () => {
    loadPlans();
    setIsFindingsModalOpen(false);
  };

  const handleDeletePlan = (planId: string) => {
    if (window.confirm('Вы уверены, что хотите удалить этот план лечения?')) {
      storage.deleteTreatmentPlan(patientId, planId);

      loadPlans();
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-slate-400" /> Планы лечения
        </h3>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            onClick={() => setIsFindingsModalOpen(true)}
            className="flex items-center gap-1.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <ClipboardList className="w-4 h-4" />
            Создать план из проблем
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Создать план
          </button>
        </div>
      </div>

      <div className="flex-1 p-6">
        {plans.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center py-12">
            <ClipboardList className="w-12 h-12 mb-3 text-slate-300" />
            <h3 className="text-base font-medium text-slate-700 mb-1">Нет планов лечения</h3>
            <p className="text-sm max-w-sm">
              У этого пациента пока нет составленных планов лечения. Нажмите кнопку выше, чтобы создать первый.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {plans.map(plan => (
              <div key={plan.id} className="border border-slate-200 rounded-lg bg-white overflow-hidden hover:border-blue-300 transition-colors">
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="font-semibold text-slate-800">{plan.title}</h4>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(plan.status)}`}>
                        {getStatusLabel(plan.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span>Этапов: {plan.stages.length}</span>
                      <span>Обновлен: {new Date(plan.updatedAt).toLocaleDateString('ru-RU')}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6">
                    <div className="text-right">
                      <div className="text-xs text-slate-500 mb-0.5">Сумма</div>
                      <div className="font-semibold text-slate-800">{plan.totalPrice.toLocaleString()} ₸</div>
                    </div>

                    <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                      <button
                        disabled
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-slate-400 bg-slate-50 cursor-not-allowed rounded-md border border-slate-200"
                        title="Интеграция с amoCRM будет доступна позже"
                      >
                        <Cloud className="w-4 h-4 text-slate-300" />
                        amoCRM: после подключения
                      </button>
                      <button
                        onClick={() => setPreviewPlan(plan)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-blue-700 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                        title="Предпросмотр для пациента"
                      >
                        <Eye className="w-4 h-4" />
                        Предпросмотр для пациента
                      </button>
                      <button
                        onClick={() => handleOpenModal(plan)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Редактировать"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePlan(plan.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <TreatmentPlanModal
        isOpen={isModalOpen}
        patientId={patientId}
        plan={selectedPlan}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSavePlan}
      />
      {isFindingsModalOpen && (
        <CreatePlanFromFindingsModal
          isOpen={isFindingsModalOpen}
          patientId={patientId}
          onClose={() => setIsFindingsModalOpen(false)}
          onPlanCreated={handlePlanCreatedFromFindings}
        />
      )}
      <TreatmentPlanPatientPreview
        isOpen={!!previewPlan}
        patientId={patientId}
        plan={previewPlan}
        onClose={() => setPreviewPlan(null)}
      />
    </div>
  );
}
