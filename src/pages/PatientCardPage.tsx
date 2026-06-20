import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';
import type { Patient } from '../types';
import { PatientModal } from '../components/patients/PatientModal';
import { DentalChartTab } from '../components/dental/DentalChartTab';
import { DentalPhotosPanel } from '../components/dental/DentalPhotosPanel';
import { TreatmentPlansTab } from '../components/treatment/TreatmentPlansTab';
import { FindingsRisksTab } from '../components/dental/FindingsRisksTab';
import { PatientOverviewTab } from '../components/patients/patient-card/PatientOverviewTab';
import { PatientHistoryTab } from '../components/patients/patient-card/PatientHistoryTab';
import { PatientTimelineTab } from '../components/patient/PatientTimelineTab';
import { VisitCheckInPanel } from '../components/visits/VisitCheckInPanel';
import { usePatientMedicalSummary } from '../data/hooks/usePatientMedicalSummary';
import { usePatientProfile } from '../data/hooks/usePatientProfile';
import { usePatientTimeline } from '../data/hooks/usePatientTimeline';
import { useTenant } from '../contexts/TenantContext';
import type { PatientTimelineEventCategory } from '../data/aggregators/PatientTimelineAggregator';

const TABS = [
  { id: 'overview', label: 'Обзор' },
  { id: 'timeline', label: 'История' },
  { id: 'history', label: 'История приёмов' },
  { id: 'visits', label: 'Визиты' },
  { id: 'dental_chart', label: 'Зубная карта' },
  { id: 'findings', label: 'Проблемы и риски' },
  { id: 'plan', label: 'План лечения' },
  { id: 'finance', label: 'Финансы' },
  { id: 'docs', label: 'Документы' },
  { id: 'communications', label: 'Коммуникации' },
  { id: 'files', label: 'Файлы' },
];

