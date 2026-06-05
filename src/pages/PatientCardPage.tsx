import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, FileText, Wallet, ClipboardList, Stethoscope, Cloud } from 'lucide-react';
import { storage } from '../utils/storage';
import type { Patient } from '../types';
import { PatientModal } from '../components/patients/PatientModal';
import { DentalChartTab } from '../components/dental/DentalChartTab';
import { TreatmentPlansTab } from '../components/treatment/TreatmentPlansTab';
import { FindingsRisksTab } from '../components/dental/FindingsRisksTab';

const TABS = [
  { id: 'overview', label: 'Обзор' },
  { id: 'history', label: 'История приёмов' },
  { id: 'dental_chart', label: 'Зубная карта' },
  { id: 'findings', label: 'Проблемы и риски' },
  { id: 'plan', label: 'План лечения' },
  { id: 'finance', label: 'Финансы' },
  { id: 'docs', label: 'Документы' },
  { id: 'communications', label: 'Коммуникации' },
  { id: 'files', label: 'Файлы' },
];

const getSourceLabel = (source: string) => {
  switch (source) {
    case 'phone': return 'Телефон';
    case 'whatsapp': return 'WhatsApp';
    case 'instagram': return 'Instagram';
    case 'walk_in': return 'С улицы';
    case 'repeat': return 'Повторный';
    case 'referral': return 'По рекомендации';
    default: return source || '';
  }
};


const getIntegrationSourceLabel = (source?: string) => {
  switch (source) {
    case 'manual': return 'Вручную';
    case 'instagram': return 'Instagram';
    case 'whatsapp': return 'WhatsApp';
    case 'website': return 'Сайт';
    case 'phone': return 'Телефон';
    case 'amocrm': return 'amoCRM';
    case 'referral': return 'По рекомендации';
    case 'other': return 'Другое';
    default: return 'Вручную'; // default fallback
  }
};

const getLeadStatusLabel = (status?: string) => {
  switch (status) {
    case 'new_lead': return 'Новый лид';
    case 'contacted': return 'Взят в работу';
    case 'scheduled': return 'Записан';
    case 'arrived': return 'Пришел';
    case 'treatment_plan_created': return 'План составлен';
    case 'treatment_plan_approved': return 'План согласован';
    case 'declined': return 'Отказ';
    case 'lost': return 'Закрыт (отказ)';
    default: return 'Новый лид';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'new': return 'Новая';
    case 'confirmed': return 'Подтвержден';
    case 'arrived': return 'Пришел';
    case 'in_progress': return 'В работе';
    case 'completed': return 'Завершен';
    case 'no_show': return 'Не пришел';
    case 'cancelled': return 'Отменен';
    default: return status;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'new': return 'bg-blue-100 text-blue-700';
    case 'confirmed': return 'bg-indigo-100 text-indigo-700';
    case 'arrived': return 'bg-emerald-100 text-emerald-700';
    case 'in_progress': return 'bg-amber-100 text-amber-700';
    case 'completed': return 'bg-slate-100 text-slate-700';
    case 'no_show': return 'bg-rose-100 text-rose-700';
    case 'cancelled': return 'bg-red-100 text-red-700';
    default: return 'bg-slate-100 text-slate-700';
  }
};

