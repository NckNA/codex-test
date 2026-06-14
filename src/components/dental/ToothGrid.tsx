import type { ToothNumber, ToothRecord, DentalFinding, ToothCondition, ClinicalZone } from '../../types';
import { ACTIVE_FINDING_STATUSES } from '../../domain/findingStatus';
import { AnatomicalTooth } from './icons/AnatomicalTeeth';
import { SurfaceRing } from './icons/SurfaceRing';
import type { SurfaceType } from './icons/SurfaceRing';
import type { ClinicalDiagnosis } from '../../config/clinicalDictionaries';
import { useDictionaries } from '../../data/hooks/useDictionaries';
import React from 'react';

export type DentitionMode = 'adult' | 'child';

interface ToothGridProps {
  teeth: ToothRecord[];
  findings?: DentalFinding[];
  onToothClick: (tooth: ToothRecord) => void;
  selectedToothNumber?: number;
  dentitionMode?: DentitionMode;
  onDentitionModeChange?: (mode: DentitionMode) => void;
}

const ADULT_UPPER_JAW: ToothNumber[] = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const ADULT_LOWER_JAW: ToothNumber[] = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const CHILD_UPPER_JAW: ToothNumber[] = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
const CHILD_LOWER_JAW: ToothNumber[] = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

const DISPLAY_FALLBACK_UPDATED_AT = '1970-01-01T00:00:00.000Z';

const DENTITION_CONFIG: Record<DentitionMode, {
  label: string;
  helper: string;
  upper: ToothNumber[];
  lower: ToothNumber[];
  upperSubtitle: string;
  lowerSubtitle: string;
}> = {
  adult: {
    label: 'Постоянная формула',
    helper: 'FDI 18–28 / 48–38',
    upper: ADULT_UPPER_JAW,
    lower: ADULT_LOWER_JAW,
    upperSubtitle: 'FDI 18–28',
    lowerSubtitle: 'FDI 48–38',
  },
  child: {
    label: 'Молочная формула',
    helper: 'FDI 55–65 / 85–75',
    upper: CHILD_UPPER_JAW,
    lower: CHILD_LOWER_JAW,
    upperSubtitle: 'FDI 55–65',
    lowerSubtitle: 'FDI 85–75',
  },
};

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

const ZONE_LABELS: Record<ClinicalZone, string> = {
  crown: 'Коронковая часть',
  endodontics: 'Каналы',
  root: 'Корень',
  periodontium: 'Десна',
  bone: 'Кость',
  orthopedics: 'Ортопедия',
  planning: 'Планирование',
};

const ZONE_STATE_LABELS: Record<ZoneMarkerState, string> = {
  planned: 'в плане',
  active: 'активно',
  risk: 'риск',
  monitoring: 'наблюдение',
};

const ZONE_PRIORITY: Record<ZoneMarkerState, number> = {
  planned: 1,
  active: 2,
  risk: 3,
  monitoring: 0,
};

const getZoneOverlayClasses = (zone: ClinicalZone, isUpper: boolean) => {
  switch (zone) {
    case 'crown':
      return `left-1/2 h-[36%] w-[72%] -translate-x-1/2 rounded-xl border ${isUpper ? 'bottom-[3%]' : 'top-[3%]'}`;
    case 'endodontics':
      return 'left-1/2 top-[18%] h-[62%] w-1.5 -translate-x-1/2 rounded-full border';
    case 'root':
      return `left-1/2 h-[42%] w-[58%] -translate-x-1/2 rounded-xl border ${isUpper ? 'top-[3%]' : 'bottom-[3%]'}`;
    case 'periodontium':
      return 'left-1/2 top-[43%] h-2 w-[112%] -translate-x-1/2 rounded-full border';
    case 'bone':
      return `left-1/2 h-[34%] w-[118%] -translate-x-1/2 rounded-[45%] border border-dashed ${isUpper ? 'top-[2%]' : 'bottom-[2%]'}`;
    case 'orthopedics':
      return `left-1/2 h-[39%] w-[82%] -translate-x-1/2 rounded-xl border-2 border-dashed bg-transparent ${isUpper ? 'bottom-[1%]' : 'top-[1%]'}`;
    case 'planning':
      return 'left-0 top-0 h-2.5 w-2.5 rounded-full border';
  }
};

