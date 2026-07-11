/* eslint-disable react-hooks/set-state-in-effect -- changing tenant/patient must synchronously clear stale dialog state */
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import type { PatientFinanceSummary, PaymentMethod } from '../../data/repositories/FinanceRepository';
import { getPatientFinanceCurrencySummaries } from '../../data/repositories/FinanceRepository';
import type { PatientCreditPaymentOperationResult } from '../../data/repositories/FinanceRpcClient';
import type {
  PatientCreditOperationStatus,
  RecordPaymentActionInput,
} from '../../data/hooks/useFinanceActions';
import { getFinanceRoleCapabilities, type FinanceUserRole } from '../finance/financePermissions';
import { CASHIER_PAYMENT_METHODS, cashierPaymentMethodLabels, formatCashierMoney, shortCashierId } from './cashierLabels';

export interface PrepaymentPatient {
  id: string;
  fullName: string;
}

interface AcceptPatientPrepaymentDialogProps {
  tenantId?: string | null;
  patient?: PrepaymentPatient | null;
  role?: FinanceUserRole;
  summary: PatientFinanceSummary | null;
  operationStatus: PatientCreditOperationStatus;
  operationResult: PatientCreditPaymentOperationResult | null;
  operationError?: Error | null;
  onSubmit: (input: RecordPaymentActionInput) => Promise<PatientCreditPaymentOperationResult>;
  onResetOperation?: () => void;
  triggerClassName?: string;
  triggerSlot?: ReactNode;
  testIdPrefix?: string;
}

type PaymentMethodValue = PaymentMethod | '';

