import { useState } from 'react';
import type { Invoice } from '../../data/repositories/FinanceRepository';
import type { FinanceActionName } from '../../data/hooks/useFinanceActions';
import { getFinanceRoleCapabilities, type FinanceUserRole } from './financePermissions';

interface InvoiceActionsProps {
  invoice: Invoice;
  role: FinanceUserRole;
  actionLoading: FinanceActionName | null;
  onIssue: (invoiceId: string) => Promise<void>;
  onVoid: (invoiceId: string, reason: string) => Promise<void>;
}

export function InvoiceActions({ invoice, role, actionLoading, onIssue, onVoid }: InvoiceActionsProps) {
  const capabilities = getFinanceRoleCapabilities(role);
  const [isVoidOpen, setIsVoidOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isBusy = actionLoading !== null;
  const canIssue = capabilities.canIssueInvoice && invoice.status === 'draft';
  const canVoid = capabilities.canVoid && !['voided', 'archived', 'paid'].includes(invoice.status);
  const buttonClass = 'rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';

  if (!canIssue && !canVoid) return null;

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {canIssue && (
          <button type="button" data-testid={`finance-issue-invoice-${invoice.id}`} disabled={isBusy} onClick={() => { void onIssue(invoice.id); }} className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}>
            {actionLoading === 'issueInvoice' ? 'Выставляем...' : 'Выставить счёт'}
          </button>
        )}
        {canVoid && (
          <button type="button" data-testid={`finance-void-invoice-${invoice.id}`} disabled={isBusy} onClick={() => setIsVoidOpen((value) => !value)} className={`${buttonClass} bg-rose-600 text-white hover:bg-rose-700`}>
            Аннулировать счёт
          </button>
        )}
      </div>

      {isVoidOpen && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-3">
          <label className="mb-2 block text-xs font-semibold text-rose-800" htmlFor={`finance-invoice-reason-${invoice.id}`}>Причина аннулирования</label>
          <textarea id={`finance-invoice-reason-${invoice.id}`} data-testid={`finance-void-invoice-reason-${invoice.id}`} value={reason} onChange={(event) => { setReason(event.target.value); setError(null); }} className="min-h-20 w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700" />
          {error && <p data-testid={`finance-void-invoice-error-${invoice.id}`} className="mt-2 text-sm font-medium text-rose-700">{error}</p>}
          <button type="button" data-testid={`finance-void-invoice-confirm-${invoice.id}`} disabled={isBusy || !reason.trim()} onClick={async () => {
            if (!reason.trim()) { setError('Причина обязательна.'); return; }
            await onVoid(invoice.id, reason);
            setReason('');
            setIsVoidOpen(false);
          }} className={`${buttonClass} mt-2 bg-rose-600 text-white hover:bg-rose-700`}>
            {actionLoading === 'voidInvoice' ? 'Аннулируем...' : 'Подтвердить аннулирование'}
          </button>
        </div>
      )}
    </div>
  );
}
