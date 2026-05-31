
import type { ToothNumber, ToothRecord } from '../../types';

interface ToothGridProps {
  teeth: ToothRecord[];
  onToothClick: (tooth: ToothRecord) => void;
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

const ToothItem = ({ tooth, onClick }: { tooth: ToothRecord, onClick: () => void }) => {
  return (
    <div
      onClick={onClick}
      className="flex flex-col items-center gap-1 cursor-pointer group"
    >
      <div className="text-xs font-semibold text-slate-600 group-hover:text-blue-600 transition-colors">
        {tooth.toothNumber}
      </div>
      <div className={`w-8 h-10 rounded-t-md rounded-b-xl border-2 flex items-center justify-center transition-all shadow-sm ${getToothColor(tooth.condition)} group-hover:shadow-md group-hover:-translate-y-0.5`}>
        <span className="text-xs font-bold">{getConditionAbbr(tooth.condition)}</span>
      </div>
    </div>
  );
};

export function ToothGrid({ teeth, onToothClick }: ToothGridProps) {
  const getTooth = (num: number) => teeth.find(t => t.toothNumber === num) as ToothRecord;

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto py-4">
      {/* Upper Jaw */}
      <div className="flex justify-center items-center gap-6">
        {/* Right side (patient's right, left on screen: 18-11) */}
        <div className="flex gap-1.5">
          {UPPER_JAW.slice(0, 8).map(num => (
            <ToothItem key={num} tooth={getTooth(num)} onClick={() => onToothClick(getTooth(num))} />
          ))}
        </div>

        {/* Midline */}
        <div className="w-0.5 h-16 bg-slate-300 rounded-full"></div>

        {/* Left side (patient's left, right on screen: 21-28) */}
        <div className="flex gap-1.5">
          {UPPER_JAW.slice(8, 16).map(num => (
            <ToothItem key={num} tooth={getTooth(num)} onClick={() => onToothClick(getTooth(num))} />
          ))}
        </div>
      </div>

      {/* Lower Jaw */}
      <div className="flex justify-center items-center gap-6">
        {/* Right side (patient's right, left on screen: 48-41) */}
        <div className="flex gap-1.5">
          {LOWER_JAW.slice(0, 8).map(num => (
            <ToothItem key={num} tooth={getTooth(num)} onClick={() => onToothClick(getTooth(num))} />
          ))}
        </div>

        {/* Midline */}
        <div className="w-0.5 h-16 bg-slate-300 rounded-full"></div>

        {/* Left side (patient's left, right on screen: 31-38) */}
        <div className="flex gap-1.5">
          {LOWER_JAW.slice(8, 16).map(num => (
            <ToothItem key={num} tooth={getTooth(num)} onClick={() => onToothClick(getTooth(num))} />
          ))}
        </div>
      </div>
    </div>
  );
}
