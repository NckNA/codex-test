import { useState, type FormEvent } from 'react';
import { Search, X } from 'lucide-react';
import { useLaboratoryPatientLookup } from '../../data/hooks/useLaboratoryPatientLookup';
import type { PatientLookupRecord } from '../../data/repositories/PatientRepository';

interface LaboratoryPatientPickerProps {
  onClose: () => void;
  onSelect: (patient: PatientLookupRecord) => void;
}

export function LaboratoryPatientPicker({ onClose, onSelect }: LaboratoryPatientPickerProps) {
  const lookup = useLaboratoryPatientLookup();
  const [input, setInput] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await lookup.search(input);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" data-testid="laboratory-patient-picker">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Выберите пациента</h2>
            <p className="mt-1 text-sm text-slate-500">Поиск по имени или телефону. Список пациентов заранее не загружается.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={submit} className="p-5">
          <label className="block text-sm font-medium text-slate-700">
            Имя или телефон
            <div className="mt-1 flex gap-2">
              <input
                data-testid="laboratory-patient-search-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Минимум 2 символа"
                autoFocus
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                data-testid="laboratory-patient-search-submit"
                disabled={!lookup.ready || lookup.loading || input.trim().length < 2}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Search className="h-4 w-4" />
                {lookup.loading ? 'Ищем…' : 'Найти'}
              </button>
            </div>
          </label>

          {!lookup.ready && (
            <div data-testid="laboratory-patient-search-unavailable" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Поиск доступен только в активной клинике с серверным подключением.
            </div>
          )}
          {lookup.error && (
            <div data-testid="laboratory-patient-search-error" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{lookup.error.message}</div>
          )}

          {lookup.results.length > 0 ? (
            <div className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200" data-testid="laboratory-patient-search-results">
              {lookup.results.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  data-testid={`laboratory-patient-result-${patient.id}`}
                  onClick={() => onSelect(patient)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">{patient.fullName}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{patient.phone || 'Телефон не указан'}</span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-blue-600">Выбрать</span>
                </button>
              ))}
            </div>
          ) : lookup.query.trim().length >= 2 && !lookup.loading && !lookup.error ? (
            <div data-testid="laboratory-patient-search-empty" className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Пациенты не найдены.</div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