function normalizeAmount(value: string) {
  const trimmed = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const amount = Number(trimmed);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function trimOptional(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function safeDialogError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const allowed = [
    'Недостаточно прав для приёма предоплаты.',
    'Эта операция уже была выполнена с другими параметрами.',
    'Операция относится к другому пациенту. Данные обновлены.',
    'Предоплата принимается только в KZT.',
    'Не удалось подтвердить результат операции. Повторите попытку с теми же данными.',
    'Не удалось принять предоплату. Проверьте текущее состояние операции.',
  ];
  return allowed.includes(message) ? message : 'Не удалось принять предоплату. Проверьте текущее состояние операции.';
}

export function AcceptPatientPrepaymentDialog({
  tenantId,
  patient,
  role,
  summary,
  operationStatus,
  operationResult,
  operationError,
  onSubmit,
  onResetOperation,
  triggerClassName,
  triggerSlot,
  testIdPrefix = 'prepayment',
}: AcceptPatientPrepaymentDialogProps) {
  const capabilities = getFinanceRoleCapabilities(role);
  const contextKey = tenantId && patient ? `${tenantId}:${patient.id}` : null;
  const contextRef = useRef(contextKey);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const submitGuardRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>('');
  const [receivedAt, setReceivedAt] = useState('');
  const [externalReference, setExternalReference] = useState('');
  const [payerName, setPayerName] = useState('');
  const [notes, setNotes] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [methodError, setMethodError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successInput, setSuccessInput] = useState<{ amount: number; paymentMethod: PaymentMethod } | null>(null);

  const currencySummary = useMemo(
    () => getPatientFinanceCurrencySummaries(summary).find((item) => item.currency === 'KZT') ?? null,
    [summary],
  );
  const isSubmitting = operationStatus === 'submitting';
  const isReconciling = operationStatus === 'reconciling';
  const isBusy = isSubmitting || isReconciling;
  const isUncertain = operationStatus === 'uncertain';
  const isSucceeded = operationStatus === 'succeeded' && Boolean(operationResult?.payment);

  useEffect(() => {
    contextRef.current = contextKey;
    setOpen(false);
    setAmount('');
    setPaymentMethod('');
    setReceivedAt('');
    setExternalReference('');
    setPayerName('');
    setNotes('');
    setAmountError(null);
    setMethodError(null);
    setFormError(null);
    setSuccessInput(null);
    onResetOperation?.();
  }, [contextKey, onResetOperation]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => amountInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  const displayedError = formError ?? (operationError ? safeDialogError(operationError) : null);

  if (!tenantId || !patient || !capabilities.canRecordPayment) return null;

  const resetCompletedForm = () => {
    setAmount('');
    setPaymentMethod('');
    setReceivedAt('');
    setExternalReference('');
    setPayerName('');
    setNotes('');
    setAmountError(null);
    setMethodError(null);
    setFormError(null);
    setSuccessInput(null);
    onResetOperation?.();
  };

  const close = () => {
    if (isBusy) return;
    setOpen(false);
    if (isSucceeded) resetCompletedForm();
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !isBusy) {
      event.preventDefault();
      close();
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitGuardRef.current || isBusy) return;
    setAmountError(null);
    setMethodError(null);
    setFormError(null);

    const parsedAmount = normalizeAmount(amount);
    if (parsedAmount === null) {
      setAmountError('Введите сумму больше нуля.');
      return;
    }
    if (!paymentMethod) {
      setMethodError('Выберите способ оплаты.');
      return;
    }
    if (!tenantId) {
      setFormError('Клиника не выбрана.');
      return;
    }
    if (!patient) {
      setFormError('Пациент не выбран.');
      return;
    }

    const submittedContext = `${tenantId}:${patient.id}`;
    const submittedInput = { amount: parsedAmount, paymentMethod };
    submitGuardRef.current = true;
    try {
      await onSubmit({
        amount: parsedAmount,
        paymentMethod,
        currency: 'KZT',
        receivedAt: trimOptional(receivedAt),
        externalReference: trimOptional(externalReference),
        payerName: trimOptional(payerName),
        notes: trimOptional(notes),
      });
      if (contextRef.current !== submittedContext) return;
      setSuccessInput(submittedInput);
      setFormError(null);
    } catch (error) {
      if (contextRef.current !== submittedContext) return;
      setFormError(safeDialogError(error));
    } finally {
      submitGuardRef.current = false;
    }
  };

  const availableCredit = currencySummary?.availableCreditAmount ?? 0;
  const currentDebt = currencySummary?.currentDebt ?? 0;
  const depositReserve = currencySummary?.reservedDepositAmount ?? 0;
  const refundReserve = currencySummary?.refundReservedAmount ?? 0;
  const displaySuccessInput = successInput ?? (operationResult?.payment
    ? { amount: operationResult.payment.amount, paymentMethod: operationResult.payment.paymentMethod }
    : null);

  return (
    <>
      <button
        type="button"
        data-testid={`${testIdPrefix}-open`}
        onClick={() => {
          setOpen(true);
          setFormError(null);
        }}
        className={triggerClassName ?? 'rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700'}
      >
        {triggerSlot ?? 'Принять предоплату'}
      </button>

      {open && (
        <div
          data-testid={`${testIdPrefix}-overlay`}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-3 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${testIdPrefix}-title`}
            data-testid={`${testIdPrefix}-dialog`}
            onKeyDown={handleDialogKeyDown}
            className="w-full max-w-2xl max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={`${testIdPrefix}-title`} className="text-xl font-semibold text-slate-900">Принять предоплату</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Деньги будут приняты клиникой и сохранены как доступный кредит пациента. Счёт и депозит автоматически не создаются.
                </p>
              </div>
              <button type="button" aria-label="Закрыть" disabled={isBusy} onClick={close} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50">×</button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid={`${testIdPrefix}-finance-facts`}>
              <Fact label="Пациент" value={patient.fullName} />
              <Fact label="Валюта" value="KZT" />
              <Fact label="Доступный кредит" value={formatCashierMoney(availableCredit)} />
              <Fact label="Текущий долг" value={formatCashierMoney(currentDebt)} />
              <Fact label="Резерв депозита" value={formatCashierMoney(depositReserve)} />
              <Fact label="Резерв возврата" value={formatCashierMoney(refundReserve)} />
            </div>

            {isSucceeded && operationResult?.payment && displaySuccessInput ? (
              <div data-testid={`${testIdPrefix}-success`} className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                <p className="font-semibold">Предоплата принята.</p>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Fact label="Сумма" value={formatCashierMoney(displaySuccessInput.amount)} />
                  <Fact label="Способ оплаты" value={cashierPaymentMethodLabels[displaySuccessInput.paymentMethod]} />
                  <Fact label="Новый доступный кредит" value={formatCashierMoney(operationResult.capacity?.availableCreditAmount ?? availableCredit)} />
                  <Fact label="Платёж" value={`#${shortCashierId(operationResult.payment.id)}`} />
                </dl>
                <button type="button" onClick={close} className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white">Закрыть</button>
              </div>
            ) : (
              <form data-testid={`${testIdPrefix}-form`} onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label htmlFor={`${testIdPrefix}-amount`} className="text-sm font-medium text-slate-700">
                    Сумма
                    <input
                      ref={amountInputRef}
                      id={`${testIdPrefix}-amount`}
                      data-testid={`${testIdPrefix}-amount`}
                      inputMode="decimal"
                      value={amount}
                      disabled={isBusy}
                      aria-invalid={Boolean(amountError)}
                      aria-describedby={amountError ? `${testIdPrefix}-amount-error` : undefined}
                      onChange={(event) => setAmount(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-100"
                    />
                    {amountError && <span id={`${testIdPrefix}-amount-error`} data-testid={`${testIdPrefix}-amount-error`} className="mt-1 block text-sm text-rose-600">{amountError}</span>}
                  </label>

                  <label htmlFor={`${testIdPrefix}-method`} className="text-sm font-medium text-slate-700">
                    Способ оплаты
                    <select
                      id={`${testIdPrefix}-method`}
                      data-testid={`${testIdPrefix}-method`}
                      value={paymentMethod}
                      disabled={isBusy}
                      aria-invalid={Boolean(methodError)}
                      aria-describedby={methodError ? `${testIdPrefix}-method-error` : undefined}
                      onChange={(event) => setPaymentMethod(event.target.value as PaymentMethodValue)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-100"
                    >
                      <option value="">Выберите способ оплаты</option>
                      {CASHIER_PAYMENT_METHODS.map((method) => <option key={method} value={method}>{cashierPaymentMethodLabels[method]}</option>)}
                    </select>
                    {methodError && <span id={`${testIdPrefix}-method-error`} data-testid={`${testIdPrefix}-method-error`} className="mt-1 block text-sm text-rose-600">{methodError}</span>}
                  </label>

                  <label htmlFor={`${testIdPrefix}-received-at`} className="text-sm font-medium text-slate-700">Дата и время получения<input id={`${testIdPrefix}-received-at`} data-testid={`${testIdPrefix}-received-at`} type="datetime-local" value={receivedAt} disabled={isBusy} onChange={(event) => setReceivedAt(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-100" /></label>
                  <label htmlFor={`${testIdPrefix}-external-reference`} className="text-sm font-medium text-slate-700">Внешняя ссылка<input id={`${testIdPrefix}-external-reference`} data-testid={`${testIdPrefix}-external-reference`} value={externalReference} disabled={isBusy} onChange={(event) => setExternalReference(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-100" /></label>
                  <label htmlFor={`${testIdPrefix}-payer-name`} className="text-sm font-medium text-slate-700">Плательщик<input id={`${testIdPrefix}-payer-name`} data-testid={`${testIdPrefix}-payer-name`} value={payerName} disabled={isBusy} onChange={(event) => setPayerName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-100" /></label>
                  <label htmlFor={`${testIdPrefix}-notes`} className="text-sm font-medium text-slate-700">Примечание<input id={`${testIdPrefix}-notes`} data-testid={`${testIdPrefix}-notes`} value={notes} disabled={isBusy} onChange={(event) => setNotes(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-100" /></label>
                </div>

                <div data-testid={`${testIdPrefix}-confirmation`} className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                  <p><strong>Пациент:</strong> {patient.fullName}</p>
                  <p><strong>Сумма:</strong> {normalizeAmount(amount) === null ? 'не указана' : formatCashierMoney(normalizeAmount(amount))}</p>
                  <p><strong>Способ оплаты:</strong> {paymentMethod ? cashierPaymentMethodLabels[paymentMethod] : 'не выбран'}</p>
                  <p><strong>Счёт:</strong> Счёт не выбран</p>
                  <p><strong>Результат:</strong> Деньги станут доступным кредитом пациента</p>
                  <p className="mt-2 font-medium">Эта операция фиксирует получение новых денег. Она не использует уже существующий кредит пациента.</p>
                </div>

                {isSubmitting && <p role="status" data-testid={`${testIdPrefix}-submitting`} className="text-sm font-medium text-blue-700">Сохраняем платёж…</p>}
                {isReconciling && <p role="status" data-testid={`${testIdPrefix}-reconciling`} className="text-sm font-medium text-blue-700">Проверяем, был ли платёж сохранён…</p>}
                {isUncertain && <p role="alert" data-testid={`${testIdPrefix}-uncertain`} className="text-sm font-medium text-amber-800">Не удалось подтвердить результат операции. Повторите попытку с теми же данными.</p>}
                {displayedError && <p role="alert" data-testid={`${testIdPrefix}-error`} className="text-sm font-medium text-rose-700">{displayedError}</p>}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" disabled={isBusy} onClick={close} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Отмена</button>
                  <button type="submit" data-testid={`${testIdPrefix}-submit`} disabled={isBusy} aria-disabled={isBusy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                    {isSubmitting ? 'Сохраняем платёж…' : isReconciling ? 'Проверяем платёж…' : 'Принять предоплату'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