const ZONE_STATE_CLASSES: Record<ZoneMarkerState, string> = {
  planned: 'border-emerald-500/80 bg-emerald-400/10 shadow-emerald-300/20',
  active: 'border-sky-500/80 bg-sky-400/10 shadow-sky-300/20',
  risk: 'border-red-500/90 bg-red-400/10 shadow-red-300/30',
  monitoring: 'border-amber-500/80 bg-amber-400/10 shadow-amber-300/20',
};

type ZoneMarkerState = 'planned' | 'active' | 'risk' | 'monitoring';

interface ZoneMarker {
  zone: ClinicalZone;
  state: ZoneMarkerState;
}

type ZoneAccentMap = Partial<Record<ClinicalZone, string>>;

const getDiagnosisAccentColor = (diagnosisId: string) => {
  if (diagnosisId.includes('caries')) return '#F97316';
  if (diagnosisId.includes('pulp') || diagnosisId.includes('necrosis')) return '#EF4444';
  if (diagnosisId.includes('periodont') || diagnosisId.includes('cyst')) return '#E11D48';
  if (diagnosisId.includes('gingiv') || diagnosisId.includes('recession')) return '#F43F5E';
  if (diagnosisId.includes('bone') || diagnosisId.includes('atrophy')) return '#F59E0B';
  return '#0EA5E9';
};

const getToothColors = (condition: string) => {
  switch (condition) {
    case 'healthy': return { fill: '#ffffff', stroke: '#64748B', accent: '#CBD5E1' };
    case 'caries': return { fill: '#ffffff', stroke: '#64748B', accent: '#F97316' };
    case 'filled': return { fill: '#ffffff', stroke: '#64748B', accent: '#0EA5E9' };
    case 'missing': return { fill: '#F8FAFC', stroke: '#CBD5E1', accent: '#CBD5E1', opacity: 0.4 };
    case 'crown': return { fill: '#FEF3C7', stroke: '#B45309', accent: '#EAB308' };
    case 'implant': return { fill: '#F3E8FF', stroke: '#7E22CE', accent: '#A855F7' };
    case 'root': return { fill: '#FFF1F2', stroke: '#E11D48', accent: '#FB7185' };
    case 'pulpitis': return { fill: '#ffffff', stroke: '#64748B', accent: '#EF4444' };
    case 'periodontitis': return { fill: '#ffffff', stroke: '#64748B', accent: '#F43F5E' };
    case 'needs_treatment': return { fill: '#ffffff', stroke: '#64748B', accent: '#F59E0B' };
    default: return { fill: '#ffffff', stroke: '#64748B', accent: '#CBD5E1' };
  }
};

const getConditionLabel = (condition: string) => (
  TOOTH_CONDITION_LABELS[condition as ToothCondition] ?? 'Неизвестно'
);

const getActiveFindings = (findings: DentalFinding[]) => (
  findings.filter(f => ACTIVE_FINDING_STATUSES.includes(f.status))
);

const hasText = (value?: string) => Boolean(value?.trim());

const mergeZoneMarker = (markers: Map<ClinicalZone, ZoneMarkerState>, zone: ClinicalZone, state: ZoneMarkerState) => {
  const current = markers.get(zone);
  if (!current || ZONE_PRIORITY[state] > ZONE_PRIORITY[current]) {
    markers.set(zone, state);
  }
};

const getFindingZoneState = (finding: DentalFinding): ZoneMarkerState => {
  if (finding.severity === 'high' || finding.severity === 'urgent') return 'risk';
  if (finding.status === 'planned') return 'planned';
  if (finding.status === 'monitoring') return 'monitoring';
  return 'active';
};

const getWorkRecordZoneState = (status: string): ZoneMarkerState | null => {
  if (status === 'planned' || status === 'approved') return 'planned';
  if (status === 'in_progress') return 'active';
  return null;
};

const createDisplayTooth = (toothNumber: ToothNumber, dentitionMode: DentitionMode): ToothRecord => ({
  toothNumber,
  condition: 'healthy',
  surfaces: [],
  notes: '',
  updatedAt: DISPLAY_FALLBACK_UPDATED_AT,
  presenceStatus: dentitionMode === 'child' ? 'deciduous' : 'natural',
  visualState: 'healthy',
  diagnoses: [],
  plannedWorks: [],
  plannedWorkRecords: [],
  completedWorks: [],
});