export function PatientCardPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { activeTenant } = useTenant();

  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [timelineIncludeArchived, setTimelineIncludeArchived] = useState(false);
  const [timelineCategory, setTimelineCategory] = useState<PatientTimelineEventCategory | 'all'>('all');

  const {
    patient,
    isLoading: isPatientLoading,
    isError: isPatientError,
    savePatient,
    refetch: refetchPatient,
  } = usePatientProfile(patientId || '');

  const {
    data: medicalSummary,
    isLoading: isMedicalSummaryLoading,
    isError: isMedicalSummaryError,
    refetch: refetchMedicalSummary,
  } = usePatientMedicalSummary(patientId || '');
  const { dentalSummary, lastVisit, nextVisit } = medicalSummary;

  const {
    events: timelineEvents,
    isLoading: isTimelineLoading,
    isError: isTimelineError,
    error: timelineError,
  } = usePatientTimeline({ patient, includeArchived: timelineIncludeArchived });

  const previousTabRef = useRef(activeTab);

  useEffect(() => {
    const isTransitioningToOverview =
      previousTabRef.current !== 'overview' && activeTab === 'overview';

    previousTabRef.current = activeTab;

    if (!isTransitioningToOverview) return;
    if (!patientId) return;
    if (isMedicalSummaryLoading) return;

    refetchMedicalSummary();
  }, [activeTab, patientId, isMedicalSummaryLoading, refetchMedicalSummary]);

  if (isPatientLoading && !patient) {
    return (
      <div className="p-8 h-full flex flex-col items-center justify-center bg-slate-50 text-slate-500">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-semibold text-slate-700 mb-2">Загрузка карточки пациента...</h2>
      </div>
    );
  }

  if (isPatientError && !patient) {
    return (
      <div className="p-8 h-full flex flex-col items-center justify-center bg-slate-50 text-slate-500">
        <User className="w-16 h-16 mb-4 text-red-300" />
        <h2 className="text-xl font-semibold text-slate-700 mb-2">Не удалось загрузить карточку пациента.</h2>
        <button
          onClick={() => refetchPatient()}
          className="px-4 py-2 bg-white border border-red-200 text-red-700 hover:bg-red-50 rounded-lg font-medium transition-colors"
        >
          Повторить
        </button>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-8 h-full flex flex-col items-center justify-center bg-slate-50 text-slate-500">
        <User className="w-16 h-16 mb-4 text-slate-300" />
        <h2 className="text-xl font-semibold text-slate-700 mb-2">Пациент не найден</h2>
        <p className="mb-6">Возможно, он был удален или ссылка недействительна.</p>
        <button
          onClick={() => navigate('/patients')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Вернуться к списку
        </button>
      </div>
    );
  }

  const handleSave = async (updated: Patient) => {
    try {
      await savePatient(updated);
      setIsModalOpen(false);
    } catch (e) {
      console.error('Failed to save patient', e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 pt-6 shrink-0">
        <button
          onClick={() => navigate('/patients')}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Назад к списку
        </button>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-2xl font-bold border border-blue-200 shadow-sm shrink-0">
              {patient.fullName.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 mb-1">{patient.fullName}</h1>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <span>{patient.phone}</span>
                <span className="text-slate-300">•</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  patient.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                }`}>
                  {patient.status === 'active' ? 'Активный' : 'Архив'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <User className="w-4 h-4" />
              Редактировать
            </button>
          </div>
        </div>

        <div className="flex gap-6 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              data-testid={`patient-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full"></span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'overview' && isMedicalSummaryLoading && (
          <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
            Медицинская сводка загружается...
          </div>
        )}

        {activeTab === 'overview' && isMedicalSummaryError && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center justify-between gap-4">
            <span>Не удалось загрузить медицинскую сводку.</span>
            <button 
              onClick={() => refetchMedicalSummary()}
              className="px-3 py-1 bg-white border border-red-200 text-red-700 hover:bg-red-100 rounded text-xs font-medium transition-colors"
            >
              Повторить
            </button>
          </div>
        )}

        {activeTab === 'overview' && (
          <PatientOverviewTab
            patient={patient}
            dentalSummary={dentalSummary}
            lastVisit={lastVisit}
            nextVisit={nextVisit}
            onNavigateToSchedule={() => navigate('/')}
          />
        )}

        {activeTab === 'timeline' && (
          <PatientTimelineTab
            events={timelineEvents}
            isLoading={isTimelineLoading}
            error={isTimelineError ? timelineError : null}
            role={activeTenant?.role}
            includeArchived={timelineIncludeArchived}
            onIncludeArchivedChange={setTimelineIncludeArchived}
            selectedCategory={timelineCategory}
            onSelectedCategoryChange={setTimelineCategory}
          />
        )}
        {activeTab === 'history' && <PatientHistoryTab patientId={patient.id} />}
        {activeTab === 'visits' && (
          <div data-testid="patient-visits-tab">
            <VisitCheckInPanel
              tenantId={activeTenant?.tenantId}
              patientId={patient.id}
              role={activeTenant?.role}
            />
          </div>
        )}
        {activeTab === 'dental_chart' && <DentalChartTab patientId={patient.id} />}
        {activeTab === 'findings' && <FindingsRisksTab patientId={patient.id} />}
        {activeTab === 'plan' && <TreatmentPlansTab patientId={patient.id} />}
        {activeTab === 'files' && <DentalPhotosPanel patientId={patient.id} />}

        {['finance', 'docs', 'communications'].includes(activeTab) && (
          <div className="p-8 h-[400px] flex flex-col items-center justify-center text-slate-400 bg-white rounded-xl border border-slate-200 border-dashed">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
              <span className="text-2xl">🚧</span>
            </div>
            <h2 className="text-lg font-medium text-slate-700 mb-2">В разработке</h2>
            <p className="text-sm">Вкладка будет реализована в следующих задачах.</p>
          </div>
        )}
      </div>

      <PatientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialData={patient}
      />
    </div>
  );
}
