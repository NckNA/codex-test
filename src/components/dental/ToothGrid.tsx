import type { ToothNumber, ToothRecord, DentalFinding } from '../../types';
import { AnatomicalTooth } from './icons/AnatomicalTeeth';
import { SurfaceRing } from './icons/SurfaceRing';
import type { SurfaceType } from './icons/SurfaceRing';

interface ToothGridProps {
  teeth: ToothRecord[];
  findings?: DentalFinding[];
  onToothClick: (tooth: ToothRecord) => void;
  selectedToothNumber?: number;
}

const UPPER_JAW: ToothNumber[] = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_JAW: ToothNumber[] = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const getToothColors = (condition: string) => {
  switch (condition) {
    case 'healthy': return { fill: '#ffffff', stroke: '#9CA3AF' }; // white, gray-400
    case 'caries': return { fill: '#FFEDD5', stroke: '#F97316' }; // orange-100, orange-500
    case 'filled': return { fill: '#DBEAFE', stroke: '#3B82F6' }; // blue-100, blue-500
    case 'missing': return { fill: '#F1F5F9', stroke: '#CBD5E1', opacity: 0.4 }; // slate-100, slate-300
    case 'crown': return { fill: '#FEF3C7', stroke: '#EAB308' }; // yellow-100, yellow-500
    case 'implant': return { fill: '#F3E8FF', stroke: '#A855F7' }; // purple-100, purple-500
    case 'root': return { fill: '#FEF2F2', stroke: '#EF4444' }; // red-50, red-500
    case 'pulpitis': return { fill: '#FEE2E2', stroke: '#EF4444' }; // red-100, red-500
    case 'periodontitis': return { fill: '#FFE4E6', stroke: '#F43F5E' }; // rose-100, rose-500
    case 'needs_treatment': return { fill: '#FEF3C7', stroke: '#F59E0B' }; // amber-100, amber-500
    default: return { fill: '#ffffff', stroke: '#9CA3AF' };
  }
};

