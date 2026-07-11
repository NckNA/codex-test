/* eslint-disable react-hooks/set-state-in-effect -- tenant, patient, and role changes must close stale finance dialogs immediately */
import { useEffect, useMemo, useState } from 'react';
import type {
  FinanceRepository,
  Invoice,
  PatientFinanceSummary,
  PatientFundReservation,
  Payment,
} from '../../data/repositories/FinanceRepository';
import type { FinanceRpcClient } from '../../data/repositories/FinanceRpcClient';
import { usePatientFundReservations } from '../../data/hooks/usePatientFundReservations';
import { usePatientFundReservationFlow } from '../../data/hooks/usePatientFundReservationFlow';
import type { FinanceUserRole } from './financePermissions';
import { formatFinanceMoney } from './financeLabels';
import { isActiveFundReservationStatus } from './fundReservationLabels';
import { CreateFundReservationDialog, type FundReservationLinkOption } from './CreateFundReservationDialog';
import { PatientFundReservationCard } from './PatientFundReservationCard';
import { ReleaseFundReservationDialog } from './ReleaseFundReservationDialog';
import { UseReservedCreditDialog } from './UseReservedCreditDialog';

interface PatientFundReservationsPanelProps {
  tenantId?: string | null;
  patientId?: string | null;
  role?: FinanceUserRole;
  summary: PatientFinanceSummary | null;
  payments: Payment[];
  invoices: Invoice[];
  repository?: FinanceRepository;
  rpcClient?: FinanceRpcClient;
  appointmentOptions?: FundReservationLinkOption[];
  treatmentPlanOptions?: FundReservationLinkOption[];
  onChanged?: () => Promise<void> | void;
}

type ReservationFilter = 'all' | 'active' | 'used' | 'released';

function matchesFilter(reservation: PatientFundReservation, filter: ReservationFilter) {
  if (filter === 'all') return true;
  if (filter === 'active') return isActiveFundReservationStatus(reservation.status);
  if (filter === 'used') return reservation.status === 'partially_used' || reservation.status === 'fully_used';
  return reservation.status === 'released';
}

