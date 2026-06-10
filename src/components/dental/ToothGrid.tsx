
import type { ToothNumber, ToothRecord, DentalFinding } from '../../types';

interface ToothGridProps {
  teeth: ToothRecord[];
  findings?: DentalFinding[];
  onToothClick: (tooth: ToothRecord) => void;
  selectedToothNumber?: number;
}

const UPPER_JAW: ToothNumber[] = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_JAW: ToothNumber[] = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const getToothColor = (condition: string) => {
  switch (condition) {
    case 'healthy': return 'bg-white border-slate-300';
    case 'caries': return 'bg-orange-100 border-orange-400 text-orange-700';
    case 'filled': return 'bg-blue-100 border-blue-400 text-blue-700';
    case 'missing': return 'bg-slate-100 border-slate-300 text-slate-400 opacity-50';
    case 'crown': return 'bg-yellow-100 border-yellow-400 text-yellow-700';
    case 'implant': return 'bg-purple-100 border-purple-400 text-purple-700';
    case 'root': return 'bg-red-50 border-red-300 text-red-600';
    case 'pulpitis': return 'bg-red-100 border-red-500 text-red-700';
    case 'periodontitis': return 'bg-rose-100 border-rose-500 text-rose-700';
    case 'needs_treatment': return 'bg-amber-100 border-amber-500 text-amber-700';
    default: return 'bg-white border-slate-300';
  }
};

const getConditionAbbr = (condition: string) => {
  switch (condition) {
    case 'healthy': return '';
    case 'caries': return 'C';
    case 'filled': return 'F';
    case 'missing': return 'X';
    case 'crown': return 'Cr';
    case 'implant': return 'I';
    case 'root': return 'R';
    case 'pulpitis': return 'P';
    case 'periodontitis': return 'Pt';
    case 'needs_treatment': return '!';
    default: return '';
  }
};

const ToothItem = ({ tooth, findings = [], isSelected, onClick }: { tooth: ToothRecord, findings: DentalFinding[], isSelected?: boolean, onClick: () => void }) => {

  const getIndicator = () => {
    if (!findings || findings.length === 0) return null;

    const active = findings.filter(f => ['discovered', 'recommended', 'included_in_plan', 'observing'].includes(f.status));
    if (active.length === 0) return null;

    const hasHighOrUrgent = active.some(f => f.severity === 'high' || f.severity === 'urgent');
    const isObservingOnly = active.every(f => f.status === 'observing');

    if (hasHighOrUrgent) {
      return <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-sm z-20"></div>;
    }

    if (isObservingOnly) {
      return <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-slate-400 rounded-full border-2 border-white shadow-sm opacity-80 z-20"></div>;
    }

    return <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm z-20"></div>;
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Редактировать зуб ${tooth?.toothNumber}`}
      className={`flex flex-col items-center gap-1.5 p-1.5 sm:p-2 cursor-pointer group relative focus:outline-none transition-all rounded-xl ${
        isSelected 
          ? 'bg-blue-50 ring-2 ring-blue-500 shadow-md scale-105 z-10' 
          : 'hover:bg-slate-100 hover:scale-105'
      }`}
    >
      <div className={`text-sm font-bold transition-colors ${isSelected ? 'text-blue-700' : 'text-slate-600 group-hover:text-blue-600'}`}>
        {tooth?.toothNumber}
      </div>
      <div className={`w-10 h-14 sm:w-12 sm:h-16 rounded-t-md rounded-b-2xl border-2 flex items-center justify-center transition-all shadow-sm ${getToothColor(tooth?.condition)} ${
        isSelected ? 'border-blue-500 shadow-md' : 'group-hover:shadow-md'
      } relative`}>
        {getIndicator()}
        <span className="text-sm font-bold">{getConditionAbbr(tooth?.condition || 'healthy')}</span>
      </div>
    </button>
  );
};

export function ToothGrid({ teeth, findings = [], onToothClick, selectedToothNumber }: ToothGridProps) {
  const getTooth = (num: number) => teeth.find(t => t.toothNumber === num) as ToothRecord;
  const getFindingsForTooth = (num: number) => findings.filter(f => f.toothNumber === num);

  return (
    <div className="w-max min-w-max mx-auto flex flex-col gap-10 sm:gap-12 py-6 px-4">
      {/* Upper Jaw */}
      <div className="flex justify-center items-center gap-6 sm:gap-8">
        {/* Right side (patient's right, left on screen: 18-11) */}
        <div className="flex gap-2 sm:gap-3">
          {UPPER_JAW.slice(0, 8).map(num => (
            <ToothItem key={num} tooth={getTooth(num)} findings={getFindingsForTooth(num)} isSelected={selectedToothNumber === num} onClick={() => onToothClick(getTooth(num))} />
          ))}
        </div>

        {/* Midline */}
        <div className="w-0.5 h-20 bg-slate-300 rounded-full"></div>

        {/* Left side (patient's left, right on screen: 21-28) */}
        <div className="flex gap-2 sm:gap-3">
          {UPPER_JAW.slice(8, 16).map(num => (
            <ToothItem key={num} tooth={getTooth(num)} findings={getFindingsForTooth(num)} isSelected={selectedToothNumber === num} onClick={() => onToothClick(getTooth(num))} />
          ))}
        </div>
      </div>

      {/* Lower Jaw */}
      <div className="flex justify-center items-center gap-6 sm:gap-8">
        {/* Right side (patient's right, left on screen: 48-41) */}
        <div className="flex gap-2 sm:gap-3">
          {LOWER_JAW.slice(0, 8).map(num => (
            <ToothItem key={num} tooth={getTooth(num)} findings={getFindingsForTooth(num)} isSelected={selectedToothNumber === num} onClick={() => onToothClick(getTooth(num))} />
          ))}
        </div>

        {/* Midline */}
        <div className="w-0.5 h-20 bg-slate-300 rounded-full"></div>

        {/* Left side (patient's left, right on screen: 31-38) */}
        <div className="flex gap-2 sm:gap-3">
          {LOWER_JAW.slice(8, 16).map(num => (
            <ToothItem key={num} tooth={getTooth(num)} findings={getFindingsForTooth(num)} isSelected={selectedToothNumber === num} onClick={() => onToothClick(getTooth(num))} />
          ))}
        </div>
      </div>
    </div>
  );
}