const ToothColumn = ({ tooth, findings = [], isSelected, onClick }: { tooth: ToothRecord, findings: DentalFinding[], isSelected?: boolean, onClick: () => void }) => {
  const isUpper = (tooth?.toothNumber || 0) < 30;
  
  const getIndicator = () => {
    if (!findings || findings.length === 0) return null;
    const active = findings.filter(f => ['discovered', 'recommended', 'included_in_plan', 'observing'].includes(f.status));
    if (active.length === 0) return null;
    const hasHighOrUrgent = active.some(f => f.severity === 'high' || f.severity === 'urgent');
    const isObservingOnly = active.every(f => f.status === 'observing');

    if (hasHighOrUrgent) {
      return <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-sm z-20"></div>;
    }
    if (isObservingOnly) {
      return <div className="absolute top-0 right-0 w-3 h-3 bg-slate-400 rounded-full border-2 border-white shadow-sm opacity-80 z-20"></div>;
    }
    return <div className="absolute top-0 right-0 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm z-20"></div>;
  };

  const colors = getToothColors(tooth?.condition || 'healthy');
  const isMissing = tooth?.condition === 'missing';
  
  // Extract surfaces from tooth data
  const surfaces = (tooth.surfaces as unknown as SurfaceType[]) || [];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Редактировать зуб ${tooth?.toothNumber}`}
      className={`flex flex-col items-center group relative focus:outline-none transition-all ${
        isSelected ? 'bg-blue-50/50 rounded-lg shadow-sm scale-105 z-10 ring-1 ring-blue-300' : 'hover:bg-slate-50 hover:scale-105 rounded-lg'
      } p-1`}
    >
      {isUpper && (
        <>
          {/* Upper Anatomical Tooth */}
          <div className="relative w-7 h-16 sm:w-9 sm:h-20 flex justify-center drop-shadow-sm group-hover:drop-shadow-md">
            {getIndicator()}
            {/* Gum line background band for upper teeth (behind roots) */}
            <div className="absolute top-2 w-[120%] h-4 bg-pink-100/60 -z-10"></div>
            <div className={`w-full h-full transition-all ${isMissing ? 'opacity-40 grayscale' : ''}`}>
               <AnatomicalTooth 
                 toothNumber={tooth.toothNumber} 
                 fillColor={colors.fill} 
                 strokeColor={isSelected ? '#3B82F6' : colors.stroke} 
               />
            </div>
          </div>
          {/* Upper Surface Ring */}
          <div className="w-5 h-5 sm:w-6 sm:h-6 mt-1 mb-1 opacity-90">
             <SurfaceRing surfaces={surfaces} strokeColor={colors.stroke} />
          </div>
          {/* Upper Tooth Number */}
          <div className={`text-xs sm:text-sm font-bold ${isSelected ? 'text-blue-700' : 'text-slate-600'}`}>
            {tooth?.toothNumber}
          </div>
        </>
      )}

      {!isUpper && (
        <>
          {/* Lower Tooth Number */}
          <div className={`text-xs sm:text-sm font-bold ${isSelected ? 'text-blue-700' : 'text-slate-600'}`}>
            {tooth?.toothNumber}
          </div>
          {/* Lower Surface Ring */}
          <div className="w-5 h-5 sm:w-6 sm:h-6 mt-1 mb-1 opacity-90">
             <SurfaceRing surfaces={surfaces} strokeColor={colors.stroke} />
          </div>
          {/* Lower Anatomical Tooth (Flipped) */}
          <div className="relative w-7 h-16 sm:w-9 sm:h-20 flex justify-center drop-shadow-sm group-hover:drop-shadow-md rotate-180">
            {getIndicator()}
            {/* Gum line background band for lower teeth (behind roots, now at bottom because flipped) */}
            <div className="absolute top-2 w-[120%] h-4 bg-pink-100/60 -z-10"></div>
            <div className={`w-full h-full transition-all ${isMissing ? 'opacity-40 grayscale' : ''}`}>
               <AnatomicalTooth 
                 toothNumber={tooth.toothNumber} 
                 fillColor={colors.fill} 
                 strokeColor={isSelected ? '#3B82F6' : colors.stroke} 
               />
            </div>
          </div>
        </>
      )}
    </button>
  );
};

export function ToothGrid({ teeth, findings = [], onToothClick, selectedToothNumber }: ToothGridProps) {
  const getTooth = (num: number) => teeth.find(t => t.toothNumber === num) as ToothRecord;
  const getFindingsForTooth = (num: number) => findings.filter(f => f.toothNumber === num);

  return (
    <div className="w-max min-w-max mx-auto flex flex-col gap-10 sm:gap-14 py-6 px-4 bg-white rounded-xl">
      {/* Upper Jaw Row */}
      <div className="flex justify-center items-center gap-4 sm:gap-6 relative">
        <div className="flex gap-1 sm:gap-1.5">
          {UPPER_JAW.slice(0, 8).map(num => (
            <ToothColumn key={num} tooth={getTooth(num)} findings={getFindingsForTooth(num)} isSelected={selectedToothNumber === num} onClick={() => onToothClick(getTooth(num))} />
          ))}
        </div>
        <div className="w-[2px] h-32 bg-slate-200 rounded-full shrink-0"></div>
        <div className="flex gap-1 sm:gap-1.5">
          {UPPER_JAW.slice(8, 16).map(num => (
            <ToothColumn key={num} tooth={getTooth(num)} findings={getFindingsForTooth(num)} isSelected={selectedToothNumber === num} onClick={() => onToothClick(getTooth(num))} />
          ))}
        </div>
      </div>

      {/* Lower Jaw Row */}
      <div className="flex justify-center items-center gap-4 sm:gap-6 relative">
        <div className="flex gap-1 sm:gap-1.5">
          {LOWER_JAW.slice(0, 8).map(num => (
            <ToothColumn key={num} tooth={getTooth(num)} findings={getFindingsForTooth(num)} isSelected={selectedToothNumber === num} onClick={() => onToothClick(getTooth(num))} />
          ))}
        </div>
        <div className="w-[2px] h-32 bg-slate-200 rounded-full shrink-0"></div>
        <div className="flex gap-1 sm:gap-1.5">
          {LOWER_JAW.slice(8, 16).map(num => (
            <ToothColumn key={num} tooth={getTooth(num)} findings={getFindingsForTooth(num)} isSelected={selectedToothNumber === num} onClick={() => onToothClick(getTooth(num))} />
          ))}
        </div>
      </div>
    </div>
  );
}
