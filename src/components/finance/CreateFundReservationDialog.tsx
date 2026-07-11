/* eslint-disable react-hooks/set-state-in-effect -- opening a dialog intentionally resets stale patient form values */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { PatientFundReservationPurpose, Payment, PaymentFundCapacity } from '../../data/repositories/FinanceRepository';
import type { CreateFundReservationValues } from '../../data/hooks/usePatientFundReservationFlow';
import { formatFinanceDateTime, formatFinanceMoney, paymentMethodLabels, shortFinanceId } from './financeLabels';
import { patientFundReservationPurposeLabels } from './fundReservationLabels';

export interface FundReservationLinkOption {
  id: string;
  label: string;
}

interface CreateFundReservationDialogProps {
  open: boolean;
  payments: Payment[];
  capacities: Record<string, PaymentFundCapacity>;
  appointments?: FundReservationLinkOption[];
  treatmentPlans?: FundReservationLinkOption[];
  pending?: boolean;
  actionMessage?: string | null;
  onClose: () => void;
  onSubmit: (values: CreateFundReservationValues) => Promise<unknown> | unknown;
}

function parsePositiveAmount(value: string) {
  const amount = Number(value.replace(',', '.'));
  return Number.isFinite(amount) ? amount : Number.NaN;
}

export function CreateFundReservationDialog({
  open,
  payments,
  capacities,
  appointments = [],
  treatmentPlans = [],
  pending = false,
  actionMessage,
  onClose,
  onSubmit,
}: CreateFundReservationDialogProps) {
  const eligiblePayments = useMemo(
    () => payments.filter((payment) => {
      const capacity = capacities[payment.id];
      return capacity
        && capacity.availableCreditAmount > 0
        && !['voided', 'archived', 'refunded'].includes(payment.status);
    }),
    [capacities, payments],
  );
  const [paymentId, setPaymentId] = useState('');
  const [amount, setAmount] = useState('');
  const [purposeType, setPurposeType] = useState<PatientFundReservationPurpose>('general');
  const [purposeLabel, setPurposeLabel] = useState('');
  const [appointmentId, setAppointmentId] = useState('');
  const [treatmentPlanId, setTreatmentPlanId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open, pending]);

  useEffect(() => {
    if (!open) return;
    const first = eligiblePayments[0]?.id ?? '';
    setPaymentId(first);
    setAmount('');
    setPurposeType('general');
    setPurposeLabel('');
    setAppointmentId('');
    setTreatmentPlanId('');
    setExpiresAt('');
    setNotes('');
    setValidationError(null);
  }, [eligiblePayments, open]);

  if (!open) return null;

  const payment = payments.find((candidate) => candidate.id === paymentId) ?? null;
  const capacity = paymentId ? capacities[paymentId] ?? null : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);
    const parsedAmount = parsePositiveAmount(amount);
    if (!payment || !capacity) {
      setValidationError('Выберите платёж с доступным кредитом.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setValidationError('Сумма должна быть больше 0.');
      return;
    }
    if (parsedAmount > capacity.availableCreditAmount) {
      setValidationError('Недостаточно доступного кредита для создания депозита.');
      return;
    }
    const normalizedPurposeLabel = purposeLabel.trim();
    if (purposeType === 'other' && (normalizedPurposeLabel.length < 2 || normalizedPurposeLabel.length > 120)) {
      setValidationError('Укажите назначение от 2 до 120 символов.');
      return;
    }
    if (purposeType === 'appointment' && !appointmentId) {
      setValidationError('Выберите запись для депозита.');
      return;
    }
    if (purposeType === 'treatment_plan' && !treatmentPlanId) {
      setValidationError('Выберите план лечения для депозита.');
      return;
    }
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      setValidationError('Дата окончания не может быть в прошлом.');
      return;
    }
    await onSubmit({
      paymentId,
      amount: parsedAmount,
      purposeType,
      purposeLabel: normalizedPurposeLabel || null,
      appointmentId: appointmentId || null,
      treatmentPlanId: treatmentPlanId || null,
      expiresAt: expiresAt || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" data-testid="create-fund-reservation-dialog-backdrop">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-fund-reservation-title"
        data-testid="create-fund-reservation-dialog"
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="create-fund-reservation-title" className="text-lg font-semibold text-slate-900">Создать депозит</h3>
            <p className="mt-1 text-sm text-slate-500">Резервируется часть уже полученных средств. Новый платёж не создаётся.</p>
          </div>
          <button type="button" onClick={onClose} disabled={pending} aria-label="Закрыть" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-50">Закрыть</button>
        </div>

        {eligiblePayments.length === 0 ? (
          <p data-testid="create-fund-reservation-no-credit" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Нет доступных средств для создания депозита.</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            <label className="block text-sm font-medium text-slate-700" htmlFor="fund-reservation-payment">Источник средств</label>
            <select
              id="fund-reservation-payment"
              data-testid="fund-reservation-payment"
              value={paymentId}
              onChange={(event) => setPaymentId(event.target.value)}
              disabled={pending}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
            >
              {eligiblePayments.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {formatFinanceDateTime(candidate.receivedAt)} · {paymentMethodLabels[candidate.paymentMethod]} · {formatFinanceMoney(candidate.amount, candidate.currency)} · #{shortFinanceId(candidate.id)}
                </option>
              ))}
            </select>

            {payment && capacity && (
              <div data-testid="fund-reservation-payment-capacity" className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Сумма платежа', capacity.paymentAmount],
                  ['Распределено', capacity.activeAllocatedAmount],
                  ['Возвращено', capacity.completedRefundAmount],
                  ['Зарезервировано под возврат', capacity.refundReservedAmount],
                  ['Зарезервировано как депозит', capacity.reservedDepositAmount],
                  ['Доступный кредит', capacity.availableCreditAmount],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{formatFinanceMoney(value as number, capacity.currency)}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="fund-reservation-amount">Сумма депозита
                <input id="fund-reservation-amount" data-testid="fund-reservation-amount" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={pending} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700" htmlFor="fund-reservation-purpose">Назначение
                <select id="fund-reservation-purpose" data-testid="fund-reservation-purpose" value={purposeType} onChange={(event) => setPurposeType(event.target.value as PatientFundReservationPurpose)} disabled={pending} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="general">{patientFundReservationPurposeLabels.general}</option>
                  <option value="service">{patientFundReservationPurposeLabels.service}</option>
                  <option value="appointment" disabled={appointments.length === 0}>{patientFundReservationPurposeLabels.appointment}</option>
                  <option value="treatment_plan" disabled={treatmentPlans.length === 0}>{patientFundReservationPurposeLabels.treatment_plan}</option>
                  <option value="other">{patientFundReservationPurposeLabels.other}</option>
                </select>
              </label>
            </div>

            {(purposeType === 'other' || purposeType === 'service') && (
              <label className="block text-sm font-medium text-slate-700" htmlFor="fund-reservation-purpose-label">Описание назначения
                <input id="fund-reservation-purpose-label" data-testid="fund-reservation-purpose-label" minLength={purposeType === 'other' ? 2 : undefined} maxLength={120} value={purposeLabel} onChange={(event) => setPurposeLabel(event.target.value)} disabled={pending} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
            )}

            {purposeType === 'appointment' && (
              <label className="block text-sm font-medium text-slate-700" htmlFor="fund-reservation-appointment">Запись
                <select id="fund-reservation-appointment" data-testid="fund-reservation-appointment" value={appointmentId} onChange={(event) => setAppointmentId(event.target.value)} disabled={pending} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="">Выберите запись</option>
                  {appointments.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
            )}

            {purposeType === 'treatment_plan' && (
              <label className="block text-sm font-medium text-slate-700" htmlFor="fund-reservation-treatment-plan">План лечения
                <select id="fund-reservation-treatment-plan" data-testid="fund-reservation-treatment-plan" value={treatmentPlanId} onChange={(event) => setTreatmentPlanId(event.target.value)} disabled={pending} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="">Выберите план лечения</option>
                  {treatmentPlans.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="fund-reservation-expiry">Дата окончания, необязательно
                <input id="fund-reservation-expiry" data-testid="fund-reservation-expiry" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} disabled={pending} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700" htmlFor="fund-reservation-notes">Примечание
                <input id="fund-reservation-notes" data-testid="fund-reservation-notes" maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} disabled={pending} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
            </div>

            {(validationError || actionMessage) && (
              <p data-testid="create-fund-reservation-message" aria-live="polite" className={`rounded-lg p-3 text-sm ${validationError ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-800'}`}>
                {validationError || actionMessage}
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} disabled={pending} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium disabled:opacity-50">Отмена</button>
              <button type="submit" data-testid="fund-reservation-create-submit" disabled={pending || eligiblePayments.length === 0} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {pending ? 'Сохраняем…' : 'Создать депозит'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
