import { FileText, Plus, Search } from 'lucide-react';
import { defaultDiagnoses, defaultWorks } from '../config/clinicalDictionaries';

export function ClinicalDictionariesPage() {
  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Клинические справочники</h1>
        <p className="text-slate-600 mt-1">
          Настройка диагнозов, состояний и работ, доступных врачу в окне редактирования зуба (Врачебная часть).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Diagnoses */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-red-500" />
              Диагнозы
            </h2>
            <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 border-b border-slate-100 relative">
            <Search className="w-4 h-4 absolute left-7 top-7 text-slate-400" />
            <input 
              type="text" 
              placeholder="Поиск диагноза..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {defaultDiagnoses.map(d => (
              <div key={d.id} className="p-3 bg-white border border-slate-100 rounded-lg hover:border-slate-300 transition-colors">
                <div className="font-medium text-sm text-slate-800">{d.name}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-xs text-slate-500">
                  <span className="px-2 py-0.5 bg-slate-100 rounded-md">ID: {d.id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Works */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-500" />
              Работы и услуги
            </h2>
            <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 border-b border-slate-100 relative">
            <Search className="w-4 h-4 absolute left-7 top-7 text-slate-400" />
            <input 
              type="text" 
              placeholder="Поиск работы..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {defaultWorks.map(w => (
              <div key={w.id} className="p-3 bg-white border border-slate-100 rounded-lg hover:border-slate-300 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="font-medium text-sm text-slate-800">{w.name}</div>
                  {w.price && <div className="font-semibold text-sm text-slate-700">{w.price.toLocaleString()} ₸</div>}
                </div>
                <div className="mt-1 flex flex-wrap gap-1 text-xs text-slate-500">
                  <span className="px-2 py-0.5 bg-slate-100 rounded-md">ID: {w.id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
