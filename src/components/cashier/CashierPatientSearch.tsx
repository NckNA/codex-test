import type { FormEvent } from 'react';
import type { Patient } from '../../types';

interface Props {
  query: string;
  patients: Patient[];
  loading: boolean;
  error: Error | null;
  selectedPatient: Patient | null;
  disabled?: boolean;
  onSearch: (query: string) => Promise<void>;
  onSelect: (patient: Patient) => void;
}

export function CashierPatientSearch({ query, patients, loading, error, selectedPatient, disabled = false, onSearch, onSelect }: Props) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem('cashier-patient-query') as HTMLInputElement | null;
    void onSearch(input?.value ?? '');
  };

  return (
    <section data-testid="cashier-patient-search" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Поиск пациента</h2>
      <p className="mt-1 text-sm text-slate-500">Поиск работает только внутри активной клиники.</p>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 md:flex-row">
        <input name="cashier-patient-query" data-testid="cashier-patient-query" defaultValue={query} placeholder="ФИО или телефон" disabled={disabled} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100" />
        <button type="submit" data-testid="cashier-patient-search-submit" disabled={disabled} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">Найти</button>
      </form>
      {loading && <p data-testid="cashier-patient-search-loading" className="mt-3 text-sm text-slate-500">Ищем пациента...</p>}
      {error && <p data-testid="cashier-patient-search-error" className="mt-3 text-sm font-medium text-rose-600">{error.message}</p>}
      {selectedPatient && <p data-testid="cashier-selected-patient" className="mt-3 text-sm text-emerald-700">Выбран пациент: {selectedPatient.fullName}</p>}
      {!loading && patients.length === 0 && query.trim().length >= 2 && !error && <p data-testid="cashier-patient-search-empty" className="mt-3 text-sm text-slate-500">Пациенты не найдены.</p>}
      <div className="mt-4 space-y-3">
        {patients.map((patient) => (
          <article key={patient.id} data-testid={`cashier-patient-card-${patient.id}`} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-slate-900">{patient.fullName}</p>
                <p className="text-sm text-slate-500">{patient.phone || 'Телефон не указан'} · {patient.status}</p>
                <p className="text-xs text-slate-400">ID: {patient.id.slice(0, 8)}</p>
              </div>
              <button type="button" data-testid={`cashier-select-patient-${patient.id}`} disabled={disabled} onClick={() => onSelect(patient)} className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60">Выбрать</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