const getZoneMarkers = (tooth: ToothRecord, activeFindings: DentalFinding[], diagnosesMap: Map<string, ClinicalDiagnosis>): ZoneMarker[] => {
  const markers = new Map<ClinicalZone, ZoneMarkerState>();

  tooth.diagnoses?.forEach(diagnosisId => {
    diagnosesMap.get(diagnosisId)?.allowedZones.forEach(zone => {
      mergeZoneMarker(markers, zone, 'active');
    });
  });

  if (hasText(tooth.workCrown)) mergeZoneMarker(markers, 'crown', 'planned');
  if (hasText(tooth.crown)) mergeZoneMarker(markers, 'crown', 'active');
  if (hasText(tooth.workCanal)) mergeZoneMarker(markers, 'endodontics', 'planned');
  if (hasText(tooth.canal)) mergeZoneMarker(markers, 'endodontics', 'active');
  if (hasText(tooth.workRoot)) mergeZoneMarker(markers, 'root', 'planned');
  if (hasText(tooth.root)) mergeZoneMarker(markers, 'root', 'active');
  if (hasText(tooth.workGum)) mergeZoneMarker(markers, 'periodontium', 'planned');
  if (hasText(tooth.gum)) mergeZoneMarker(markers, 'periodontium', 'active');
  if (hasText(tooth.workBone)) mergeZoneMarker(markers, 'bone', 'planned');
  if (hasText(tooth.bone)) mergeZoneMarker(markers, 'bone', 'active');

  tooth.plannedWorkRecords?.forEach(record => {
    const state = getWorkRecordZoneState(record.status);
    if (state) mergeZoneMarker(markers, record.zone, state);
  });

  activeFindings.forEach(finding => {
    if (finding.clinicalZone) {
      mergeZoneMarker(markers, finding.clinicalZone, getFindingZoneState(finding));
    }
  });

  return Array.from(markers, ([zone, state]) => ({ zone, state }));
};

const getZoneAccents = (
  tooth: ToothRecord,
  activeFindings: DentalFinding[],
  zoneMarkers: ZoneMarker[],
  diagnosesMap: Map<string, ClinicalDiagnosis>
): ZoneAccentMap => {
  const accents: ZoneAccentMap = {};

  zoneMarkers.forEach(marker => {
    accents[marker.zone] = marker.state === 'risk'
      ? '#EF4444'
      : marker.state === 'planned'
        ? '#10B981'
        : marker.state === 'monitoring'
          ? '#F59E0B'
          : '#0EA5E9';
  });

  tooth.diagnoses?.forEach(diagnosisId => {
    const diagnosis = diagnosesMap.get(diagnosisId);
    diagnosis?.allowedZones.forEach(zone => {
      accents[zone] = getDiagnosisAccentColor(diagnosisId);
    });
  });

  activeFindings.forEach(finding => {
    if (!finding.clinicalZone) return;
    if (finding.severity === 'high' || finding.severity === 'urgent') {
      accents[finding.clinicalZone] = '#EF4444';
    } else if (finding.status === 'planned') {
      accents[finding.clinicalZone] = '#10B981';
    } else if (finding.status === 'monitoring') {
      accents[finding.clinicalZone] = '#F59E0B';
    } else {
      accents[finding.clinicalZone] = '#0EA5E9';
    }
  });

  return accents;
};

const getZoneSummary = (markers: ZoneMarker[]) => (
  markers.map(marker => `${ZONE_LABELS[marker.zone]} (${ZONE_STATE_LABELS[marker.state]})`).join(', ')
);

const ToothTooltip = ({ tooth, activeFindings, zoneMarkers, isUpper }: { tooth: ToothRecord, activeFindings: DentalFinding[], zoneMarkers: ZoneMarker[], isUpper: boolean }) => {
  const diagnosesCount = tooth.diagnoses?.length ?? 0;
  const plannedWorksCount = tooth.plannedWorkRecords?.length ?? tooth.plannedWorks?.length ?? 0;
  const tooltipPosition = isUpper ? 'bottom-full mb-2' : 'bottom-full mb-3';

  return (
    <div
      className={`pointer-events-none absolute left-1/2 ${tooltipPosition} z-50 w-60 -translate-x-1/2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-left text-xs text-slate-700 opacity-0 shadow-xl shadow-slate-900/10 backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100`}
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
        {zoneMarkers.length > 0 && (
          <div>Зоны: <span className="font-medium text-slate-900">{getZoneSummary(zoneMarkers)}</span></div>
        )}
      </div>
    </div>
  );
};

