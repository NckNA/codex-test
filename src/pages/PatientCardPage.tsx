import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Edit, AlertCircle, FileText, Wallet, ClipboardList, Stethoscope } from 'lucide-react';
import { storage } from '../utils/storage';
import { PatientModal } from '../components/patients/PatientModal';
import type { AppointmentStatus } from '../types';

const TABS = [
  { id: 'overview', label: 'Обзор' },
  { id: 'history', label: 'История приёмов' },
  { id: 'plan', label: 'План лечения' },
  { id: 'finance', label: 'Финансы' },
  { id: 'docs', label: 'Документы' },
  { id: 'communications', label: 'Коммуникации' },
  { id: 'files', label: 'Файлы' },
];

const getStatusLabel = (status: AppointmentStatus) => {
  switch (status) {
    case 'new': return 'Новая';
    case 'confirmed': return 'Подтвержден';
    case 'arrived': return 'Пришел';
    case 'in_progress': return 'В работе';
    case 'completed': return 'Завершен';
    case 'no_show': return 'Не пришел';
    case 'cancelled': return 'Отменен';
    case 'blocked': return 'Блок';
    default: return status;
  }
};

const getStatusColor = (status: AppointmentStatus) => {
  switch (status) {
    case 'new': return 'bg-blue-100 text-blue-800';
    case 'confirmed': return 'bg-indigo-100 text-indigo-800';
    case 'arrived': return 'bg-yellow-100 text-yellow-800';
    case 'in_progress': return 'bg-purple-100 text-purple-800';
    case 'completed': return 'bg-emerald-100 text-emerald-800';
    case 'no_show': return 'bg-orange-100 text-orange-800';
    case 'cancelled': return 'bg-slate-100 text-slate-600';
    default: return 'bg-slate-100 text-slate-800';
  }
};

const getSourceLabel = (source?: string) => {
  switch (source) {
    case 'phone': return 'Телефон';
    case 'whatsapp': return 'WhatsApp';
    case 'instagram': return 'Instagram';
    case 'walk_in': return 'С улицы';
    case 'repeat': return 'Повторный';
    case 'referral': return 'По рекомендации';
    default: return source || '-';
  }
};

export function PatientCardPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Need to force re-render if patient updates via modal
  const [updateTrigger, setUpdateTrigger] = useState(0);

  const patient = useMemo(() => {
    // We include updateTrigger in the dependency array to force re-evaluation
    return updateTrigger !== -1
      ? storage.getPatients().find(p => p.id === patientId)
      : undefined;
  }, [patientId, updateTrigger]);

  const appointments = useMemo(() => {
    return updateTrigger !== -1
      ? storage.getAppointments()
        .filter(a => a.patientId === patientId)
        .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime()) // Newest first
      : [];
  }, [patientId, updateTrigger]);

  const doctors = useMemo(() => storage.getDoctors(), []);

  if (!patient) {
    return (
      <div className="p-8 h-full flex flex-col items-center justify-center text-slate-500">
        <AlertCircle className="w-12 h-12 mb-4 text-slate-300" />
        <h2 className="text-xl font-medium">Пациент не найден</h2>
        <button onClick={() => navigate('/patients')} className="mt-4 text-blue-600 hover:underline">Вернуться к списку</button>
      </div>
    );
  }

  // Calculate visits
  const now = new Date();
  let lastVisit: Date | undefined;
  let nextVisit: Date | undefined;

  for (const appt of appointments) {
    if (appt.status === 'blocked' || appt.status === 'cancelled') continue;
    const date = new Date(appt.start);
    if (date < now) {
      if (!lastVisit || date > lastVisit) lastVisit = date;
    } else {
      if (!nextVisit || date < nextVisit) nextVisit = date;
    }
  }

  const handleSave = (updated: import('../types').Patient) => {
    storage.updatePatient(updated);
    setUpdateTrigger(prev => prev + 1);
    setIsModalOpen(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header Profile */}
      <div className="bg-white border-b border-slate-200 p-6 shrink-0 z-10">
        <button
          onClick={() => navigate('/patients')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-4 transition-colors w-fit"
        >
          <ChevronLeft className="w-4 h-4" />
          Назад к списку
        </button>

        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-2xl font-bold">
              {patient.fullName.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{patient.fullName}</h1>
              <div className="flex items-center gap-4 mt-1 text-sm text-slate-600">
                <span>{patient.phone}</span>
                {patient.birthDate && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span>{new Date(patient.birthDate).toLocaleDateString('ru-RU')}</span>
                  </>
                )}
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${patient.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                  {patient.status === 'active' ? 'Активный' : 'Архив'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Edit className="w-4 h-4" />
            Редактировать
          </button>
        </div>

        {/* Tabs navigation */}
        <div className="flex gap-6 mt-6 border-b border-slate-200">
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

        {/* Placeholders for other tabs */}
        {['plan', 'finance', 'docs', 'communications', 'files'].includes(activeTab) && (
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
