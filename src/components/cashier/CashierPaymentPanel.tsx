import { useMemo, useState } from 'react';
import type { FinanceRepository } from '../../data/repositories/FinanceRepository';
import type { FinanceRpcClient } from '../../data/repositories/FinanceRpcClient';
import type { PatientRepository } from '../../data/repositories/PatientRepository';
import type { Patient } from '../../types';
import { useCashierPatientSearch } from '../../data/hooks/useCashierPatientSearch';
import { useCashierPaymentFlow } from '../../data/hooks/useCashierPaymentFlow';
import { useFinanceActions } from '../../data/hooks/useFinanceActions';
import { AcceptPatientPrepaymentDialog } from './AcceptPatientPrepaymentDialog';
import { CashierAllocationPreview } from './CashierAllocationPreview';
import { CashierOpenInvoiceList } from './CashierOpenInvoiceList';
import { CashierPatientFinanceSummary } from './CashierPatientFinanceSummary';
import { CashierPatientSearch } from './CashierPatientSearch';
import { CashierPaymentForm } from './CashierPaymentForm';
import { CashierPaymentResult } from './CashierPaymentResult';
import { getCashierRoleCapabilities, type CashierUserRole } from './cashierPermissions';

interface Props {
  tenantId?: string | null;
  role?: CashierUserRole;
  patientRepository?: PatientRepository;
  financeRepository?: FinanceRepository;
  rpcClient?: FinanceRpcClient;
}

export function CashierPaymentPanel({ tenantId, role, patientRepository, financeRepository, rpcClient }: Props) {
  const capabilities = useMemo(() => getCashierRoleCapabilities(role), [role]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [previewAmount, setPreviewAmount] = useState(0);
  const search = useCashierPatientSearch({ tenantId, repository: patientRepository });
  const flow = useCashierPaymentFlow({
    tenantId,
    patientId: selectedPatient?.id,
    repository: financeRepository,
    rpcClient,
    enabled: Boolean(capabilities.canAccessCashier && selectedPatient),
  });
  const prepaymentActions = useFinanceActions({
    tenantId,
    patientId: selectedPatient?.id,
    refresh: flow.refresh,
    rpcClient,
  });

  if (!tenantId) {
    return <section data-testid="cashier-no-tenant" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Не выбрана клиника.</section>;
  }

  if (!capabilities.canAccessCashier) {
    return <section data-testid="cashier-no-access" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Недостаточно прав для кассовой операции.</section>;
  }

  const writeInFlight = flow.operationStatus === 'submitting' || flow.operationStatus === 'reconciling';
  const patientFinanceLoading = flow.operationStatus === 'loading_patient_finance';
  const financeReady = Boolean(selectedPatient && !patientFinanceLoading);
  const prepaymentVisible = Boolean(selectedPatient && (financeReady || prepaymentActions.patientCreditOperationStatus !== 'idle'));

  const selectPatient = (patient: Patient) => {
    if (writeInFlight) return;
    flow.resetForPatient(patient.id);
    setPreviewAmount(0);
    setSelectedPatient(patient);
  };

  return (
    <section data-testid="cashier-payment-panel" className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Касса</h1>
        <p className="mt-1 text-sm text-slate-500">Приём оплаты и распределение по явно выбранным счетам пациента.</p>
      </div>

      <CashierPatientSearch
        query={search.query}
        patients={search.patients}
        loading={search.loading}
        error={search.error}
        selectedPatient={selectedPatient}
        disabled={writeInFlight}
        onSearch={search.search}
        onSelect={selectPatient}
      />

      {selectedPatient && (
        <div key={`${tenantId}:${selectedPatient.id}`} data-testid="cashier-patient-finance-workspace" className="space-y-6">
          {patientFinanceLoading && (
            <div data-testid="cashier-loading" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              Загружаем финансовые данные выбранного пациента...
            </div>
          )}

          {flow.operationStatus === 'reconciling' && (
            <div data-testid="cashier-reconciling" className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-800">
              Проверяем результат предыдущей операции…
            </div>
          )}

          {flow.operationStatus === 'uncertain' && (
            <div data-testid="cashier-uncertain" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
              Статус операции пока не подтверждён. Не вводите оплату повторно до проверки.
            </div>
          )}

          {flow.isError && flow.error && (
            <div data-testid="cashier-error" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
              {flow.error.message}
            </div>
          )}

          {flow.refreshWarning && (
            <div data-testid="cashier-refresh-warning" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {flow.refreshWarning}
            </div>
          )}

          {prepaymentVisible && (
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Предоплата без счёта</h2>
                <p className="mt-1 text-sm text-slate-500">Новые деньги поступят в доступный кредит пациента и не будут распределены автоматически.</p>
              </div>
              <AcceptPatientPrepaymentDialog
                tenantId={tenantId}
                patient={selectedPatient}
                role={role}
                summary={flow.summary}
                operationStatus={prepaymentActions.patientCreditOperationStatus}
                operationResult={prepaymentActions.patientCreditOperationResult}
                operationError={prepaymentActions.actionError}
                onSubmit={prepaymentActions.recordPayment}
                onResetOperation={prepaymentActions.resetPatientCreditOperation}
                testIdPrefix="cashier-prepayment"
              />
            </div>
          )}

          {financeReady && (
            <>
              <CashierPatientFinanceSummary patient={selectedPatient} summary={flow.summary} />
              <CashierOpenInvoiceList
                invoices={flow.openInvoices}
                invoiceItems={flow.invoiceItems}
                selectedInvoiceIds={flow.selectedInvoiceIds}
                onSelectInvoice={flow.selectInvoice}
              />
              <CashierAllocationPreview selectedInvoices={flow.selectedInvoices} amount={previewAmount} />
              <CashierPaymentForm
                disabled={flow.selectedInvoiceIds.length === 0}
                loading={flow.actionLoading}
                operationStatus={flow.operationStatus}
                onSubmit={async (input) => {
                  setPreviewAmount(input.amount);
                  const result = await flow.recordAndAllocatePayment(input);
                  setPreviewAmount(0);
                  return result;
                }}
                onRetry={flow.retryOperation}
                onReconcile={flow.reconcileOperation}
              />
              <CashierPaymentResult patient={selectedPatient} result={flow.result} />
              <div data-testid="cashier-boundary-note" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                Оплата не означает завершение лечения. Распределение платежа не изменяет клинические данные пациента.
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
