import { useState } from 'react';
import type { FinanceRepository } from '../../data/repositories/FinanceRepository';
import type { FinanceRpcClient } from '../../data/repositories/FinanceRpcClient';
import { useInvoiceWriteOffFlow } from '../../data/hooks/useInvoiceWriteOffFlow';
import type { FinanceUserRole } from './financePermissions';
import { safeWriteOffUnavailableReason } from './financeAdjustmentLabels';
import { formatFinanceMoney } from './financeLabels';
import { WriteOffApprovalPanel } from './WriteOffApprovalPanel';
import { WriteOffHistory } from './WriteOffHistory';
import { WriteOffRequestDialog } from './WriteOffRequestDialog';

interface WriteOffActionsProps {
  tenantId?: string | null;
  invoiceId: string;
  role?: FinanceUserRole;
  repository?: FinanceRepository;
  rpcClient?: FinanceRpcClient;
  onChanged?: () => Promise<void> | void;
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 text-sm font-medium text-slate-800">{value}</dd></div>;
}

export function WriteOffActions({ tenantId, invoiceId, role, repository, rpcClient, onChanged }: WriteOffActionsProps) {
  const [requestOpen, setRequestOpen] = useState(false);
  const flow = useInvoiceWriteOffFlow({ tenantId, invoiceId, role, repository, rpcClient, onChanged });

  if (!tenantId) return <div data-testid="writeoff-no-tenant" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Не выбрана клиника.</div>;
  if (!invoiceId || !flow.capabilities.canView) return null;

  return (
    <section data-testid={`writeoff-actions-panel-${invoiceId}`} className="mt-5 rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Списание задолженности</h4>
          <p className="mt-1 text-xs text-slate-500">Списание прощает долг клиникой. Оно не является оплатой и не увеличивает оплаченную сумму.</p>
        </div>
        {flow.eligibility?.eligible && flow.capabilities.canRequest && (
          <button data-testid={`writeoff-request-open-${invoiceId}`} onClick={() => setRequestOpen(true)} disabled={flow.actionLoading} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Создать заявку</button>
        )}
      </div>

      {flow.loading && <p data-testid="writeoff-loading" className="mt-3 text-sm text-slate-500">Загружаем данные списания...</p>}
      {flow.error && <p data-testid="writeoff-error" className="mt-3 text-sm font-medium text-rose-600">Не удалось загрузить данные списания.</p>}

      {flow.eligibility && (
        <>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryField label="Сумма счёта" value={formatFinanceMoney(flow.eligibility.invoiceTotalAmount, flow.eligibility.currency)} />
            <SummaryField label="Оплачено" value={formatFinanceMoney(flow.eligibility.paidAmount, flow.eligibility.currency)} />
            <SummaryField label="Уже списано" value={formatFinanceMoney(flow.eligibility.approvedWriteOffAmount, flow.eligibility.currency)} />
            <SummaryField label="Зарезервировано под списание" value={formatFinanceMoney(flow.eligibility.reservedWriteOffAmount, flow.eligibility.currency)} />
            <SummaryField label="Доступно к списанию" value={formatFinanceMoney(flow.eligibility.availableWriteOffAmount, flow.eligibility.currency)} />
          </dl>
          {!flow.eligibility.eligible && <p data-testid="writeoff-unavailable-reason" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{safeWriteOffUnavailableReason(flow.eligibility.ineligibilityReason)}</p>}
        </>
      )}

      {flow.actionMessage && <p data-testid="writeoff-action-message" className={`mt-3 text-sm font-medium ${flow.actionState === 'failed' ? 'text-rose-600' : 'text-emerald-700'}`}>{flow.actionMessage}</p>}

      <WriteOffHistory writeOffs={flow.writeOffs}>
        {(writeOff) => <WriteOffApprovalPanel writeOff={writeOff} capabilities={flow.capabilities} loading={flow.actionLoading} onApprove={flow.approveWriteOff} onReject={flow.rejectWriteOff} onVoid={flow.voidWriteOff} />}
      </WriteOffHistory>

      <WriteOffRequestDialog
        open={requestOpen}
        maxAmount={flow.eligibility?.availableWriteOffAmount ?? 0}
        currency={flow.eligibility?.currency ?? 'KZT'}
        loading={flow.actionLoading}
        onCancel={() => setRequestOpen(false)}
        onSubmit={async (values) => Boolean(await flow.requestWriteOff(values))}
      />
    </section>
  );
}
