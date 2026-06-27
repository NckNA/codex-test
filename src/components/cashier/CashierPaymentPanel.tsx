import { useMemo, useState } from 'react';
import type { FinanceRepository } from '../../data/repositories/FinanceRepository';
import type { FinanceRpcClient } from '../../data/repositories/FinanceRpcClient';
import type { PatientRepository } from '../../data/repositories/PatientRepository';
import type { Patient } from '../../types';
import { useCashierPatientSearch } from '../../data/hooks/useCashierPatientSearch';
import { useCashierPaymentFlow } from '../../data/hooks/useCashierPaymentFlow';
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

function safeMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Не удалось загрузить данные кассы.';
}

export function CashierPaymentPanel({ tenantId, role, patientRepository, financeRepository, rpcClient }: Props) {
  const capabilities = useMemo(() => getCashierRoleCapabilities(role), [role]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [previewAmount, setPreviewAmount] = useState(0);
  const search = useCashierPatientSearch({ tenantId, repository: patientRepository });
  const flow = useCashierPaymentFlow({ tenantId, patientId: selectedPatient?.id, repository: financeRepository, rpcClient, enabled: Boolean(capabilities.canAccessCashier && selectedPatient) });

  if (!tenantId) {
    return <section data-testid="cashier-no-tenant" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Не выбрана клиника.</section>;
  }

  if (!capabilities.canAccessCashier) {
    return <section data-testid="cashier-no-access" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Недостаточно прав для кассовых операций.</section>;
  }

  return (
    <section data-testid="cashier-payment-panel" className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Касса</h1>
        <p className="mt-1 text-sm text-slate-500">Рабочее место кассира для приёма оплаты и распределения по счетам пациента.</p>
      </div>

      <CashierPatientSearch
        query={search.query}
        patients={search.patients}
        loading={search.loading}
        error={search.error}
        selectedPatient={selectedPatient}
        onSearch={search.search}
        onSelect={(patient) => { setSelectedPatient(patient); flow.clearSelection(); }}
      />

      {selectedPatient && (
        <>
          {flow.loading && <div data-testid="cashier-loading" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Загружаем данные кассы...</div>}
          {flow.isError && <div data-testid="cashier-error" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{safeMessage(flow.error)}</div>}
          <CashierPatientFinanceSummary patient={selectedPatient} summary={flow.summary} />
          <CashierOpenInvoiceList invoices={flow.openInvoices} invoiceItems={flow.invoiceItems} selectedInvoiceIds={flow.selectedInvoiceIds} onSelectInvoice={flow.selectInvoice} />
          <CashierAllocationPreview selectedInvoices={flow.selectedInvoices} amount={previewAmount} />
          <CashierPaymentForm
            disabled={flow.selectedInvoiceIds.length === 0}
            loading={flow.actionLoading}
            onSubmit={async (input) => { setPreviewAmount(input.amount); await flow.recordAndAllocatePayment(input); }}
          />
          <CashierPaymentResult patient={selectedPatient} result={flow.result} />
          <div data-testid="cashier-boundary-note" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">Оплата не завершает лечение, не создаёт документы, не меняет склад и не обновляет записи приёмов.</div>
        </>
      )}
    </section>
  );
}