const ZoneMarkerOverlay = ({ markers, toothNumber, isUpper }: { markers: ZoneMarker[], toothNumber: number, isUpper: boolean }) => (
  <>
    {markers.map(marker => (
      <span
        key={marker.zone}
        data-testid={`zone-marker-${toothNumber}-${marker.zone}-${marker.state}`}
        className={`pointer-events-none absolute z-10 shadow-sm ${getZoneOverlayClasses(marker.zone, isUpper)} ${ZONE_STATE_CLASSES[marker.state]}`}
        title={`${ZONE_LABELS[marker.zone]}: ${ZONE_STATE_LABELS[marker.state]}`}
        aria-hidden="true"
      />
    ))}
  </>
);

const getToothWidthClasses = (toothNumber: number) => {
  const position = toothNumber % 10;
  const isPrimaryMolar = toothNumber >= 50 && position >= 4;

  if (position >= 6 || isPrimaryMolar) return 'w-10 sm:w-11';
  if (position >= 4) return 'w-9 sm:w-10';
  return 'w-8 sm:w-9';
};

const ToothColumn = ({ tooth, findings = [], isSelected, isUpper, onClick, diagnosesMap }: { tooth: ToothRecord, findings: DentalFinding[], isSelected?: boolean, isUpper: boolean, onClick: () => void, diagnosesMap: Map<string, ClinicalDiagnosis> }) => {
  const activeFindings = getActiveFindings(findings);
  const zoneMarkers = getZoneMarkers(tooth, activeFindings, diagnosesMap);
  const zoneAccents = getZoneAccents(tooth, activeFindings, zoneMarkers, diagnosesMap);

  const getIndicator = () => {
    if (activeFindings.length === 0) return null;

    const hasHighOrUrgent = activeFindings.some(f => f.severity === 'high' || f.severity === 'urgent');
    const isMonitoringOnly = activeFindings.every(f => f.status === 'monitoring');

    if (hasHighOrUrgent) {
      return <div className="absolute -right-0.5 -top-0.5 z-20 h-3.5 w-3.5 rounded-full border-2 border-white bg-red-500 shadow-sm shadow-red-300/60" title="Есть срочная/важная находка"></div>;
    }
    if (isMonitoringOnly) {
      return <div className="absolute -right-0.5 -top-0.5 z-20 h-3.5 w-3.5 rounded-full border-2 border-white bg-amber-400 opacity-90 shadow-sm" title="На наблюдении"></div>;
    }
    return <div className="absolute -right-0.5 -top-0.5 z-20 h-3.5 w-3.5 rounded-full border-2 border-white bg-sky-500 shadow-sm shadow-sky-300/60" title="Есть активная находка"></div>;
  };

  const visualCondition = tooth.visualState ?? tooth.condition ?? 'healthy';
  const colors = getToothColors(visualCondition);
  const isMissing = visualCondition === 'missing';
  const surfaces = (tooth.surfaces as unknown as SurfaceType[]) || [];
  const toothWidthClasses = getToothWidthClasses(tooth.toothNumber);
  const selectedClasses = isSelected
    ? 'z-20 scale-[1.03] rounded-xl bg-blue-50 shadow-md ring-2 ring-blue-400 ring-offset-1 ring-offset-white'
    : 'rounded-xl hover:bg-slate-50 hover:shadow-sm hover:scale-[1.03] focus-visible:bg-slate-50 focus-visible:ring-2 focus-visible:ring-sky-300';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Редактировать зуб ${tooth.toothNumber}: ${getConditionLabel(visualCondition)}`}
      className={`group relative z-10 flex flex-col items-center p-1 transition-all hover:z-40 focus-visible:z-40 focus:outline-none ${selectedClasses}`}
    >
      <ToothTooltip tooth={tooth} activeFindings={activeFindings} zoneMarkers={zoneMarkers} isUpper={isUpper} />

      {isUpper && (
        <>
          <div className={`relative flex h-[72px] justify-center drop-shadow-sm transition-all group-hover:drop-shadow-md sm:h-[78px] ${toothWidthClasses}`}>
            {getIndicator()}
            <ZoneMarkerOverlay markers={zoneMarkers} toothNumber={tooth.toothNumber} isUpper />
            <div className="absolute left-1/2 top-[46%] -z-10 h-3 w-[118%] -translate-x-1/2 rounded-full bg-rose-100/80"></div>
            <div className={`h-full w-full transition-all ${isMissing ? 'grayscale opacity-40' : ''}`}>
              <AnatomicalTooth
                toothNumber={tooth.toothNumber}
                fillColor={colors.fill}
                strokeColor={isSelected ? '#2563EB' : colors.stroke}
                isSelected={isSelected}
                condition={visualCondition}
                zoneAccents={zoneAccents}
              />
            </div>
          </div>
          <div className="my-0.5 h-6 w-7 opacity-95">
            <SurfaceRing
              toothNumber={tooth.toothNumber}
              surfaces={surfaces}
              strokeColor={isSelected ? '#2563EB' : colors.stroke}
              filledColor={colors.accent}
            />
          </div>
          <div className={`text-xs font-bold ${isSelected ? 'text-sky-700' : 'text-slate-600'}`}>
            {tooth.toothNumber}
          </div>
        </>
      )}

      {!isUpper && (
        <>
          <div className={`text-xs font-bold ${isSelected ? 'text-sky-700' : 'text-slate-600'}`}>
            {tooth.toothNumber}
          </div>
          <div className="my-0.5 h-6 w-7 opacity-95">
            <SurfaceRing
              toothNumber={tooth.toothNumber}
              surfaces={surfaces}
              strokeColor={isSelected ? '#2563EB' : colors.stroke}
              filledColor={colors.accent}
            />
          </div>
          <div className={`relative flex h-[72px] justify-center drop-shadow-sm transition-all group-hover:drop-shadow-md sm:h-[78px] ${toothWidthClasses}`}>
            {getIndicator()}
            <ZoneMarkerOverlay markers={zoneMarkers} toothNumber={tooth.toothNumber} isUpper={false} />
            <div className="absolute left-1/2 top-[46%] -z-10 h-3 w-[118%] -translate-x-1/2 rounded-full bg-rose-100/80"></div>
            <div className={`h-full w-full rotate-180 transition-all ${isMissing ? 'grayscale opacity-40' : ''}`}>
              <AnatomicalTooth
                toothNumber={tooth.toothNumber}
                fillColor={colors.fill}
                strokeColor={isSelected ? '#2563EB' : colors.stroke}
                isSelected={isSelected}
                condition={visualCondition}
                zoneAccents={zoneAccents}
              />
            </div>
          </div>
        </>
      )}
    </button>
  );
};

const JawLabel = ({ title, subtitle }: { title: string, subtitle: string }) => (
  <div className="mb-1.5 flex items-center justify-center gap-3 text-center">
    <div className="h-px w-16 bg-gradient-to-r from-transparent to-slate-200" />
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{title}</div>
      <div className="text-[10px] text-slate-400">{subtitle}</div>
    </div>
    <div className="h-px w-16 bg-gradient-to-l from-transparent to-slate-200" />
  </div>
);

const DentitionModeSwitch = ({ mode, onChange }: { mode: DentitionMode, onChange?: (mode: DentitionMode) => void }) => (
  <div className="flex rounded-full border border-slate-200 bg-white p-0.5 shadow-sm" aria-label="Режим зубной формулы">
    {(['adult', 'child'] as const).map(option => {
      const isActive = mode === option;
      return (
        <button
          key={option}
          type="button"
          aria-pressed={isActive}
          onClick={() => onChange?.(option)}
          className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          {option === 'adult' ? 'Постоянные' : 'Молочные'}
        </button>
      );
    })}
  </div>
);

const ToothLegend = () => (
  <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Легенда зубной карты</div>
    <div className="flex flex-wrap gap-1">
      {LEGEND_CONDITIONS.map(condition => {
        const colors = getToothColors(condition);
        return (
          <div key={condition} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm">
            <span
              className="h-2.5 w-2.5 rounded-full border"
              style={{ backgroundColor: colors.accent, borderColor: colors.stroke }}
              aria-hidden="true"
            />
            {TOOTH_CONDITION_LABELS[condition]}
          </div>
        );
      })}
      <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm">
        <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-500 shadow-sm" aria-hidden="true" />
        Активная находка
      </div>
      <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm">
        <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500 shadow-sm" aria-hidden="true" />
        Срочно
      </div>
      <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm">
        <span className="h-2.5 w-2.5 rounded-full border border-sky-500 bg-sky-300/60 shadow-sm" aria-hidden="true" />
        Зона активна
      </div>
      <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm">
        <span className="h-2.5 w-2.5 rounded-full border border-emerald-500 bg-emerald-300/60 shadow-sm" aria-hidden="true" />
        Зона в плане
      </div>
      <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm">
        <span className="h-2.5 w-2.5 rounded-full border border-red-500 bg-red-300/70 shadow-sm" aria-hidden="true" />
        Зона риска
      </div>
    </div>
  </div>
);

export function ToothGrid({
  teeth,
  findings = [],
  onToothClick,
  selectedToothNumber,
  dentitionMode = 'adult',
  onDentitionModeChange,
}: ToothGridProps) {
  const { diagnoses } = useDictionaries();
  const diagnosesMap = React.useMemo(() => new Map(diagnoses.map(d => [d.id, d])), [diagnoses]);

  const config = DENTITION_CONFIG[dentitionMode];
  const getTooth = (num: ToothNumber) => teeth.find(t => t.toothNumber === num) ?? createDisplayTooth(num, dentitionMode);
  const getFindingsForTooth = (num: number) => findings.filter(f => f.toothNumber === num);
  const renderTooth = (num: ToothNumber, isUpper: boolean) => {
    const tooth = getTooth(num);
    return (
      <ToothColumn
        key={num}
        tooth={tooth}
        findings={getFindingsForTooth(num)}
        isSelected={selectedToothNumber === num}
        isUpper={isUpper}
        onClick={() => onToothClick(tooth)}
        diagnosesMap={diagnosesMap}
      />
    );
  };

  return (
    <div className="mx-auto w-full max-w-5xl overflow-x-auto rounded-3xl border border-slate-100 bg-white p-2.5 shadow-sm shadow-slate-900/5 lg:overflow-visible">
      <div className="w-full min-w-[700px] rounded-2xl bg-gradient-to-b from-white via-white to-slate-50 p-3 lg:min-w-0">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white/80 px-3 py-1.5 shadow-sm">
          <div>
            <div className="text-sm font-semibold text-slate-800">{config.label}</div>
            <div className="text-xs text-slate-500">{config.helper}</div>
          </div>
          <DentitionModeSwitch mode={dentitionMode} onChange={onDentitionModeChange} />
        </div>

        <JawLabel title="Верхняя челюсть" subtitle={config.upperSubtitle} />
        <div className="relative flex items-center justify-center gap-2">
          <div
            data-testid="upper-bone-layer"
            className="pointer-events-none absolute left-1/2 top-5 z-0 h-9 w-[91%] -translate-x-1/2 rounded-[45%] border-y border-amber-300/80 bg-amber-100/80 shadow-inner shadow-amber-200/50"
            aria-hidden="true"
          />
          <div className="flex gap-0.5">
            {config.upper.slice(0, Math.ceil(config.upper.length / 2)).map(num => renderTooth(num, true))}
          </div>
          <div className="h-24 w-px shrink-0 rounded-full bg-slate-200"></div>
          <div className="flex gap-0.5">
            {config.upper.slice(Math.ceil(config.upper.length / 2)).map(num => renderTooth(num, true))}
          </div>
        </div>

        <div className="my-2.5 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        <JawLabel title="Нижняя челюсть" subtitle={config.lowerSubtitle} />
        <div className="relative flex items-center justify-center gap-2">
          <div
            data-testid="lower-bone-layer"
            className="pointer-events-none absolute bottom-5 left-1/2 z-0 h-9 w-[91%] -translate-x-1/2 rounded-[45%] border-y border-amber-300/80 bg-amber-100/80 shadow-inner shadow-amber-200/50"
            aria-hidden="true"
          />
          <div className="flex gap-0.5">
            {config.lower.slice(0, Math.ceil(config.lower.length / 2)).map(num => renderTooth(num, false))}
          </div>
          <div className="h-24 w-px shrink-0 rounded-full bg-slate-200"></div>
          <div className="flex gap-0.5">
            {config.lower.slice(Math.ceil(config.lower.length / 2)).map(num => renderTooth(num, false))}
          </div>
        </div>

        <ToothLegend />
      </div>
    </div>
  );
}
