import type { Invoice, PatientFundReservation, Payment } from '../../data/repositories/FinanceRepository';
import { formatFinanceDateTime, formatFinanceMoney, paymentMethodLabels, shortFinanceId } from './financeLabels';
import {
  getPatientFundReservationPurposeLabel,
  isActiveFundReservationStatus,
  patientFundReservationStatusLabels,
} from './fundReservationLabels';

interface PatientFundReservationCardProps {
  reservation: PatientFundReservation;
  payment?: Payment | null;
  invoices?: Invoice[];
  canRelease?: boolean;
  canUse?: boolean;
  pending?: boolean;
  appointmentLabel?: string | null;
  treatmentPlanLabel?: string | null;
  onRelease?: (reservation: PatientFundReservation) => void;
  onUse?: (reservation: PatientFundReservation) => void;
}

function statusClasses(status: PatientFundReservation['status']) {
  if (status === 'active') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'partially_used') return 'border-blue-200 bg-blue-50 text-blue-800';
  if (status === 'archived') return 'border-slate-200 bg-slate-100 text-slate-500';
  return 'border-slate-200 bg-white text-slate-700';
}

export function PatientFundReservationCard({
  reservation,
  payment,
  invoices = [],
  canRelease = false,
  canUse = false,
  pending = false,
  appointmentLabel,
  treatmentPlanLabel,
  onRelease,
  onUse,
}: PatientFundReservationCardProps) {
  const active = isActiveFundReservationStatus(reservation.status);
  const hasEligibleInvoice = invoices.some((invoice) => (
    invoice.tenantId === reservation.tenantId
    && invoice.patientId === reservation.patientId
    && invoice.currency === reservation.currency
    && ['issued', 'partially_paid'].includes(invoice.status)
    && invoice.balanceAmount > 0
  ));
  const linkedLabel = reservation.appointmentId
    ? appointmentLabel || `Запись #${shortFinanceId(reservation.appointmentId)}`
    : reservation.treatmentPlanId
      ? treatmentPlanLabel || `План #${shortFinanceId(reservation.treatmentPlanId)}`
      : null;

  return (
    <article
      data-testid={`fund-reservation-card-${reservation.id}`}
      className={`rounded-2xl border p-5 shadow-sm ${statusClasses(reservation.status)}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-current/20 px-2.5 py-1 text-xs font-semibold">
              {patientFundReservationStatusLabels[reservation.status]}
            </span>
            <span className="text-sm font-semibold text-slate-900">
              {getPatientFundReservationPurposeLabel(reservation.purposeType, reservation.purposeLabel)}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Создан: {formatFinanceDateTime(reservation.createdAt)}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs text-slate-500">Остаток</p>
          <p className="text-lg font-semibold text-slate-900">{formatFinanceMoney(reservation.remainingAmount, reservation.currency)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Исходная сумма', reservation.originalAmount],
          ['Использовано', reservation.consumedAmount],
          ['Освобождено', reservation.releasedAmount],
          ['Осталось', reservation.remainingAmount],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border border-slate-200/80 bg-white/80 p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatFinanceMoney(value as number, reservation.currency)}</p>
          </div>
        ))}
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="inline text-slate-500">Платёж: </dt><dd className="inline text-slate-800">{payment ? `${formatFinanceDateTime(payment.receivedAt)} · ${paymentMethodLabels[payment.paymentMethod]} · #${shortFinanceId(payment.id)}` : `#${shortFinanceId(reservation.paymentId)}`}</dd></div>
        <div><dt className="inline text-slate-500">Дата окончания: </dt><dd className="inline text-slate-800">{formatFinanceDateTime(reservation.expiresAt)}</dd></div>
        {linkedLabel && <div><dt className="inline text-slate-500">Связь: </dt><dd className="inline text-slate-800">{linkedLabel}</dd></div>}
        {reservation.releasedAt && <div><dt className="inline text-slate-500">Освобождён: </dt><dd className="inline text-slate-800">{formatFinanceDateTime(reservation.releasedAt)}</dd></div>}
      </dl>

      {reservation.notes && <p data-testid={`fund-reservation-note-${reservation.id}`} className="mt-4 rounded-lg bg-white/80 p-3 text-sm text-slate-700">{reservation.notes}</p>}

      {active && (canRelease || canUse) && (
        <div className="mt-5 flex flex-wrap gap-3">
          {canUse && (
            <button
              type="button"
              data-testid={`fund-reservation-use-${reservation.id}`}
              onClick={() => onUse?.(reservation)}
              disabled={pending || reservation.remainingAmount <= 0 || !hasEligibleInvoice}
              title={!hasEligibleInvoice ? 'Нет доступного счёта с задолженностью в валюте депозита.' : undefined}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Использовать депозит
            </button>
          )}
          {canRelease && (
            <button
              type="button"
              data-testid={`fund-reservation-release-${reservation.id}`}
              onClick={() => onRelease?.(reservation)}
              disabled={pending || reservation.remainingAmount <= 0}
              className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Освободить резерв
            </button>
          )}
        </div>
      )}
    </article>
  );
}
