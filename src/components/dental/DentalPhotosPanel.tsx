import { useRef, useState } from 'react';
import { Archive, ImagePlus, RefreshCw } from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { usePatientFiles } from '../../data/hooks/usePatientFiles';

interface DentalPhotosPanelProps {
  patientId: string;
}

const UPLOAD_ROLES = new Set(['clinic_owner', 'clinic_admin', 'doctor']);

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
}

export function DentalPhotosPanel({ patientId }: DentalPhotosPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { activeTenant } = useTenant();
  const { files, isLoading, isUploading, isArchiving, error, uploadFile, archiveFile, refresh } = usePatientFiles(patientId);
  const [localError, setLocalError] = useState<string | null>(null);

  const canUpload = Boolean(activeTenant?.tenantId && activeTenant?.role && UPLOAD_ROLES.has(activeTenant.role));
  const hasTenant = Boolean(activeTenant?.tenantId);

  const handleUpload = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    try {
      setLocalError(null);
      await uploadFile(file, { fileKind: 'dental_photo', sourceContext: 'dental_chart' });
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Не удалось загрузить файл.');
    }
  };

  const handleArchive = async (fileId: string) => {
    const confirmed = window.confirm('Архивировать файл? Он исчезнет из активного списка, но останется в истории.');
    if (!confirmed) return;
    try {
      setLocalError(null);
      await archiveFile(fileId);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Не удалось архивировать файл.');
    }
  };

  return (
    <section className="border-t border-slate-200 bg-white p-4" aria-label="Фото зубов">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-slate-800">Фото / снимки пациента</h4>
          <p className="text-xs text-slate-500">Изображения хранятся в приватном tenant-scoped Storage и связаны с карточкой пациента.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => refresh()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Обновить
          </button>
          {canUpload && (
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
              <ImagePlus className="h-3.5 w-3.5" /> Загрузить фото
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={isUploading}
                onChange={(event) => void handleUpload(event.target.files)}
              />
            </label>
          )}
        </div>
      </div>

      {!hasTenant && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          Выберите активную клинику, чтобы просматривать и загружать файлы пациента.
        </div>
      )}

      {hasTenant && !canUpload && (
        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          Ваша роль может просматривать файлы, но загрузка и архивирование доступны только врачу или администратору клиники.
        </div>
      )}

      {(localError || error) && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {localError ?? error?.message}
        </div>
      )}

      {isLoading && <div className="text-sm text-slate-500">Файлы загружаются...</div>}
      {isUploading && <div className="text-sm text-blue-600">Загрузка изображения...</div>}

      {!isLoading && files.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
          Файлы ещё не загружены.
        </div>
      )}

      {files.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {files.map((file) => (
            <article key={file.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex h-36 items-center justify-center bg-slate-100">
                {file.previewUrl ? (
                  <img src={file.previewUrl} alt={file.originalFilename} className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="h-8 w-8 text-slate-300" />
                )}
              </div>
              <div className="space-y-2 p-3">
                <div className="truncate text-sm font-semibold text-slate-800" title={file.originalFilename}>{file.originalFilename}</div>
                <div className="text-xs text-slate-500">{formatDate(file.createdAt)} · {Math.round(file.sizeBytes / 1024)} КБ</div>
                {file.toothId && <div className="text-xs text-slate-500">Зуб: {file.toothId}</div>}
                {canUpload && (
                  <button
                    type="button"
                    disabled={isArchiving}
                    onClick={() => void handleArchive(file.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Archive className="h-3.5 w-3.5" /> Архивировать
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
