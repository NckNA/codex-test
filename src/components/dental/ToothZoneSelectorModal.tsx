
import { X, Layers, Activity, Droplet, Box } from 'lucide-react';

export type ToothZone = 'crown' | 'root' | 'gum' | 'bone';

interface ToothZoneSelectorModalProps {
  isOpen: boolean;
  toothNumber: number | null;
  onClose: () => void;
  onSelectZone: (zone: ToothZone) => void;
}

export function ToothZoneSelectorModal({ isOpen, toothNumber, onClose, onSelectZone }: ToothZoneSelectorModalProps) {
  if (!isOpen || !toothNumber) return null;

  const zones = [
    {
      id: 'crown' as ToothZone,
      title: 'Коронка зуба',
      description: 'Кариес, реставрации, сколы, эмаль',
      icon: <Layers className="w-6 h-6 text-blue-500" />,
      bg: 'bg-blue-50',
      border: 'border-blue-100',
      hover: 'hover:border-blue-500 hover:shadow-md'
    },
    {
      id: 'root' as ToothZone,
      title: 'Корни и Каналы',
      description: 'Пульпит, периодонтит, штифты, пломбировка',
      icon: <Activity className="w-6 h-6 text-purple-500" />,
      bg: 'bg-purple-50',
      border: 'border-purple-100',
      hover: 'hover:border-purple-500 hover:shadow-md'
    },
    {
      id: 'gum' as ToothZone,
      title: 'Десна (Пародонт)',
      description: 'Гингивит, карманы, рецессия, воспаление',
      icon: <Droplet className="w-6 h-6 text-rose-500" />,
      bg: 'bg-rose-50',
      border: 'border-rose-100',
      hover: 'hover:border-rose-500 hover:shadow-md'
    },
    {
      id: 'bone' as ToothZone,
      title: 'Костная ткань',
      description: 'Убыль кости, кисты, гранулемы',
      icon: <Box className="w-6 h-6 text-amber-500" />,
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      hover: 'hover:border-amber-500 hover:shadow-md'
    }
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col transform transition-all">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Область лечения</h2>
            <p className="text-sm text-slate-500 mt-1">Выберите зону для зуба <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded-md">{toothNumber}</span></p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 gap-3">
          {zones.map(zone => (
            <button
              key={zone.id}
              onClick={() => onSelectZone(zone.id)}
              className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left bg-white ${zone.border} ${zone.hover} group`}
            >
              <div className={`p-3 rounded-xl ${zone.bg} transition-transform group-hover:scale-110`}>
                {zone.icon}
              </div>
              <div className="flex-1 pt-1">
                <h3 className="font-bold text-slate-800 text-base">{zone.title}</h3>
                <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{zone.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
