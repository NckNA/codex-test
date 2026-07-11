import { useMemo, useState, type FormEvent } from 'react';
import type { FinanceRepository } from '../../data/repositories/FinanceRepository';
import type { FinanceRpcClient } from '../../data/repositories/FinanceRpcClient';
import { useFinanceActions } from '../../data/hooks/useFinanceActions';
import { usePatientFinance } from '../../data/hooks/usePatientFinance';
import { AllocationActions } from './AllocationActions';
import { InvoiceDetail } from './InvoiceDetail';
import { InvoiceList } from './InvoiceList';
import { PatientFinanceSummaryCard } from './PatientFinanceSummaryCard';
import { PatientFundReservationsPanel } from './PatientFundReservationsPanel';
import { PaymentList } from './PaymentList';
import { getFinanceRoleCapabilities, type FinanceUserRole } from './financePermissions';

interface PatientFinancePanelProps {
  tenantId?: string | null;
  patientId?: string | null;
  role?: FinanceUserRole;
  repository?: FinanceRepository;
  rpcClient?: FinanceRpcClient;
}

function safeFinanceMessage(error: unknown) {
  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    if (lower.includes('permission') || lower.includes('denied') || lower.includes('insufficient')) return 'Недостаточно прав для финансовой операции.';
    if (lower.includes('tenant') || lower.includes('clinic')) return 'Не выбрана клиника.';
  }
  return 'Не удалось загрузить финансовые данные.';
}

export function PatientFinancePanel({ tenantId, patientId, role, repository, rpcClient }: PatientFinancePanelProps) {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const capabilities = useMemo(() => getFinanceRoleCapabilities(role), [role]);

  const finance = usePatientFinance({
    tenantId,
    patientId,
    repository,
    enabled: capabilities.canView,
    includeCompletedServiceBillingEligibility: capabilities.canAddInvoiceItem,
  });
  const actions = useFinanceActions({ tenantId, patientId, refresh: finance.refresh, rpcClient });

  const selectedInvoice = useMemo(() => {
    const explicit = selectedInvoiceId ? finance.invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null : null;
    return explicit ?? finance.invoices[0] ?? null;
  }, [finance.invoices, selectedInvoiceId]);

  const handleCreateInvoice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(null);
    try {
      await actions.createInvoice({ dueDate: invoiceDueDate || null, notes: invoiceNotes || null, currency: 'KZT' });
      setInvoiceNotes('');
      setInvoiceDueDate('');
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Не удалось выполнить финансовую операцию.');
    }
  };

  if (!tenantId) {
    return <section data-testid="patient-finance-no-tenant" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Не выбрана клиника.</section>;
  }

  if (!patientId) {
    return <section data-testid="patient-finance-no-patient" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Пациент не выбран.</section>;
  }

  if (!capabilities.canView) {
    return <section data-testid="patient-finance-no-access" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Недостаточно прав для просмотра финансов пациента.</section>;
  }

  return (
    <section data-testid="patient-finance-panel" className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Финансы</h2>
            <p className="mt-1 text-sm text-slate-500">Счета, оплаты и распределения по одному пациенту.</p>
          </div>
        </div>

        {capabilities.canCreateInvoice && (
          <form data-testid="finance-create-invoice-form" onSubmit={handleCreateInvoice} className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-800">Создать черновик счёта</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">Срок оплаты<input data-testid="finance-invoice-due-date" type="datetime-local" value={invoiceDueDate} onChange={(event) => setInvoiceDueDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
              <label className="text-sm font-medium text-slate-700">Примечание<input data-testid="finance-invoice-notes" value={invoiceNotes} onChange={(event) => setInvoiceNotes(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            </div>
            {(createError || actions.actionError) && <p data-testid="finance-create-invoice-error" className="mt-3 text-sm font-medium text-rose-600">{createError || actions.actionError?.message}</p>}
            <button type="submit" data-testid="finance-create-invoice-submit" disabled={actions.actionLoading !== null} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{actions.actionLoading === 'createInvoice' ? 'Создаём...' : 'Создать черновик'}</button>
          </form>
        )}
      </div>

      {finance.isLoading && <div data-testid="patient-finance-loading" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Загружаем финансы...</div>}
      {finance.isError && <div data-testid="patient-finance-error" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{safeFinanceMessage(finance.error)}</div>}

      {!finance.isLoading && !finance.isError && finance.invoices.length === 0 && finance.payments.length === 0 && finance.paymentAllocations.length === 0 && (
        <div data-testid="patient-finance-empty" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Финансовых операций пока нет.</div>
      )}

      {!finance.isError && (
        <>
          <PatientFinanceSummaryCard summary={finance.summary} />
          <PatientFundReservationsPanel
            tenantId={tenantId}
            patientId={patientId}
            role={role}
            summary={finance.summary}
            payments={finance.payments}
            invoices={finance.invoices}
            repository={repository}
            rpcClient={rpcClient}
            onChanged={finance.refresh}
          />
          <div className="grid gap-6 xl:grid-cols-2">
            <InvoiceList invoices={finance.invoices} selectedInvoiceId={selectedInvoice?.id ?? null} role={role} actionLoading={actions.actionLoading} onSelectInvoice={setSelectedInvoiceId} onIssueInvoice={actions.issueInvoice} onVoidInvoice={actions.voidInvoice} />
            <InvoiceDetail tenantId={tenantId} invoice={selectedInvoice} items={finance.invoiceItems} completedServiceBillingEligibility={finance.completedServiceBillingEligibility} role={role} repository={repository} rpcClient={rpcClient} canAddItem={capabilities.canAddInvoiceItem} actionLoading={actions.actionLoading} onChanged={finance.refresh} onAddItem={actions.addInvoiceItem} />
          </div>
          <PaymentList tenantId={tenantId} payments={finance.payments} role={role} repository={repository} rpcClient={rpcClient} actionLoading={actions.actionLoading} onRecordPayment={actions.recordPayment} onVoidPayment={actions.voidPayment} onChanged={finance.refresh} />
          <AllocationActions invoices={finance.invoices} invoiceItems={finance.invoiceItems} payments={finance.payments} allocations={finance.paymentAllocations} role={role} actionLoading={actions.actionLoading} onAllocatePayment={actions.allocatePayment} onVoidAllocation={actions.voidPaymentAllocation} />
        </>
      )}
    </section>
  );
}
