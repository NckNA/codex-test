import { useState, useEffect } from 'react';
import { ToothGrid } from './ToothGrid';
import { ToothEditorModal } from './ToothEditorModal';
import { storage } from '../../utils/storage';
import type { DentalChart, ToothRecord } from '../../types';
import { Save } from 'lucide-react';

interface DentalChartTabProps {
  patientId: string;
}

export function DentalChartTab({ patientId }: DentalChartTabProps) {
  const [chart, setChart] = useState<DentalChart | null>(null);
  const [selectedTooth, setSelectedTooth] = useState<ToothRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [complaints, setComplaints] = useState('');
  const [diagnosis, setDiagnosis] = useState('');

    useEffect(() => {
    const loadedChart = storage.getDentalChart(patientId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChart(loadedChart);

    setComplaints(loadedChart.complaints || '');

    setDiagnosis(loadedChart.diagnosis || '');
  }, [patientId]);

  if (!chart) return null;

  const handleToothClick = (tooth: ToothRecord) => {
    setSelectedTooth(tooth);
    setIsModalOpen(true);
  };

  const handleSaveTooth = (updatedTooth: ToothRecord) => {
    const newTeeth = chart.teeth.map(t => t.toothNumber === updatedTooth.toothNumber ? updatedTooth : t);
    const newChart = { ...chart, teeth: newTeeth, updatedAt: new Date().toISOString() };

    setChart(newChart);
    storage.saveDentalChart(patientId, newChart);
    setIsModalOpen(false);
  };

  const handleSaveTextData = () => {
    const newChart = { ...chart, complaints, diagnosis, updatedAt: new Date().toISOString() };

    setChart(newChart);
    storage.saveDentalChart(patientId, newChart);
    // Could add a toast here
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-200 bg-slate-50/50">
        <h3 className="font-semibold text-slate-800">Зубная карта (FDI)</h3>
      </div>

      <div className="p-6 bg-slate-50 overflow-x-auto">
        <ToothGrid teeth={chart.teeth} onToothClick={handleToothClick} />
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
          <label className="block text-sm font-medium text-slate-700 mb-1">Диагноз</label>
          <textarea
            value={diagnosis}

            onChange={e => setDiagnosis(e.target.value)}
            rows={4}
            placeholder="Установленный диагноз..."
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

      <ToothEditorModal
        isOpen={isModalOpen}
        tooth={selectedTooth}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTooth}
      />
    </div>
  );
}
