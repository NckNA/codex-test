import { useState, useEffect, useRef } from 'react';
import { ToothGrid, type DentitionMode } from './ToothGrid';
import { ToothEditorModal } from './ToothEditorModal';
import type { ToothRecord, DentalFinding } from '../../types';
import type { ToothStatusFindingInput } from '../../data/orchestrators/ClinicalWorkflowOrchestrator';
import { Save, AlertTriangle, Camera, Images, Upload } from 'lucide-react';
import { useDentalChart } from '../../data/hooks/useDentalChart';
import { usePatientFindings } from '../../data/hooks/usePatientFindings';
import { useClinicalWorkflow } from '../../data/hooks/useClinicalWorkflow';
import { useDentalPhotos } from '../../data/hooks/useDentalPhotos';

interface DentalChartTabProps {
  patientId: string;
}

const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;

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

function formatPhotoDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
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
  const {
    photos,
    isLoading: isPhotosLoading,
    isUploading: isPhotoUploading,
    error: photosError,
    uploadPhoto,
  } = useDentalPhotos(patientId);

  const chartPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const toothPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedTooth, setSelectedTooth] = useState<ToothRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dentitionMode, setDentitionMode] = useState<DentitionMode>('adult');
  const [photoFeedback, setPhotoFeedback] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

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

  const handlePhotoSelection = async (
    file: File | undefined,
    scope: 'chart' | 'tooth',
  ) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Можно загрузить только фотографию или изображение.');
      return;
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setPhotoError('Размер фотографии не должен превышать 10 МБ.');
      return;
    }
    if (scope === 'tooth' && !selectedTooth) {
      setPhotoError('Сначала выберите зуб на формуле.');
      return;
    }

    try {
      setPhotoError(null);
      setPhotoFeedback(null);
      await uploadPhoto(
        file,
        scope,
        scope === 'tooth' ? selectedTooth?.toothNumber : undefined,
      );
      setPhotoFeedback(scope === 'tooth'
        ? `Фотография зуба ${selectedTooth?.toothNumber} добавлена в карту пациента.`
        : 'Фотография всей зубной карты добавлена в карту пациента.');
    } catch (error) {
      console.error('Failed to upload dental photo', error);
      setPhotoError(error instanceof Error ? error.message : 'Не удалось загрузить фотографию.');
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
          <input
            ref={chartPhotoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={event => {
              void handlePhotoSelection(event.target.files?.[0], 'chart');
              event.target.value = '';
            }}
          />
          <input
            ref={toothPhotoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={event => {
              void handlePhotoSelection(event.target.files?.[0], 'tooth');
              event.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => chartPhotoInputRef.current?.click()}
            disabled={isPhotoUploading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-3.5 w-3.5" />
            Фото карты
          </button>
          <button
            type="button"
            onClick={() => toothPhotoInputRef.current?.click()}
            disabled={!selectedTooth || isPhotoUploading}
            title={selectedTooth ? `Добавить фотографию зуба ${selectedTooth.toothNumber}` : 'Сначала выберите зуб'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Camera className="h-3.5 w-3.5" />
            {selectedTooth ? `Фото зуба ${selectedTooth.toothNumber}` : 'Фото зуба'}
          </button>
        </div>
      </div>

      {(photoError || photosError) && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          {photoError || photosError?.message}
        </div>
      )}

      {photoFeedback && (
        <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
          {photoFeedback}
        </div>
      )}

      <div className="flex flex-col lg:flex-row">
        <div className="min-w-0 flex-1 bg-slate-50 p-4 border-b lg:border-b-0 lg:border-r border-slate-200">
          <ToothGrid
            teeth={dentalChart.teeth}
            findings={findings}
            onToothClick={handleToothClick}
            selectedToothNumber={selectedTooth?.toothNumber}
            dentitionMode={dentitionMode}
            onDentitionModeChange={handleDentitionModeChange}
          />
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

      <section className="border-t border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Images className="h-4 w-4 text-blue-600" />
              Клинические фотографии
            </h4>
            <p className="mt-0.5 text-xs text-slate-500">
              Фото реального состояния всей полости рта или выбранного зуба.
            </p>
          </div>
          {photos.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
              {photos.length}
            </span>
          )}
        </div>

        {isPhotosLoading ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Загружаем фотографии...
          </div>
        ) : photos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
            <Camera className="mx-auto mb-2 h-6 w-6 text-slate-400" />
            <p className="text-sm font-medium text-slate-600">Фотографий пока нет</p>
            <p className="mt-1 text-xs text-slate-500">
              Используйте кнопки «Фото карты» или «Фото зуба».
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {photos.map(photo => (
              <a
                key={photo.id}
                href={photo.url}
                target="_blank"
                rel="noreferrer"
                className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                  <img
                    src={photo.url}
                    alt={photo.scope === 'tooth'
                      ? `Клиническая фотография зуба ${photo.toothNumber}`
                      : 'Клиническая фотография зубной карты'}
                    className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                  />
                </div>
                <div className="p-2">
                  <div className="text-xs font-semibold text-slate-700">
                    {photo.scope === 'tooth' ? `Зуб ${photo.toothNumber}` : 'Вся карта'}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-slate-500" title={photo.fileName}>
                    {photo.fileName}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400">
                    {formatPhotoDate(photo.createdAt)}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

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
