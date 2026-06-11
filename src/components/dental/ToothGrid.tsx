import type { ToothNumber, ToothRecord, DentalFinding, ToothCondition, ClinicalZone } from '../../types';
import { AnatomicalTooth } from './icons/AnatomicalTeeth';
import { SurfaceRing } from './icons/SurfaceRing';
import type { SurfaceType } from './icons/SurfaceRing';

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

type ZoneMarkerState = 'planned' | 'active' | 'risk';
type StatusMarkerKey = 'urgent' | 'active' | 'observing' | 'inPlan' | 'diagnosis' | 'work';

interface ZoneMarker {
  zone: ClinicalZone;
  state: ZoneMarkerState;
}

interface StatusMarker {
  key: StatusMarkerKey;
  label: string;
  title: string;
  className: string;
}

const ZONE_LABELS: Record<ClinicalZone, string> = {
  crown: 'Коронка',
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
};

const ZONE_PRIORITY: Record<ZoneMarkerState, number> = {
  planned: 1,
  active: 2,
  risk: 3,
};

const ZONE_OVERLAY_CLASSES: Record<ClinicalZone, string> = {
  crown: 'left-1/2 top-[24%] h-4 w-5 -translate-x-1/2 rounded-full border',
  endodontics: 'left-1/2 top-[30%] h-8 w-1 -translate-x-1/2 rounded-full border',
  root: 'bottom-[7%] left-1/2 h-7 w-5 -translate-x-1/2 rounded-b-full border',
  periodontium: 'left-1/2 top-[15%] h-2 w-[125%] -translate-x-1/2 rounded-full border',
  bone: 'bottom-0 left-1/2 h-2 w-7 -translate-x-1/2 rounded-full border',
  orthopedics: 'left-1/2 top-[20%] h-7 w-7 -translate-x-1/2 rounded-full border-2 border-dashed bg-transparent',
  planning: 'bottom-1 right-0 h-2.5 w-2.5 rounded-full border',
};

const ZONE_STATE_CLASSES: Record<ZoneMarkerState, string> = {
  planned: 'border-emerald-500 bg-emerald-300/45 shadow-emerald-300/40',
  active: 'border-sky-500 bg-sky-300/45 shadow-sky-300/40',
  risk: 'border-red-500 bg-red-300/55 shadow-red-300/50',
};

const STATUS_MARKER_CONFIG: Record<StatusMarkerKey, StatusMarker> = {
  urgent: {
    key: 'urgent',
    label: 'Срочно',
    title: 'Есть срочная/важная находка',
    className: 'border-red-600 bg-red-500 shadow-red-300/50',
  },
  active: {
    key: 'active',
    label: 'Активная находка',
    title: 'Есть активная находка',
    className: 'border-blue-600 bg-blue-500 shadow-blue-300/50',
  },
  observing: {
    key: 'observing',
    label: 'Наблюдение',
    title: 'На наблюдении',
    className: 'border-slate-500 bg-slate-400 shadow-slate-300/50',
  },
  inPlan: {
    key: 'inPlan',
    label: 'В плане',
    title: 'Есть позиция в плане лечения',
    className: 'border-emerald-600 bg-emerald-500 shadow-emerald-300/50',
  },
  diagnosis: {
    key: 'diagnosis',
    label: 'Есть диагноз',
    title: 'Есть выбранный диагноз',
    className: 'border-amber-600 bg-amber-400 shadow-amber-300/50',
  },
  work: {
    key: 'work',
    label: 'Есть работа',
    title: 'Есть выбранная/планируемая работа',
    className: 'border-violet-600 bg-violet-500 shadow-violet-300/50',
  },
};

const STATUS_MARKER_ORDER: StatusMarkerKey[] = ['urgent', 'active', 'inPlan', 'observing', 'diagnosis', 'work'];

const getToothColors = (condition: string) => {
  switch (condition) {
    case 'healthy': return { fill: '#ffffff', stroke: '#9CA3AF' };
    case 'caries': return { fill: '#FFEDD5', stroke: '#F97316' };
    case 'filled': return { fill: '#DBEAFE', stroke: '#3B82F6' };
    case 'missing': return { fill: '#F1F5F9', stroke: '#CBD5E1', opacity: 0.4 };
    case 'crown': return { fill: '#FEF3C7', stroke: '#EAB308' };
    case 'implant': return { fill: '#F3E8FF', stroke: '#A855F7' };
    case 'root': return { fill: '#FEF2F2', stroke: '#EF4444' };
    case 'pulpitis': return { fill: '#FEE2E2', stroke: '#EF4444' };
    case 'periodontitis': return { fill: '#FFE4E6', stroke: '#F43F5E' };
    case 'needs_treatment': return { fill: '#FEF3C7', stroke: '#F59E0B' };
    default: return { fill: '#ffffff', stroke: '#9CA3AF' };
  }
};

