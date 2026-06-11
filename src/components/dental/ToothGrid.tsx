import type { ToothNumber, ToothRecord, DentalFinding, ToothCondition } from '../../types';
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

const TOOTH_CONDITION_LABELS: Record<ToothCondition, string> = {
  healthy: 'Здоров',
  caries: 'Кариес',
  filled: 'Пломба',
  missing: 'Отсутствует',
  crown: 'Коронка',
  implant: 'Имплант',
  root: 'Корень',
  pulpitis: 'Пульпит',
  periodontitis: 'Периодонтит',
  needs_treatment: 'Требует лечения',
};

const LEGEND_CONDITIONS: ToothCondition[] = [
  'healthy',
  'caries',
  'filled',
  'crown',
  'implant',
  'missing',
  'needs_treatment',
];

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

const getConditionLabel = (condition: string) => (
  TOOTH_CONDITION_LABELS[condition as ToothCondition] ?? 'Неизвестно'
);

const getActiveFindings = (findings: DentalFinding[]) => (
  findings.filter(f => ['discovered', 'recommended', 'included_in_plan', 'observing'].includes(f.status))
);

const ToothTooltip = ({ tooth, activeFindings, isUpper }: { tooth: ToothRecord, activeFindings: DentalFinding[], isUpper: boolean }) => {
  const diagnosesCount = tooth.diagnoses?.length ?? 0;
  const plannedWorksCount = tooth.plannedWorkRecords?.length ?? tooth.plannedWorks?.length ?? 0;
  const tooltipPosition = isUpper ? 'top-full mt-3' : 'bottom-full mb-3';

  return (
    <div
      className={`pointer-events-none absolute left-1/2 ${tooltipPosition} z-30 w-56 -translate-x-1/2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-left text-xs text-slate-700 opacity-0 shadow-xl shadow-slate-900/10 backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100`}
      role="tooltip"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-900">Зуб {tooth.toothNumber}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {getConditionLabel(tooth.visualState ?? tooth.condition)}
        </span>
      </div>
      <div className="space-y-1 text-[11px] leading-4">
        <div>Диагнозы: <span className="font-medium text-slate-900">{diagnosesCount}</span></div>
        <div>Работы: <span className="font-medium text-slate-900">{plannedWorksCount}</span></div>
        <div>Находки: <span className="font-medium text-slate-900">{activeFindings.length}</span></div>
      </div>
    </div>
  );
};

