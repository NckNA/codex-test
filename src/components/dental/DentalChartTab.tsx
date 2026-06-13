import { useState, useEffect, useRef } from 'react';
import { ToothGrid, type DentitionMode } from './ToothGrid';
import { ToothEditorModal } from './ToothEditorModal';
import type { ToothRecord, DentalFinding } from '../../types';
import type { ToothStatusFindingInput } from '../../data/orchestrators/ClinicalWorkflowOrchestrator';
import { Save, AlertTriangle, Camera } from 'lucide-react';
import { useDentalChart } from '../../data/hooks/useDentalChart';
import { usePatientFindings } from '../../data/hooks/usePatientFindings';
import { useClinicalWorkflow } from '../../data/hooks/useClinicalWorkflow';

interface DentalChartTabProps {
  patientId: string;
}

const SNAPSHOT_PADDING = 16;

function normalizeFindingPayload(
  findingPayload: Partial<DentalFinding> | null
): ToothStatusFindingInput | null {
  if (!findingPayload?.title || !findingPayload.category || !findingPayload.severity) {
    return null;
  }

  return {
    title: findingPayload.title,
    category: findingPayload.category,
    severity: findingPayload.severity,
    description: findingPayload.description,
    riskDescription: findingPayload.riskDescription,
    recommendation: findingPayload.recommendation,
    isChiefComplaintRelated: findingPayload.isChiefComplaintRelated,
    includeInTreatmentPlan: findingPayload.includeInTreatmentPlan,
    status: findingPayload.status,
    clinicalZone: findingPayload.clinicalZone,
    diagnosisIds: findingPayload.diagnosisIds,
    plannedWorkIds: findingPayload.plannedWorkIds,
    plannedWorkRecordIds: findingPayload.plannedWorkRecordIds,
  };
}

function getSafeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function inlineComputedStyles(source: Element, target: Element) {
  const computedStyle = window.getComputedStyle(source);
  const inlineStyle = Array.from(computedStyle)
    .map(property => `${property}:${computedStyle.getPropertyValue(property)};`)
    .join('');

  target.setAttribute('style', `${target.getAttribute('style') ?? ''};${inlineStyle}`);

  if (target instanceof HTMLElement) {
    target.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  }

  Array.from(source.children).forEach((sourceChild, index) => {
    const targetChild = target.children.item(index);
    if (targetChild) inlineComputedStyles(sourceChild, targetChild);
  });
}

function serializeElementForSnapshot(element: HTMLElement | SVGSVGElement) {
  const clonedElement = element.cloneNode(true) as HTMLElement | SVGSVGElement;
  inlineComputedStyles(element, clonedElement);
  return new XMLSerializer().serializeToString(clonedElement);
}

function loadSnapshotImage(svgMarkup: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось подготовить PNG-снимок зубной карты.'));
    };

    image.src = url;
  });
}