export function PatientCardPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Use memo to replace effects and local state so it naturally updates if parent structure triggered render
  // Realistically we can also just rely on normal component re-renders
  const patient = useMemo(() => {
    if (!patientId) return null;
    return storage.getPatients().find(p => p.id === patientId) || null;
  }, [patientId]);

  const dentalSummary = useMemo(() => {
     if (!patientId) return { needsTreatment: 0, missing: 0, activePlans: 0, totalAmount: 0, chiefComplaintText: '', highUrgentFindings: 0, notIncludedFindings: 0, observingFindings: 0 };
     const chart = storage.getDentalChart(patientId);
     const plans = storage.getTreatmentPlans(patientId);
     const complaint = storage.getChiefComplaint(patientId);
     const findings = storage.getFindings(patientId);

     const needsTreatment = chart.teeth.filter(t => ['needs_treatment', 'caries', 'pulpitis', 'periodontitis'].includes(t.condition)).length;
     const missing = chart.teeth.filter(t => t.condition === 'missing').length;
     const activePlans = plans.filter(p => ['draft', 'in_progress', 'approved'].includes(p.status)).length;
     const totalAmount = plans.reduce((sum, p) => sum + p.totalPrice, 0);

     const chiefComplaintText = complaint?.text || '';
     const highUrgentFindings = findings.filter(f => (f.severity === 'high' || f.severity === 'urgent') && f.status !== 'completed' && f.status !== 'declined_by_patient').length;
     const notIncludedFindings = findings.filter(f => f.status === 'discovered' || f.status === 'recommended').length;
     const observingFindings = findings.filter(f => f.status === 'observing').length;

     return { needsTreatment, missing, activePlans, totalAmount, chiefComplaintText, highUrgentFindings, notIncludedFindings, observingFindings };
  }, [patientId]);

  const appointments = useMemo(() => {
    if (!patientId) return [];
    return storage.getAppointments()
      .filter(a => a.patientId === patientId)
      .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  }, [patientId]);

  const doctors = useMemo(() => storage.getDoctors(), []);

  const { lastVisit, nextVisit } = useMemo(() => {
    let lastVisit: Date | undefined;
    let nextVisit: Date | undefined;
    const now = new Date();

    const sortedAsc = [...appointments].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    for (const appt of sortedAsc) {
      if (appt.status === 'blocked' || appt.status === 'cancelled') continue;
      const apptDate = new Date(appt.start);
      if (apptDate < now) {
        lastVisit = apptDate;
      } else {
        if (!nextVisit) nextVisit = apptDate;
      }
    }
    return { lastVisit, nextVisit };
  }, [appointments]);

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

  const handleSave = (updated: Patient) => {
    storage.updatePatient(updated);
    setIsModalOpen(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
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

        {/* Tabs */}
        <div className="flex gap-6 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
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

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl">
            {/* Info Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 md:col-span-2">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" /> Основная информация
              </h3>
              <div className="grid grid-cols-2 gap-y-4 text-sm">
                <div>
                  <div className="text-slate-500 mb-1">ФИО</div>
                  <div className="font-medium text-slate-800">{patient.fullName}</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-1">Телефон</div>
                  <div className="font-medium text-slate-800">{patient.phone}</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-1">Дата рождения</div>
                  <div className="font-medium text-slate-800">{patient.birthDate ? new Date(patient.birthDate).toLocaleDateString('ru-RU') : '-'}</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-1">Источник</div>
                  <div className="font-medium text-slate-800">{getSourceLabel(patient.source)}</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-1">Аллергии</div>
                  <div className={`font-medium ${patient.allergies ? 'text-red-600' : 'text-slate-800'}`}>
                    {patient.allergies || 'Нет'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 mb-1">Дата создания</div>
                  <div className="font-medium text-slate-800">{new Date(patient.createdAt).toLocaleDateString('ru-RU')}</div>
                </div>
              </div>

              {patient.notes && (
                <div className="pt-4 border-t border-slate-100">
                  <div className="text-slate-500 mb-1 text-sm">Заметки</div>
                  <p className="text-sm text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    {patient.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Side Cards */}
            <div className="space-y-6">
              {/* Balances */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                 <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-slate-400" /> Финансы
                 </h3>
                 <div className="space-y-3">
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-500">Основной баланс</span>
                     <span className={`font-semibold ${patient.balance && patient.balance < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                       {patient.balance || 0} ₸
                     </span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-500">Бонусный баланс</span>
                     <span className="font-semibold text-emerald-600">
                       {patient.bonusBalance || 0}
                     </span>
                   </div>
                 </div>
              </div>


              {/* Source / CRM Overview */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                 <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-slate-400" /> Источник / CRM
                 </h3>
                 <div className="space-y-3">
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-500">Источник</span>
                     <span className="font-medium text-slate-800">
                       {getIntegrationSourceLabel(patient.integration?.source || 'manual')}
                     </span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-500">Статус лида</span>
                     <span className="font-medium text-slate-800">
                       {getLeadStatusLabel(patient.integration?.leadStatus || 'new_lead')}
                     </span>
                   </div>
                   {(patient.integration?.sourceComment) && (
                     <div className="flex flex-col text-sm border-t border-slate-100 pt-2">
                       <span className="text-slate-500 mb-1">Комментарий к источнику</span>
                       <span className="text-slate-800 italic">{patient.integration.sourceComment}</span>
                     </div>
                   )}

                   <div className="pt-2 border-t border-slate-100 mt-2">
                     {patient.integration?.externalCrm ? (
                       <div className="space-y-2 text-sm">
                         <div className="text-xs font-semibold text-slate-500 uppercase">Синхронизация CRM</div>
                         <div className="flex justify-between">
                           <span className="text-slate-500">Провайдер</span>
                           <span className="text-slate-800 capitalize">{patient.integration.externalCrm.provider}</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-slate-500">Статус синхр.</span>
                           <span className="text-slate-800">{patient.integration.externalCrm.syncStatus}</span>
                         </div>
                         {patient.integration.externalCrm.externalContactId && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">ID контакта</span>
                              <span className="text-slate-800">{patient.integration.externalCrm.externalContactId}</span>
                            </div>
                         )}
                         {patient.integration.externalCrm.externalLeadId && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">ID сделки</span>
                              <span className="text-slate-800">{patient.integration.externalCrm.externalLeadId}</span>
                            </div>
                         )}
                         {patient.integration.externalCrm.lastSyncAt && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Последняя синхр.</span>
                              <span className="text-slate-800">{new Date(patient.integration.externalCrm.lastSyncAt).toLocaleString('ru-RU')}</span>
                            </div>
                         )}
                         {patient.integration.externalCrm.lastSyncError && (
                            <div className="text-red-500 text-xs mt-1">
                              Ошибка: {patient.integration.externalCrm.lastSyncError}
                            </div>
                         )}
                       </div>
                     ) : (
                       <div className="text-sm text-slate-500 text-center py-2 bg-slate-50 rounded">
                         Внешняя CRM не подключена.
                       </div>
                     )}
                   </div>
                 </div>
              </div>


              {/* Dental Summary */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                 <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-slate-400" /> Стоматология
                 </h3>

                 {dentalSummary.chiefComplaintText && (
                   <div className="mb-3 p-3 bg-slate-50 rounded border border-slate-100 text-sm">
                     <div className="text-slate-500 mb-1 text-xs">Основная жалоба:</div>
                     <div className="text-slate-800 line-clamp-2">{dentalSummary.chiefComplaintText}</div>
                   </div>
                 )}

                 <div className="space-y-3">
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-500">Требуют лечения</span>
                     <span className="font-semibold text-amber-600">
                       {dentalSummary.needsTreatment}
                     </span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-500">Удалены</span>
                     <span className="font-semibold text-slate-600">
                       {dentalSummary.missing}
                     </span>
                   </div>
                   <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-100">
                     <span className="text-slate-500">Срочные/высокие риски</span>
                     <span className="font-semibold text-red-600">
                       {dentalSummary.highUrgentFindings}
                     </span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-500">Не в плане (выявлено)</span>
                     <span className="font-semibold text-amber-600">
                       {dentalSummary.notIncludedFindings}
                     </span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-500">Наблюдение</span>
                     <span className="font-semibold text-blue-600">
                       {dentalSummary.observingFindings}
                     </span>
                   </div>
                   <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-100">
                     <span className="text-slate-500">Активных планов</span>
                     <span className="font-semibold text-slate-800">
                       {dentalSummary.activePlans}
                     </span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-500">Сумма по планам</span>
                     <span className="font-semibold text-slate-800">
                       {dentalSummary.totalAmount.toLocaleString()} ₸
                     </span>
                   </div>
                 </div>
              </div>

              {/* Visits Info */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                 <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-slate-400" /> Визиты
                 </h3>
                 <div className="space-y-3">
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-500">Последний</span>
                     <span className="font-medium text-slate-800">{lastVisit ? lastVisit.toLocaleDateString('ru-RU') : '-'}</span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-500">Следующий</span>
                     <span className="font-medium text-slate-800">{nextVisit ? nextVisit.toLocaleDateString('ru-RU') : '-'}</span>
                   </div>
                 </div>
                 <div className="pt-3 border-t border-slate-100">
                    <button
                      onClick={() => navigate('/')}
                      className="w-full py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors"
                    >
                      Перейти в расписание
                    </button>
                 </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-slate-400" /> История приёмов
              </h3>
              <span className="text-xs font-medium bg-slate-200 text-slate-600 px-2 py-1 rounded-full">
                Всего: {appointments.length}
              </span>
            </div>

            {appointments.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>У пациента еще не было приёмов.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 font-semibold text-slate-600">Дата и Время</th>
                    <th className="py-3 px-4 font-semibold text-slate-600">Врач</th>
                    <th className="py-3 px-4 font-semibold text-slate-600">Услуга</th>
                    <th className="py-3 px-4 font-semibold text-slate-600">Кабинет</th>
                    <th className="py-3 px-4 font-semibold text-slate-600">Статус</th>
                    <th className="py-3 px-4 font-semibold text-slate-600">Цена</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {appointments.map(appt => {
                    const doctor = doctors.find(d => d.id === appt.doctorId);
                    const apptDate = new Date(appt.start);
                    return (
                      <tr key={appt.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800">{apptDate.toLocaleDateString('ru-RU')}</div>
                          <div className="text-xs text-slate-500">{apptDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-700">{doctor ? doctor.fullName : '-'}</td>
                        <td className="py-3 px-4">
                          <div className="text-slate-800 font-medium">{appt.service || 'Без названия'}</div>
                          {appt.comment && <div className="text-xs text-slate-500 truncate max-w-[200px] mt-0.5">{appt.comment}</div>}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{appt.cabinet}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(appt.status)}`}>
                            {getStatusLabel(appt.status)}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">{appt.price ? `${appt.price} ₸` : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'dental_chart' && <DentalChartTab patientId={patient.id} />}
        {activeTab === 'findings' && <FindingsRisksTab patientId={patient.id} />}
        {activeTab === 'plan' && <TreatmentPlansTab patientId={patient.id} />}

        {/* Placeholders for other tabs */}
        {['finance', 'docs', 'communications', 'files'].includes(activeTab) && (
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
