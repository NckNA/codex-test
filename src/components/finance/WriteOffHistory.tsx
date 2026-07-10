import type { FinancialAdjustment } from '../../data/repositories/FinanceRepository';
import { writeOffStatusLabels } from './financeAdjustmentLabels';
import { formatFinanceDateTime, formatFinanceMoney, shortFinanceId } from './financeLabels';

interface WriteOffHistoryProps {
  writeOffs: FinancialAdjustment[];
  children?: (writeOff: FinancialAdjustment) => React.ReactNode;
}

export function WriteOffHistory({ writeOffs, children }: WriteOffHistoryProps) {
  return (
    <div data-testid="writeoff-history" className="mt-4 space-y-3">
      <h5 className="text-sm font-semibold text-slate-800">История списаний</h5>
      {writeOffs.length === 0 && <p className="text-sm text-slate-500">Списаний пока нет.</p>}
      {writeOffs.map((writeOff) => (
        <article key={writeOff.id} data-testid={`writeoff-history-${writeOff.id}`} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{writeOffStatusLabels[writeOff.status]}</span>
              <span className="text-xs text-slate-400">#{shortFinanceId(writeOff.id)}</span>
            </div>
            <span className="text-sm font-semibold text-slate-900">{formatFinanceMoney(writeOff.amount, writeOff.currency)}</span>
          </div>
          <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            <div><dt className="text-xs uppercase text-slate-400">Причина</dt><dd>{writeOff.reason || '—'}</dd></div>
            <div><dt className="text-xs uppercase text-slate-400">Счёт</dt><dd>#{shortFinanceId(writeOff.invoiceId)}</dd></div>
            <div><dt className="text-xs uppercase text-slate-400">Создано</dt><dd>{formatFinanceDateTime(writeOff.createdAt)}</dd></div>
            <div><dt className="text-xs uppercase text-slate-400">Одобрено</dt><dd>{formatFinanceDateTime(writeOff.approvedAt)}</dd></div>
            <div><dt className="text-xs uppercase text-slate-400">Отменено</dt><dd>{formatFinanceDateTime(writeOff.voidedAt)}</dd></div>
            {writeOff.voidReason && <div className="md:col-span-2"><dt className="text-xs uppercase text-slate-400">Причина отмены</dt><dd>{writeOff.voidReason}</dd></div>}
          </dl>
          {children?.(writeOff)}
        </article>
      ))}
    </div>
  );
}
