
import { Link } from 'react-router-dom';
import { Database } from 'lucide-react';

export function SettingsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Настройки</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link 
          to="/settings/clinical-dictionaries"
          className="block p-6 bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Database className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Клинические справочники</h3>
          <p className="text-sm text-slate-500">
            Управление диагнозами и работами (Врачебная часть)
          </p>
        </Link>
      </div>
    </div>
  );
}