export function PatientFundReservationsPanel({
  tenantId,
  patientId,
  role,
  summary,
  payments,
  invoices,
  repository,
  rpcClient,
  appointmentOptions = [],
  treatmentPlanOptions = [],
  onChanged,
}: PatientFundReservationsPanelProps) {
  const [filter, setFilter] = useState<ReservationFilter>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [releaseReservation, setReleaseReservation] = useState<PatientFundReservation | null>(null);
  const [useReservation, setUseReservation] = useState<PatientFundReservation | null>(null);

  const reservationQuery = usePatientFundReservations({
    tenantId,
    patientId,
    role,
    payments,
    repository,
  });
  const flow = usePatientFundReservationFlow({
    tenantId,
    patientId,
    role,
    repository,
    rpcClient,
    reservations: reservationQuery.reservations,
    invoices,
    refreshReservations: reservationQuery.refresh,
    onChanged,
  });

  useEffect(() => {
    setCreateOpen(false);
    setReleaseReservation(null);
    setUseReservation(null);
    setFilter('all');
    flow.clearActionFeedback();
    // flow method is intentionally omitted: the context values are the reset boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, patientId, role]);

  const filtered = useMemo(
    () => reservationQuery.reservations.filter((reservation) => matchesFilter(reservation, filter)),
    [filter, reservationQuery.reservations],
  );
  const active = filtered.filter((reservation) => isActiveFundReservationStatus(reservation.status));
  const completed = filtered.filter((reservation) => !isActiveFundReservationStatus(reservation.status));
  const paymentMap = useMemo(() => new Map(payments.map((payment) => [payment.id, payment])), [payments]);
  const hasAvailablePayment = Object.values(reservationQuery.capacities).some((capacity) => capacity.availableCreditAmount > 0);
  const hasDepositSummary = summary?.currencies.some((bucket) => bucket.reservedDepositAmount > 0) ?? false;

  if (!tenantId || !patientId || !flow.capabilities.canViewSummary) return null;

  return (
    <section data-testid="patient-fund-reservations-panel" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Кредит и депозиты</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">Доступный кредит — средства пациента, которые уже получены клиникой и пока не распределены, не возвращены и не зарезервированы.</p>
        </div>
        {flow.capabilities.canCreate && (
          <button
            type="button"
            data-testid="fund-reservation-create-open"
            onClick={() => { flow.clearActionFeedback(); setCreateOpen(true); }}
            disabled={reservationQuery.loading || !hasAvailablePayment || flow.actionLoading}
            title={!hasAvailablePayment ? 'Нет доступных средств для создания депозита.' : undefined}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Создать депозит
          </button>
        )}
      </div>

      <div data-testid="fund-reservation-summary" className="mt-5 space-y-4">
        {(summary?.currencies ?? []).map((bucket) => (
          <div key={bucket.currency} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{bucket.currency}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ['Доступный кредит', bucket.availableCreditAmount, 'Средства, доступные после вычета резервов.'],
                ['Зарезервировано как депозит', bucket.reservedDepositAmount, 'Средства, удерживаемые под будущую услугу или цель.'],
                ['Зарезервировано под возврат', bucket.refundReservedAmount, 'Средства по ожидающим или одобренным возвратам.'],
                ['Получено денег', bucket.cashReceived, 'Фактически полученные клиникой деньги.'],
                ['Долг', bucket.currentDebt, 'Текущая задолженность по счетам.'],
              ].map(([label, amount, help]) => (
                <div key={label as string} title={help as string} className="rounded-lg bg-white p-3">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatFinanceMoney(amount as number, bucket.currency)}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500" title="Сумма до вычета резервов под возврат и депозит.">Не распределено до резервов: {formatFinanceMoney(bucket.grossUnallocatedAmount, bucket.currency)}</p>
          </div>
        ))}
      </div>

      {!flow.capabilities.canViewReservations && (
        <div data-testid="fund-reservation-readonly-indicator" className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          {hasDepositSummary ? 'Депозит внесён. Управление доступно финансовым сотрудникам.' : 'Активный депозит не указан.'}
        </div>
      )}

      {flow.capabilities.canViewReservations && (
        <>
          <div className="mt-6 flex flex-wrap gap-2" aria-label="Фильтры депозитов">
            {([
              ['all', 'Все'],
              ['active', 'Активные'],
              ['used', 'Использованные'],
              ['released', 'Освобождённые'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                data-testid={`fund-reservation-filter-${value}`}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${filter === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {reservationQuery.loading && <p data-testid="fund-reservation-loading" className="mt-5 text-sm text-slate-500">Загружаем кредит и депозиты…</p>}
          {reservationQuery.error && <p data-testid="fund-reservation-load-error" className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{reservationQuery.error.message}</p>}
          {flow.actionMessage && !createOpen && !releaseReservation && !useReservation && (
            <p data-testid="fund-reservation-action-message" aria-live="polite" className={`mt-5 rounded-lg p-3 text-sm ${flow.actionState === 'failed' ? 'bg-rose-50 text-rose-700' : flow.actionState === 'succeeded' ? 'bg-emerald-50 text-emerald-800' : 'bg-blue-50 text-blue-800'}`}>{flow.actionMessage}</p>
          )}

          {!reservationQuery.loading && !reservationQuery.error && reservationQuery.reservations.length === 0 && (
            <p data-testid="fund-reservation-empty" className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">У пациента пока нет депозитов.</p>
          )}
          {!reservationQuery.loading && !reservationQuery.error && reservationQuery.reservations.length > 0 && filtered.length === 0 && (
            <p data-testid="fund-reservation-filter-empty" className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">По выбранному фильтру депозитов нет.</p>
          )}

          {active.length > 0 && (
            <div className="mt-6 space-y-4" data-testid="fund-reservation-active-section">
              <h3 className="text-base font-semibold text-slate-900">Активные</h3>
              {active.map((reservation) => (
                <PatientFundReservationCard
                  key={reservation.id}
                  reservation={reservation}
                  payment={paymentMap.get(reservation.paymentId)}
                  invoices={invoices}
                  canRelease={flow.capabilities.canRelease}
                  canUse={flow.capabilities.canUse}
                  pending={flow.actionLoading}
                  onRelease={(selected) => { flow.clearActionFeedback(); setReleaseReservation(selected); }}
                  onUse={(selected) => { flow.clearActionFeedback(); setUseReservation(selected); }}
                />
              ))}
            </div>
          )}

          {completed.length > 0 && (
            <div className="mt-6 space-y-4" data-testid="fund-reservation-completed-section">
              <h3 className="text-base font-semibold text-slate-900">Завершённые</h3>
              {completed.map((reservation) => (
                <PatientFundReservationCard key={reservation.id} reservation={reservation} payment={paymentMap.get(reservation.paymentId)} invoices={invoices} />
              ))}
            </div>
          )}
        </>
      )}

      <CreateFundReservationDialog
        open={createOpen}
        payments={payments}
        capacities={reservationQuery.capacities}
        appointments={appointmentOptions}
        treatmentPlans={treatmentPlanOptions}
        pending={flow.actionLoading && flow.actionState !== 'failed'}
        actionMessage={flow.actionMessage}
        onClose={() => { setCreateOpen(false); flow.clearActionFeedback(); }}
        onSubmit={async (values) => {
          const result = await flow.createReservation(values);
          if (result) setCreateOpen(false);
        }}
      />
      <ReleaseFundReservationDialog
        open={Boolean(releaseReservation)}
        reservation={releaseReservation}
        pending={flow.actionLoading && flow.actionState !== 'failed'}
        actionMessage={flow.actionMessage}
        onClose={() => { setReleaseReservation(null); flow.clearActionFeedback(); }}
        onSubmit={async (values) => {
          const result = await flow.releaseReservation(values);
          if (result) setReleaseReservation(null);
        }}
      />
      <UseReservedCreditDialog
        open={Boolean(useReservation)}
        reservation={useReservation}
        invoices={invoices}
        pending={flow.actionLoading && flow.actionState !== 'failed'}
        actionMessage={flow.actionMessage}
        onClose={() => { setUseReservation(null); flow.clearActionFeedback(); }}
        onSubmit={async (values) => {
          const result = await flow.useReservedCredit(values);
          if (result) setUseReservation(null);
        }}
      />
    </section>
  );
}