async function downloadElementAsPng(
  element: HTMLElement | SVGSVGElement,
  fileName: string,
  padding = SNAPSHOT_PADDING
) {
  const rect = element.getBoundingClientRect();
  const width = Math.ceil(Math.max(rect.width, 'scrollWidth' in element ? element.scrollWidth : rect.width));
  const height = Math.ceil(Math.max(rect.height, 'scrollHeight' in element ? element.scrollHeight : rect.height));

  if (width <= 0 || height <= 0) {
    throw new Error('Не удалось определить размер области для снимка.');
  }

  const snapshotWidth = width + padding * 2;
  const snapshotHeight = height + padding * 2;
  const serializedElement = serializeElementForSnapshot(element);
  const svgMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${snapshotWidth}" height="${snapshotHeight}" viewBox="0 0 ${snapshotWidth} ${snapshotHeight}">
      <foreignObject x="${padding}" y="${padding}" width="${width}" height="${height}">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;min-height:${height}px;background:#ffffff;">
          ${serializedElement}
        </div>
      </foreignObject>
    </svg>
  `;

  const image = await loadSnapshotImage(svgMarkup);
  const canvas = document.createElement('canvas');
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = snapshotWidth * scale;
  canvas.height = snapshotHeight * scale;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Браузер не смог создать canvas для PNG-снимка.');

  context.scale(scale, scale);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, snapshotWidth, snapshotHeight);
  context.drawImage(image, 0, 0, snapshotWidth, snapshotHeight);

  const downloadLink = document.createElement('a');
  downloadLink.href = canvas.toDataURL('image/png');
  downloadLink.download = fileName;
  downloadLink.click();
}

export function DentalChartTab({ patientId }: DentalChartTabProps) {
  const {
    dentalChart,
    isLoading: isChartLoading,
    saveDentalChart,
    refetch: refetchDentalChart,
  } = useDentalChart(patientId);

  const {
    findings,
    refetch: refetchFindings,
  } = usePatientFindings(patientId);

  const { applyToothStatusChange } = useClinicalWorkflow();

  const chartSnapshotRef = useRef<HTMLDivElement | null>(null);
  const [selectedTooth, setSelectedTooth] = useState<ToothRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dentitionMode, setDentitionMode] = useState<DentitionMode>('adult');
  const [isSnapshotting, setIsSnapshotting] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  const [complaints, setComplaints] = useState('');
  const [diagnosis, setDiagnosis] = useState('');

  // Sync text fields when chart loads
  useEffect(() => {
    if (dentalChart) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setComplaints(dentalChart.complaints || '');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDiagnosis(dentalChart.diagnosis || '');
    }
  }, [dentalChart]);

  if (isChartLoading && !dentalChart) return null;
  if (!dentalChart) return null;

  const handleToothClick = (tooth: ToothRecord) => {
    setSelectedTooth(tooth);
    setIsModalOpen(true);
  };

  const handleDentitionModeChange = (mode: DentitionMode) => {
    setDentitionMode(mode);
    setSelectedTooth(null);
    setIsModalOpen(false);
  };

  const handleDownloadChartSnapshot = async () => {
    if (!chartSnapshotRef.current) return;

    try {
      setSnapshotError(null);
      setIsSnapshotting(true);
      await downloadElementAsPng(
        chartSnapshotRef.current,
        `dental-chart-${patientId}-${dentitionMode}-${getSafeTimestamp()}.png`
      );
    } catch (error) {
      console.error('Failed to export dental chart snapshot', error);
      setSnapshotError(error instanceof Error ? error.message : 'Не удалось скачать снимок зубной карты.');
    } finally {
      setIsSnapshotting(false);
    }
  };

  const handleDownloadSelectedToothSnapshot = async () => {
    if (!selectedTooth || !chartSnapshotRef.current) return;

    const toothSvg = chartSnapshotRef.current.querySelector<SVGSVGElement>(
      `svg[data-tooth-number="${selectedTooth.toothNumber}"]`
    );

    if (!toothSvg) {
      setSnapshotError(`Не удалось найти SVG зуба ${selectedTooth.toothNumber} для снимка.`);
      return;
    }

    try {
      setSnapshotError(null);
      setIsSnapshotting(true);
      await downloadElementAsPng(
        toothSvg,
        `tooth-${selectedTooth.toothNumber}-${patientId}-${getSafeTimestamp()}.png`,
        20
      );
    } catch (error) {
      console.error('Failed to export selected tooth snapshot', error);
      setSnapshotError(error instanceof Error ? error.message : 'Не удалось скачать снимок выбранного зуба.');
    } finally {
      setIsSnapshotting(false);
    }
  };

  const handleSaveTooth = async (
    updatedTooth: ToothRecord,
    findingPayload: Partial<DentalFinding> | null
  ) => {
    if (!dentalChart) return;

    const normalizedFindingPayload = normalizeFindingPayload(findingPayload);

    try {
      await applyToothStatusChange({
        patientId,
        chart: dentalChart,
        updatedTooth,
        findingPayload: normalizedFindingPayload,
      });

      await refetchDentalChart();
      await refetchFindings();

      setIsModalOpen(false);
    } catch (e) {
      console.error('Failed to save tooth update', e);
      // Important: leave modal open on error.
    }
  };

  const summary = {
    active: findings.filter(f => ['discovered', 'recommended', 'included_in_plan', 'observing'].includes(f.status)).length,
    highUrgent: findings.filter(f => ['high', 'urgent'].includes(f.severity) && ['discovered', 'recommended', 'included_in_plan'].includes(f.status)).length,
    inPlan: findings.filter(f => f.status === 'included_in_plan').length,
    observing: findings.filter(f => f.status === 'observing').length,
  };

  const handleSaveTextData = async () => {
    if (!dentalChart) return;
    const newChart = {
      ...dentalChart,
      complaints,
      diagnosis,
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveDentalChart(newChart);
    } catch (e) {
      console.error('Failed to save dental chart text data', e);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="p-3 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-800 flex flex-wrap items-center gap-2">
          Зубная карта (FDI)
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            {dentitionMode === 'adult' ? 'Постоянная' : 'Молочная'}
          </span>
        </h3>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadChartSnapshot}
            disabled={isSnapshotting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Camera className="h-3.5 w-3.5" />
            Снимок карты
          </button>
          <button
            type="button"
            onClick={handleDownloadSelectedToothSnapshot}
            disabled={!selectedTooth || isSnapshotting}
            title={selectedTooth ? `Скачать снимок зуба ${selectedTooth.toothNumber}` : 'Сначала выберите зуб'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Camera className="h-3.5 w-3.5" />
            Снимок зуба
          </button>
        </div>
      </div>

      {snapshotError && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          {snapshotError}
        </div>
      )}

      <div className="flex flex-col lg:flex-row">
        <div className="min-w-0 flex-1 bg-slate-50 p-4 border-b lg:border-b-0 lg:border-r border-slate-200">
          <div ref={chartSnapshotRef} data-testid="dental-chart-snapshot-area">
            <ToothGrid
              teeth={dentalChart.teeth}
              findings={findings}
              onToothClick={handleToothClick}
              selectedToothNumber={selectedTooth?.toothNumber}
              dentitionMode={dentitionMode}
              onDentitionModeChange={handleDentitionModeChange}
            />
          </div>
        </div>

        <div className="w-full lg:w-56 bg-white p-4 shrink-0 flex flex-col">
          <h4 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Проблемы по карте
          </h4>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Активных проблем:</span>
              <span className="font-semibold text-slate-800">{summary.active}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Высокий риск/срочно:</span>
              <span className="font-semibold text-red-600">{summary.highUrgent}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">В плане лечения:</span>
              <span className="font-semibold text-emerald-600">{summary.inPlan}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">В наблюдении:</span>
              <span className="font-semibold text-blue-600">{summary.observing}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white border-t border-slate-200">
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
          <label className="block text-sm font-medium text-slate-700 mb-1">Клиническая картина</label>
          <textarea
            value={diagnosis}
            onChange={e => setDiagnosis(e.target.value)}
            rows={4}
            placeholder="Описание клинической картины..."
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
        patientId={patientId}
        existingFindings={findings}
        tooth={selectedTooth}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTooth}
      />
    </div>
  );
}
