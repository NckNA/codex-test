import { useState, useMemo } from 'react';
import { Search, Plus, Filter } from 'lucide-react';
import { storage } from '../utils/storage';
import type { Patient, PatientSource, PatientLeadStatus } from '../types';
import { PatientModal } from '../components/patients/PatientModal';
import { useNavigate } from 'react-router-dom';

const getSourceLabel = (source?: string) => {
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

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'active': return 'Активный';
    case 'archived': return 'Архив';
    default: return status;
  }
};


const getIntegrationSourceColor = (source?: PatientSource) => {
  switch (source) {
    case 'manual': return 'bg-slate-100 text-slate-700';
    case 'instagram': return 'bg-pink-100 text-pink-700';
    case 'whatsapp': return 'bg-green-100 text-green-700';
    case 'website': return 'bg-blue-100 text-blue-700';
    case 'phone': return 'bg-amber-100 text-amber-700';
    case 'amocrm': return 'bg-purple-100 text-purple-700';
    case 'referral': return 'bg-emerald-100 text-emerald-700';
    case 'other':
    default: return 'bg-slate-100 text-slate-700';
  }
};

const getIntegrationSourceLabel = (source?: PatientSource) => {
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

const getLeadStatusColor = (status?: PatientLeadStatus) => {
  switch (status) {
    case 'new_lead': return 'bg-slate-100 text-slate-700';
    case 'contacted': return 'bg-blue-100 text-blue-700';
    case 'scheduled': return 'bg-indigo-100 text-indigo-700';
    case 'arrived': return 'bg-emerald-100 text-emerald-700';
    case 'treatment_plan_created': return 'bg-amber-100 text-amber-700';
    case 'treatment_plan_approved': return 'bg-green-100 text-green-700';
    case 'declined': return 'bg-red-100 text-red-700';
    case 'lost': return 'bg-slate-100 text-slate-700';
    default: return 'bg-slate-100 text-slate-700';
  }
};

const getLeadStatusLabel = (status?: PatientLeadStatus) => {
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

export function PatientsPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>(storage.getPatients());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Partial<Patient> | undefined>();

  // Precompute appointments for fast visit lookups
  const appointments = useMemo(() => storage.getAppointments(), []);

  const patientVisits = useMemo(() => {
    const visits: Record<string, { lastVisit?: Date, nextVisit?: Date }> = {};
    const now = new Date();

    // Sort appointments chronologically
    const sortedAppts = [...appointments].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    for (const appt of sortedAppts) {
      if (!appt.patientId || appt.status === 'blocked' || appt.status === 'cancelled') continue;

      const apptDate = new Date(appt.start);
      if (!visits[appt.patientId]) {
        visits[appt.patientId] = {};
      }

      if (apptDate < now) {
        // Since it's sorted ascending, the last one we see that is < now will be the most recent past visit
        visits[appt.patientId].lastVisit = apptDate;
      } else {
        // The first one we see that is >= now will be the next upcoming visit
        if (!visits[appt.patientId].nextVisit) {
          visits[appt.patientId].nextVisit = apptDate;
        }
      }
    }
    return visits;
  }, [appointments]);

  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      const matchesSearch =
        p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.phone.includes(searchQuery);

      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesSource = sourceFilter === 'all' || p.source === sourceFilter;

      return matchesSearch && matchesStatus && matchesSource;
    });
  }, [patients, searchQuery, statusFilter, sourceFilter]);

  const handleOpenModal = (patient?: Patient) => {
    setEditingPatient(patient);
    setIsModalOpen(true);
  };

  const handleSavePatient = (saved: Patient) => {
    if (editingPatient?.id) {
      storage.updatePatient(saved);
    } else {
      storage.addPatient(saved);
    }
    setPatients(storage.getPatients());
    setIsModalOpen(false);
  };

  const formatDate = (date?: Date) => {
    if (!date) return '-';
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Пациенты</h1>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Добавить пациента
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center bg-slate-50/50">
          <div className="relative flex-1 min-w-[250px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск по имени или телефону..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="p-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Все статусы</option>
              <option value="active">Активный</option>
              <option value="archived">Архив</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="p-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Все источники</option>
              <option value="phone">Телефон</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="walk_in">С улицы</option>
              <option value="repeat">Повторный</option>
              <option value="referral">По рекомендации</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="py-3 px-4 font-semibold text-sm text-slate-600 border-b border-slate-200">ФИО</th>
                <th className="py-3 px-4 font-semibold text-sm text-slate-600 border-b border-slate-200">Телефон</th>
                <th className="py-3 px-4 font-semibold text-sm text-slate-600 border-b border-slate-200">Дата рождения</th>
                <th className="py-3 px-4 font-semibold text-sm text-slate-600 border-b border-slate-200">Источник</th>
                <th className="py-3 px-4 font-semibold text-sm text-slate-600 border-b border-slate-200">Статус</th>
                <th className="py-3 px-4 font-semibold text-sm text-slate-600 border-b border-slate-200">Последний визит</th>
                <th className="py-3 px-4 font-semibold text-sm text-slate-600 border-b border-slate-200">Следующий визит</th>
                <th className="py-3 px-4 font-semibold text-sm text-slate-600 border-b border-slate-200">Баланс</th>
                <th className="py-3 px-4 font-semibold text-sm text-slate-600 border-b border-slate-200">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    Пациенты не найдены.
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient) => {
                  const visits = patientVisits[patient.id] || {};

                  return (
                    <tr key={patient.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-slate-800">{patient.fullName}</div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getIntegrationSourceColor(patient.integration?.source || 'manual')}`}>
                            {getIntegrationSourceLabel(patient.integration?.source || 'manual')}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getLeadStatusColor(patient.integration?.leadStatus || 'new_lead')}`}>
                            {getLeadStatusLabel(patient.integration?.leadStatus || 'new_lead')}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">{patient.phone}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{patient.birthDate ? new Date(patient.birthDate).toLocaleDateString('ru-RU') : '-'}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{getSourceLabel(patient.source)}</td>
                      <td className="py-3 px-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          patient.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {getStatusLabel(patient.status)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">{formatDate(visits.lastVisit)}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{formatDate(visits.nextVisit)}</td>
                      <td className="py-3 px-4 text-sm font-medium text-slate-700">{patient.balance ? `${patient.balance} ₸` : '-'}</td>
                      <td className="py-3 px-4 text-sm">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => navigate(`/patients/${patient.id}`)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Открыть
                          </button>
                          <button
                            onClick={() => handleOpenModal(patient)}
                            className="text-slate-500 hover:text-slate-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Редактировать
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PatientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSavePatient}
        initialData={editingPatient}
      />
    </div>
  );
}
