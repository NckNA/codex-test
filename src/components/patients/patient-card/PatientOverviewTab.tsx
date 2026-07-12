import { FileText, Wallet, Cloud, Stethoscope, ClipboardList } from 'lucide-react';
import type { Patient } from '../../../types';

interface PatientOverviewTabProps {
  patient: Patient;
  dentalSummary: {
    needsTreatment: number;
    missing: number;
    activePlans: number;
    totalAmount: number;
    chiefComplaintText: string;
    highUrgentFindings: number;
    notIncludedFindings: number;
    monitoringFindings: number;
  };
  lastVisit?: Date;
  nextVisit?: Date;
  onNavigateToSchedule: () => void;
}

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

export function PatientOverviewTab({
  patient,
  dentalSummary,
  lastVisit,
  nextVisit,
  onNavigateToSchedule
}: PatientOverviewTabProps) {
  return (
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
                 {dentalSummary.monitoringFindings}
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
            <ClipboardList className="w-4 h-4 text-slate-400" /> Записи
           </h3>
           <div className="space-y-3">
             <div className="flex justify-between items-center text-sm">
               <span className="text-slate-500">Предыдущая</span>
               <span className="font-medium text-slate-800">{lastVisit ? lastVisit.toLocaleDateString('ru-RU') : '-'}</span>
             </div>
             <div className="flex justify-between items-center text-sm">
               <span className="text-slate-500">Следующая</span>
               <span className="font-medium text-slate-800">{nextVisit ? nextVisit.toLocaleDateString('ru-RU') : '-'}</span>
             </div>
           </div>
           <div className="pt-3 border-t border-slate-100">
              <button
                onClick={onNavigateToSchedule}
                className="w-full py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors"
              >
                Перейти в расписание
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
