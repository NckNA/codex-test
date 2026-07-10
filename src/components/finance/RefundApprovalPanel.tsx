import { useState } from 'react';
import type { Refund } from '../../data/repositories/FinanceRepository';
import type { RefundCapabilities } from './financeAdjustmentPermissions';
import { formatFinanceMoney, shortFinanceId } from './financeLabels';

interface RefundApprovalPanelProps {
  refund: Refund;
  capabilities: RefundCapabilities;
  loading: boolean;
  onApprove: (refundId: string) => Promise<unknown>;
  onComplete: (refundId: string, externalReference?: string | null) => Promise<unknown>;
  onReject: (refundId: string, reason: string) => Promise<unknown>;
  onVoid: (refundId: string, reason: string) => Promise<unknown>;
}

type Mode = 'approve' | 'complete' | 'reject' | 'void' | null;

export function RefundApprovalPanel({ refund, capabilities, loading, onApprove, onComplete, onReject, onVoid }: RefundApprovalPanelProps) {
  const [mode, setMode] = useState<Mode>(null);
  const [reason, setReason] = useState('');
  const [externalReference, setExternalReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = () => { setMode(null); setReason(''); setExternalReference(''); setError(null); };
  const submit = async () => {
    setError(null);
    if ((mode === 'reject' || mode === 'void') && !reason.trim()) { setError('Укажите причину.'); return; }
    if (mode === 'approve') await onApprove(refund.id);
    if (mode === 'complete') await onComplete(refund.id, externalReference.trim() || null);
    if (mode === 'reject') await onReject(refund.id, reason.trim());
    if (mode === 'void') await onVoid(refund.id, reason.trim());
    close();
  };

  const canPendingAdmin = refund.status === 'pending' && (capabilities.canApprove || capabilities.canReject || capabilities.canVoid);
  const canComplete = refund.status === 'approved' && capabilities.canComplete;
  const canVoidApproved = refund.status === 'approved' && capabilities.canVoid;
  if (!canPendingAdmin && !canComplete && !canVoidApproved) return null;

  return (
    <div data-testid={`refund-actions-${refund.id}`} className="mt-3 border-t border-slate-100 pt-3">
      <div className="flex flex-wrap gap-2">
        {refund.status === 'pending' && capabilities.canApprove && <button data-testid={`refund-approve-${refund.id}`} onClick={() => setMode('approve')} disabled={loading} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Одобрить</button>}
        {refund.status === 'pending' && capabilities.canReject && <button data-testid={`refund-reject-${refund.id}`} onClick={() => setMode('reject')} disabled={loading} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">Отклонить</button>}
        {(refund.status === 'pending' || refund.status === 'approved') && capabilities.canVoid && <button data-testid={`refund-void-${refund.id}`} onClick={() => setMode('void')} disabled={loading} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Отменить</button>}
        {refund.status === 'approved' && capabilities.canComplete && <button data-testid={`refund-complete-${refund.id}`} onClick={() => setMode('complete')} disabled={loading} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Завершить возврат</button>}
      </div>
      {mode && (
        <div data-testid={`refund-confirm-${mode}`} className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-slate-700">
          {mode === 'approve' && <p>Одобрить возврат {formatFinanceMoney(refund.amount, refund.currency)} по платежу #{shortFinanceId(refund.paymentId)}? Деньги ещё не будут отмечены как возвращённые.</p>}
          {mode === 'complete' && <p className="font-medium">Подтвердите, что деньги фактически возвращены пациенту.</p>}
          {mode === 'void' && <p>Отменить действующую заявку на возврат?</p>}
          {mode === 'reject' && <p>Отклонить заявку на возврат?</p>}
          {(mode === 'reject' || mode === 'void') && <textarea data-testid="refund-transition-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} placeholder="Причина" className="mt-2 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2" />}
          {mode === 'complete' && <input data-testid="refund-complete-reference" value={externalReference} onChange={(event) => setExternalReference(event.target.value)} placeholder="Номер операции или reference, необязательно" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2" />}
          {error && <p className="mt-2 font-medium text-rose-600">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button data-testid="refund-transition-confirm" onClick={() => void submit()} disabled={loading} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Подтвердить</button>
            <button onClick={close} disabled={loading} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
}
