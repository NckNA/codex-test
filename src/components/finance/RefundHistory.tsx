import type { Refund } from '../../data/repositories/FinanceRepository';
import { refundMethodLabels, refundStatusLabels } from './financeAdjustmentLabels';
import { formatFinanceDateTime, formatFinanceMoney, shortFinanceId } from './financeLabels';

interface RefundHistoryProps {
  refunds: Refund[];
  children?: (refund: Refund) => React.ReactNode;
}

export function RefundHistory({ refunds, children }: RefundHistoryProps) {
  return (
    <div data-testid="refund-history" className="mt-4 space-y-3">
      <h5 className="text-sm font-semibold text-slate-800">История возвратов</h5>
      {refunds.length === 0 && <p className="text-sm text-slate-500">Возвратов пока нет.</p>}
      {refunds.map((refund) => (
        <article key={refund.id} data-testid={`refund-history-${refund.id}`} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{refundStatusLabels[refund.status]}</span>
              <span className="text-xs text-slate-400">#{shortFinanceId(refund.id)}</span>
            </div>
            <span className="text-sm font-semibold text-slate-900">{formatFinanceMoney(refund.amount, refund.currency)}</span>
          </div>
          <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            <div><dt className="text-xs uppercase text-slate-400">Способ</dt><dd>{refundMethodLabels[refund.refundMethod]}</dd></div>
            <div><dt className="text-xs uppercase text-slate-400">Причина</dt><dd>{refund.reason || '—'}</dd></div>
            <div><dt className="text-xs uppercase text-slate-400">Запрошен</dt><dd>{formatFinanceDateTime(refund.requestedAt)}</dd></div>
            <div><dt className="text-xs uppercase text-slate-400">Одобрен</dt><dd>{formatFinanceDateTime(refund.approvedAt)}</dd></div>
            <div><dt className="text-xs uppercase text-slate-400">Завершён</dt><dd>{formatFinanceDateTime(refund.completedAt)}</dd></div>
            <div><dt className="text-xs uppercase text-slate-400">Отклонён</dt><dd>{formatFinanceDateTime(refund.rejectedAt)}</dd></div>
            <div><dt className="text-xs uppercase text-slate-400">Отменён</dt><dd>{formatFinanceDateTime(refund.voidedAt)}</dd></div>
            <div><dt className="text-xs uppercase text-slate-400">Внешняя ссылка</dt><dd>{refund.externalReference || '—'}</dd></div>
            {refund.voidReason && <div className="md:col-span-2"><dt className="text-xs uppercase text-slate-400">Причина отмены</dt><dd>{refund.voidReason}</dd></div>}
          </dl>
          {children?.(refund)}
        </article>
      ))}
    </div>
  );
}