const getConditionLabel = (condition: string) => (
  TOOTH_CONDITION_LABELS[condition as ToothCondition] ?? 'Неизвестно'
);

const getActiveFindings = (findings: DentalFinding[]) => (
  findings.filter(f => ['discovered', 'recommended', 'included_in_plan', 'observing'].includes(f.status))
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
  if (finding.status === 'included_in_plan') return 'planned';
  return 'active';
};

const getWorkRecordZoneState = (status: string): ZoneMarkerState | null => {
  if (status === 'planned' || status === 'approved') return 'planned';
  if (status === 'in_progress') return 'active';
  return null;
};

const getActiveWorkCount = (tooth: ToothRecord) => {
  if (tooth.plannedWorkRecords?.length) {
    return tooth.plannedWorkRecords.filter(record => !['completed', 'cancelled'].includes(record.status)).length;
  }
  return tooth.plannedWorks?.length ?? 0;
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

const getZoneMarkers = (tooth: ToothRecord, activeFindings: DentalFinding[]): ZoneMarker[] => {
  const markers = new Map<ClinicalZone, ZoneMarkerState>();

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

const getStatusMarkers = (tooth: ToothRecord, activeFindings: DentalFinding[]): StatusMarker[] => {
  const markerKeys = new Set<StatusMarkerKey>();
  const hasUrgentFinding = activeFindings.some(finding => finding.severity === 'high' || finding.severity === 'urgent');
  const hasActiveFinding = activeFindings.some(finding => ['discovered', 'recommended'].includes(finding.status) && finding.severity !== 'high' && finding.severity !== 'urgent');
  const hasPlannedFinding = activeFindings.some(finding => finding.status === 'included_in_plan' || finding.includeInTreatmentPlan);
  const hasObservingFinding = activeFindings.some(finding => finding.status === 'observing');
  const hasDiagnoses = (tooth.diagnoses?.length ?? 0) > 0;
  const hasWorks = getActiveWorkCount(tooth) > 0;

  if (hasUrgentFinding) markerKeys.add('urgent');
  if (hasActiveFinding) markerKeys.add('active');
  if (hasPlannedFinding) markerKeys.add('inPlan');
  if (hasObservingFinding) markerKeys.add('observing');
  if (hasDiagnoses) markerKeys.add('diagnosis');
  if (hasWorks) markerKeys.add('work');

  return STATUS_MARKER_ORDER.filter(key => markerKeys.has(key)).map(key => STATUS_MARKER_CONFIG[key]);
};

const getZoneSummary = (markers: ZoneMarker[]) => (
  markers.map(marker => `${ZONE_LABELS[marker.zone]} (${ZONE_STATE_LABELS[marker.state]})`).join(', ')
);

const getStatusSummary = (markers: StatusMarker[]) => (
  markers.map(marker => marker.label).join(', ')
);

const ToothTooltip = ({ tooth, activeFindings, zoneMarkers, statusMarkers, isUpper }: { tooth: ToothRecord, activeFindings: DentalFinding[], zoneMarkers: ZoneMarker[], statusMarkers: StatusMarker[], isUpper: boolean }) => {
  const diagnosesCount = tooth.diagnoses?.length ?? 0;
  const plannedWorksCount = getActiveWorkCount(tooth);
  const tooltipPosition = isUpper ? 'top-full mt-3' : 'bottom-full mb-3';

  return (
    <div
      className={`pointer-events-none absolute left-1/2 ${tooltipPosition} z-30 w-60 -translate-x-1/2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-left text-xs text-slate-700 opacity-0 shadow-xl shadow-slate-900/10 backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100`}
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
        {statusMarkers.length > 0 && (
          <div>Статусы: <span className="font-medium text-slate-900">{getStatusSummary(statusMarkers)}</span></div>
        )}
        {zoneMarkers.length > 0 && (
          <div>Зоны: <span className="font-medium text-slate-900">{getZoneSummary(zoneMarkers)}</span></div>
        )}
      </div>
    </div>
  );
};

const ZoneMarkerOverlay = ({ markers, toothNumber }: { markers: ZoneMarker[], toothNumber: number }) => (
  <>
    {markers.map(marker => (
      <span
        key={marker.zone}
        data-testid={`zone-marker-${toothNumber}-${marker.zone}-${marker.state}`}
        className={`pointer-events-none absolute z-10 shadow-sm ${ZONE_OVERLAY_CLASSES[marker.zone]} ${ZONE_STATE_CLASSES[marker.state]}`}
        title={`${ZONE_LABELS[marker.zone]}: ${ZONE_STATE_LABELS[marker.state]}`}
        aria-hidden="true"
      />
    ))}
  </>
);

const StatusMarkerStack = ({ markers, toothNumber }: { markers: StatusMarker[], toothNumber: number }) => {
  if (markers.length === 0) return null;

  return (
    <div className="pointer-events-none absolute -right-1 top-0 z-20 flex flex-col gap-0.5" aria-hidden="true">
      {markers.slice(0, 5).map(marker => (
        <span
          key={marker.key}
          data-testid={`status-marker-${toothNumber}-${marker.key}`}
          className={`h-2.5 w-2.5 rounded-full border-2 border-white shadow-sm ${marker.className}`}
          title={marker.title}
        />
      ))}
    </div>
  );
};

const ToothColumn = ({ tooth, findings = [], isSelected, isUpper, onClick }: { tooth: ToothRecord, findings: DentalFinding[], isSelected?: boolean, isUpper: boolean, onClick: () => void }) => {
  const activeFindings = getActiveFindings(findings);
  const zoneMarkers = getZoneMarkers(tooth, activeFindings);
  const statusMarkers = getStatusMarkers(tooth, activeFindings);
  const visualCondition = tooth.visualState ?? tooth.condition ?? 'healthy';
  const colors = getToothColors(visualCondition);
  const isMissing = visualCondition === 'missing';
  const surfaces = (tooth.surfaces as unknown as SurfaceType[]) || [];
  const selectedClasses = isSelected
    ? 'z-10 scale-105 rounded-xl bg-blue-50 shadow-md ring-2 ring-blue-400 ring-offset-2 ring-offset-white'
    : 'rounded-xl hover:bg-slate-50 hover:shadow-sm hover:scale-105 focus-visible:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-300';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Редактировать зуб ${tooth.toothNumber}: ${getConditionLabel(visualCondition)}`}
      className={`group relative flex flex-col items-center p-1.5 transition-all focus:outline-none ${selectedClasses}`}
    >
      <ToothTooltip tooth={tooth} activeFindings={activeFindings} zoneMarkers={zoneMarkers} statusMarkers={statusMarkers} isUpper={isUpper} />

      {isUpper && (
        <>
          <div className="relative flex h-16 w-7 justify-center drop-shadow-sm transition-all group-hover:drop-shadow-md sm:h-20 sm:w-9">
            <StatusMarkerStack markers={statusMarkers} toothNumber={tooth.toothNumber} />
            <ZoneMarkerOverlay markers={zoneMarkers} toothNumber={tooth.toothNumber} />
            <div className="absolute top-2 -z-10 h-4 w-[120%] rounded-full bg-pink-100/70"></div>
            <div className={`h-full w-full transition-all ${isMissing ? 'grayscale opacity-40' : ''}`}>
              <AnatomicalTooth
                toothNumber={tooth.toothNumber}
                fillColor={colors.fill}
                strokeColor={isSelected ? '#2563EB' : colors.stroke}
              />
            </div>
          </div>
          <div className="mb-1 mt-1 h-5 w-5 opacity-90 sm:h-6 sm:w-6">
            <SurfaceRing surfaces={surfaces} strokeColor={colors.stroke} filledColor={colors.stroke} />
          </div>
          <div className={`text-xs font-bold sm:text-sm ${isSelected ? 'text-blue-700' : 'text-slate-600'}`}>
            {tooth.toothNumber}
          </div>
        </>
      )}

      {!isUpper && (
        <>
          <div className={`text-xs font-bold sm:text-sm ${isSelected ? 'text-blue-700' : 'text-slate-600'}`}>
            {tooth.toothNumber}
          </div>
          <div className="mb-1 mt-1 h-5 w-5 opacity-90 sm:h-6 sm:w-6">
            <SurfaceRing surfaces={surfaces} strokeColor={colors.stroke} filledColor={colors.stroke} />
          </div>
          <div className="relative flex h-16 w-7 rotate-180 justify-center drop-shadow-sm transition-all group-hover:drop-shadow-md sm:h-20 sm:w-9">
            <StatusMarkerStack markers={statusMarkers} toothNumber={tooth.toothNumber} />
            <ZoneMarkerOverlay markers={zoneMarkers} toothNumber={tooth.toothNumber} />
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

const DentitionModeSwitch = ({ mode, onChange }: { mode: DentitionMode, onChange?: (mode: DentitionMode) => void }) => (
  <div className="flex rounded-full border border-slate-200 bg-white p-1 shadow-sm" aria-label="Режим зубной формулы">
    {(['adult', 'child'] as const).map(option => {
      const isActive = mode === option;
      return (
        <button
          key={option}
          type="button"
          aria-pressed={isActive}
          onClick={() => onChange?.(option)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          {option === 'adult' ? 'Постоянные' : 'Молочные'}
        </button>
      );
    })}
  </div>
);

const StatusLegendItem = ({ marker }: { marker: StatusMarker }) => (
  <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
    <span className={`h-3 w-3 rounded-full border-2 border-white shadow-sm ${marker.className}`} aria-hidden="true" />
    {marker.label}
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
      <StatusLegendItem marker={STATUS_MARKER_CONFIG.active} />
      <StatusLegendItem marker={STATUS_MARKER_CONFIG.urgent} />
      <StatusLegendItem marker={STATUS_MARKER_CONFIG.inPlan} />
      <StatusLegendItem marker={STATUS_MARKER_CONFIG.observing} />
      <StatusLegendItem marker={STATUS_MARKER_CONFIG.diagnosis} />
      <StatusLegendItem marker={STATUS_MARKER_CONFIG.work} />
      <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
        <span className="h-3 w-3 rounded-full border border-sky-500 bg-sky-300/60 shadow-sm" aria-hidden="true" />
        Зона активна
      </div>
      <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
        <span className="h-3 w-3 rounded-full border border-emerald-500 bg-emerald-300/60 shadow-sm" aria-hidden="true" />
        Зона в плане
      </div>
      <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
        <span className="h-3 w-3 rounded-full border border-red-500 bg-red-300/70 shadow-sm" aria-hidden="true" />
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
      />
    );
  };

  return (
    <div className="mx-auto w-max min-w-max rounded-3xl border border-slate-100 bg-white px-5 py-5 shadow-sm shadow-slate-900/5">
      <div className="rounded-2xl bg-gradient-to-b from-white via-white to-slate-50 px-4 py-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/80 px-4 py-3 shadow-sm">
          <div>
            <div className="text-sm font-semibold text-slate-800">{config.label}</div>
            <div className="text-xs text-slate-500">{config.helper}</div>
          </div>
          <DentitionModeSwitch mode={dentitionMode} onChange={onDentitionModeChange} />
        </div>

        <JawLabel title="Верхняя челюсть" subtitle={config.upperSubtitle} />
        <div className="relative flex items-center justify-center gap-4 sm:gap-6">
          <div className="flex gap-1 sm:gap-1.5">
            {config.upper.slice(0, Math.ceil(config.upper.length / 2)).map(num => renderTooth(num, true))}
          </div>
          <div className="h-32 w-[2px] shrink-0 rounded-full bg-slate-200"></div>
          <div className="flex gap-1 sm:gap-1.5">
            {config.upper.slice(Math.ceil(config.upper.length / 2)).map(num => renderTooth(num, true))}
          </div>
        </div>

        <div className="my-6 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        <JawLabel title="Нижняя челюсть" subtitle={config.lowerSubtitle} />
        <div className="relative flex items-center justify-center gap-4 sm:gap-6">
          <div className="flex gap-1 sm:gap-1.5">
            {config.lower.slice(0, Math.ceil(config.lower.length / 2)).map(num => renderTooth(num, false))}
          </div>
          <div className="h-32 w-[2px] shrink-0 rounded-full bg-slate-200"></div>
          <div className="flex gap-1 sm:gap-1.5">
            {config.lower.slice(Math.ceil(config.lower.length / 2)).map(num => renderTooth(num, false))}
          </div>
        </div>

        <ToothLegend />
      </div>
    </div>
  );
}
