import { useState } from 'react';
import type { FinanceRepository } from '../../data/repositories/FinanceRepository';
import type { FinanceRpcClient } from '../../data/repositories/FinanceRpcClient';
import { usePaymentRefundFlow } from '../../data/hooks/usePaymentRefundFlow';
import type { FinanceUserRole } from './financePermissions';
import { safeRefundUnavailableReason } from './financeAdjustmentLabels';
import { formatFinanceMoney } from './financeLabels';
import { RefundApprovalPanel } from './RefundApprovalPanel';
import { RefundHistory } from './RefundHistory';
import { RefundRequestDialog } from './RefundRequestDialog';

interface RefundActionsProps {
  tenantId?: string | null;
  paymentId: string;
  role?: FinanceUserRole;
  repository?: FinanceRepository;
  rpcClient?: FinanceRpcClient;
  onChanged?: () => Promise<void> | void;
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 text-sm font-medium text-slate-800">{value}</dd></div>;
}

export function RefundActions({ tenantId, paymentId, role, repository, rpcClient, onChanged }: RefundActionsProps) {
  const [requestOpen, setRequestOpen] = useState(false);
  const flow = usePaymentRefundFlow({ tenantId, paymentId, role, repository, rpcClient, onChanged });

  if (!tenantId) return <div data-testid="refund-no-tenant" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Не выбрана клиника.</div>;
  if (!paymentId) return null;
  if (!flow.capabilities.canView) return null;

  return (
    <section data-testid={`refund-actions-panel-${paymentId}`} className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Возврат платежа</h4>
          <p className="mt-1 text-xs text-slate-500">Возврат означает фактическую передачу денег пациенту и не отменяет распределение автоматически.</p>
        </div>
        {flow.refundability && flow.capabilities.canRequest && flow.refundability.refundableAmount > 0 && !flow.refundability.hasActiveAllocations && (
          <button data-testid={`refund-request-open-${paymentId}`} onClick={() => setRequestOpen(true)} disabled={flow.actionLoading} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Создать заявку</button>
        )}
      </div>

      {flow.loading && <p data-testid="refund-loading" className="mt-3 text-sm text-slate-500">Загружаем данные возврата...</p>}
      {flow.error && <p data-testid="refund-error" className="mt-3 text-sm font-medium text-rose-600">Не удалось загрузить данные возврата.</p>}

      {flow.refundability && (
        <>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryField label="Сумма платежа" value={formatFinanceMoney(flow.refundability.paymentAmount, flow.refundability.currency)} />
            <SummaryField label="Распределено" value={formatFinanceMoney(flow.refundability.activeAllocatedAmount, flow.refundability.currency)} />
            <SummaryField label="Уже возвращено" value={formatFinanceMoney(flow.refundability.completedRefundAmount, flow.refundability.currency)} />
            <SummaryField label="Зарезервировано под возврат" value={formatFinanceMoney(flow.refundability.reservedRefundAmount, flow.refundability.currency)} />
            <SummaryField label="Доступно к возврату" value={formatFinanceMoney(flow.refundability.refundableAmount, flow.refundability.currency)} />
          </dl>
          {(flow.refundability.refundableAmount <= 0 || flow.refundability.hasActiveAllocations) && (
            <p data-testid="refund-unavailable-reason" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{safeRefundUnavailableReason(flow.refundability)}</p>
          )}
        </>
      )}

      {flow.actionMessage && <p data-testid="refund-action-message" className={`mt-3 text-sm font-medium ${flow.actionState === 'failed' ? 'text-rose-600' : 'text-emerald-700'}`}>{flow.actionMessage}</p>}

      <RefundHistory refunds={flow.refunds}>
        {(refund) => <RefundApprovalPanel refund={refund} capabilities={flow.capabilities} loading={flow.actionLoading} onApprove={flow.approveRefund} onComplete={flow.completeRefund} onReject={flow.rejectRefund} onVoid={flow.voidRefund} />}
      </RefundHistory>

      <RefundRequestDialog
        open={requestOpen}
        maxAmount={flow.refundability?.refundableAmount ?? 0}
        currency={flow.refundability?.currency ?? 'KZT'}
        loading={flow.actionLoading}
        onCancel={() => setRequestOpen(false)}
        onSubmit={async (values) => Boolean(await flow.requestRefund(values))}
      />
    </section>
  );
}