const ToothColumn = ({ tooth, findings = [], isSelected, onClick }: { tooth: ToothRecord, findings: DentalFinding[], isSelected?: boolean, onClick: () => void }) => {
  const isUpper = (tooth?.toothNumber || 0) < 30;
  const activeFindings = getActiveFindings(findings);

  const getIndicator = () => {
    if (activeFindings.length === 0) return null;

    const hasHighOrUrgent = activeFindings.some(f => f.severity === 'high' || f.severity === 'urgent');
    const isObservingOnly = activeFindings.every(f => f.status === 'observing');

    if (hasHighOrUrgent) {
      return <div className="absolute right-0 top-0 z-20 h-3 w-3 rounded-full border-2 border-white bg-red-500 shadow-sm" title="Есть срочная/важная находка"></div>;
    }
    if (isObservingOnly) {
      return <div className="absolute right-0 top-0 z-20 h-3 w-3 rounded-full border-2 border-white bg-slate-400 opacity-80 shadow-sm" title="На наблюдении"></div>;
    }
    return <div className="absolute right-0 top-0 z-20 h-3 w-3 rounded-full border-2 border-white bg-blue-500 shadow-sm" title="Есть активная находка"></div>;
  };

  const visualCondition = tooth.visualState ?? tooth.condition ?? 'healthy';
  const colors = getToothColors(visualCondition);
  const isMissing = visualCondition === 'missing';

  // Extract surfaces from tooth data
  const surfaces = (tooth.surfaces as unknown as SurfaceType[]) || [];
  const selectedClasses = isSelected
    ? 'z-10 scale-105 rounded-xl bg-blue-50 shadow-md ring-2 ring-blue-400 ring-offset-2 ring-offset-white'
    : 'rounded-xl hover:bg-slate-50 hover:shadow-sm hover:scale-105 focus-visible:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-300';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Редактировать зуб ${tooth?.toothNumber}: ${getConditionLabel(visualCondition)}`}
      className={`group relative flex flex-col items-center p-1.5 transition-all focus:outline-none ${selectedClasses}`}
    >
      <ToothTooltip tooth={tooth} activeFindings={activeFindings} isUpper={isUpper} />

      {isUpper && (
        <>
          {/* Upper Anatomical Tooth */}
          <div className="relative flex h-16 w-7 justify-center drop-shadow-sm transition-all group-hover:drop-shadow-md sm:h-20 sm:w-9">
            {getIndicator()}
            {/* Gum line background band for upper teeth (behind roots) */}
            <div className="absolute top-2 -z-10 h-4 w-[120%] rounded-full bg-pink-100/70"></div>
            <div className={`h-full w-full transition-all ${isMissing ? 'grayscale opacity-40' : ''}`}>
              <AnatomicalTooth
                toothNumber={tooth.toothNumber}
                fillColor={colors.fill}
                strokeColor={isSelected ? '#2563EB' : colors.stroke}
              />
            </div>
          </div>
          {/* Upper Surface Ring */}
          <div className="mb-1 mt-1 h-5 w-5 opacity-90 sm:h-6 sm:w-6">
            <SurfaceRing surfaces={surfaces} strokeColor={colors.stroke} filledColor={colors.stroke} />
          </div>
          {/* Upper Tooth Number */}
          <div className={`text-xs font-bold sm:text-sm ${isSelected ? 'text-blue-700' : 'text-slate-600'}`}>
            {tooth?.toothNumber}
          </div>
        </>
      )}

      {!isUpper && (
        <>
          {/* Lower Tooth Number */}
          <div className={`text-xs font-bold sm:text-sm ${isSelected ? 'text-blue-700' : 'text-slate-600'}`}>
            {tooth?.toothNumber}
          </div>
          {/* Lower Surface Ring */}
          <div className="mb-1 mt-1 h-5 w-5 opacity-90 sm:h-6 sm:w-6">
            <SurfaceRing surfaces={surfaces} strokeColor={colors.stroke} filledColor={colors.stroke} />
          </div>
          {/* Lower Anatomical Tooth (Flipped) */}
          <div className="relative flex h-16 w-7 rotate-180 justify-center drop-shadow-sm transition-all group-hover:drop-shadow-md sm:h-20 sm:w-9">
            {getIndicator()}
            {/* Gum line background band for lower teeth (behind roots, now at bottom because flipped) */}
            <div className="absolute top-2 -z-10 h-4 w-[120%] rounded-full bg-pink-100/70"></div>
            <div className={`h-full w-full transition-all ${isMissing ? 'grayscale opacity-40' : ''}`}>
              <AnatomicalTooth
                toothNumber={tooth.toothNumber}
                fillColor={colors.fill}
                strokeColor={isSelected ? '#2563EB' : colors.stroke}
              />
            </div>
          </div>
        </>
      )}
    </button>
  );
};

const JawLabel = ({ title, subtitle }: { title: string, subtitle: string }) => (
  <div className="mb-3 flex items-center justify-center gap-3 text-center">
    <div className="h-px w-20 bg-gradient-to-r from-transparent to-slate-200" />
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{title}</div>
      <div className="text-[11px] text-slate-400">{subtitle}</div>
    </div>
    <div className="h-px w-20 bg-gradient-to-l from-transparent to-slate-200" />
  </div>
);

const ToothLegend = () => (
  <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Легенда зубной карты</div>
    <div className="flex flex-wrap gap-2">
      {LEGEND_CONDITIONS.map(condition => {
        const colors = getToothColors(condition);
        return (
          <div key={condition} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
            <span
              className="h-3 w-3 rounded-full border"
              style={{ backgroundColor: colors.fill, borderColor: colors.stroke }}
              aria-hidden="true"
            />
            {TOOTH_CONDITION_LABELS[condition]}
          </div>
        );
      })}
      <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
        <span className="h-3 w-3 rounded-full border-2 border-white bg-blue-500 shadow-sm" aria-hidden="true" />
        Активная находка
      </div>
      <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
        <span className="h-3 w-3 rounded-full border-2 border-white bg-red-500 shadow-sm" aria-hidden="true" />
        Срочно
      </div>
    </div>
  </div>
);

export function ToothGrid({ teeth, findings = [], onToothClick, selectedToothNumber }: ToothGridProps) {
  const getTooth = (num: number) => teeth.find(t => t.toothNumber === num) as ToothRecord;
  const getFindingsForTooth = (num: number) => findings.filter(f => f.toothNumber === num);

  return (
    <div className="mx-auto w-max min-w-max rounded-3xl border border-slate-100 bg-white px-5 py-5 shadow-sm shadow-slate-900/5">
      <div className="rounded-2xl bg-gradient-to-b from-white via-white to-slate-50 px-4 py-5">
        <JawLabel title="Верхняя челюсть" subtitle="FDI 18–28" />
        {/* Upper Jaw Row */}
        <div className="relative flex items-center justify-center gap-4 sm:gap-6">
          <div className="flex gap-1 sm:gap-1.5">
            {UPPER_JAW.slice(0, 8).map(num => (
              <ToothColumn key={num} tooth={getTooth(num)} findings={getFindingsForTooth(num)} isSelected={selectedToothNumber === num} onClick={() => onToothClick(getTooth(num))} />
            ))}
          </div>
          <div className="h-32 w-[2px] shrink-0 rounded-full bg-slate-200"></div>
          <div className="flex gap-1 sm:gap-1.5">
            {UPPER_JAW.slice(8, 16).map(num => (
              <ToothColumn key={num} tooth={getTooth(num)} findings={getFindingsForTooth(num)} isSelected={selectedToothNumber === num} onClick={() => onToothClick(getTooth(num))} />
            ))}
          </div>
        </div>

        <div className="my-6 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        <JawLabel title="Нижняя челюсть" subtitle="FDI 48–38" />
        {/* Lower Jaw Row */}
        <div className="relative flex items-center justify-center gap-4 sm:gap-6">
          <div className="flex gap-1 sm:gap-1.5">
            {LOWER_JAW.slice(0, 8).map(num => (
              <ToothColumn key={num} tooth={getTooth(num)} findings={getFindingsForTooth(num)} isSelected={selectedToothNumber === num} onClick={() => onToothClick(getTooth(num))} />
            ))}
          </div>
          <div className="h-32 w-[2px] shrink-0 rounded-full bg-slate-200"></div>
          <div className="flex gap-1 sm:gap-1.5">
            {LOWER_JAW.slice(8, 16).map(num => (
              <ToothColumn key={num} tooth={getTooth(num)} findings={getFindingsForTooth(num)} isSelected={selectedToothNumber === num} onClick={() => onToothClick(getTooth(num))} />
            ))}
          </div>
        </div>

        <ToothLegend />
      </div>
    </div>
  );
}
