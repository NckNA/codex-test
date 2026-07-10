import { useState } from 'react';
import type { FinancialAdjustment } from '../../data/repositories/FinanceRepository';
import type { WriteOffCapabilities } from './financeAdjustmentPermissions';
import { formatFinanceMoney, shortFinanceId } from './financeLabels';

interface WriteOffApprovalPanelProps {
  writeOff: FinancialAdjustment;
  capabilities: WriteOffCapabilities;
  loading: boolean;
  onApprove: (adjustmentId: string) => Promise<unknown>;
  onReject: (adjustmentId: string, reason: string) => Promise<unknown>;
  onVoid: (adjustmentId: string, reason: string) => Promise<unknown>;
}

type Mode = 'approve' | 'reject' | 'void' | null;

export function WriteOffApprovalPanel({ writeOff, capabilities, loading, onApprove, onReject, onVoid }: WriteOffApprovalPanelProps) {
  const [mode, setMode] = useState<Mode>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = () => { setMode(null); setReason(''); setError(null); };
  const submit = async () => {
    setError(null);
    if ((mode === 'reject' || mode === 'void') && !reason.trim()) { setError('Укажите причину.'); return; }
    if (mode === 'approve') await onApprove(writeOff.id);
    if (mode === 'reject') await onReject(writeOff.id, reason.trim());
    if (mode === 'void') await onVoid(writeOff.id, reason.trim());
    close();
  };

  const isPending = writeOff.status === 'active';
  const canVoidApproved = writeOff.status === 'approved' && capabilities.canVoid;
  if ((!isPending || (!capabilities.canApprove && !capabilities.canReject && !capabilities.canVoid)) && !canVoidApproved) return null;

  return (
    <div data-testid={`writeoff-actions-${writeOff.id}`} className="mt-3 border-t border-slate-100 pt-3">
      <div className="flex flex-wrap gap-2">
        {isPending && capabilities.canApprove && <button data-testid={`writeoff-approve-${writeOff.id}`} onClick={() => setMode('approve')} disabled={loading} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Одобрить</button>}
        {isPending && capabilities.canReject && <button data-testid={`writeoff-reject-${writeOff.id}`} onClick={() => setMode('reject')} disabled={loading} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">Отклонить</button>}
        {(isPending || writeOff.status === 'approved') && capabilities.canVoid && <button data-testid={`writeoff-void-${writeOff.id}`} onClick={() => setMode('void')} disabled={loading} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Отменить</button>}
      </div>
      {mode && (
        <div data-testid={`writeoff-confirm-${mode}`} className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-slate-700">
          {mode === 'approve' && <p>Одобрить списание {formatFinanceMoney(writeOff.amount, writeOff.currency)} по счёту #{shortFinanceId(writeOff.invoiceId)}? Оплаченная сумма не изменится.</p>}
          {mode === 'reject' && <p>Отклонить заявку на списание?</p>}
          {mode === 'void' && writeOff.status === 'approved' && <p className="font-medium text-amber-900">Отмена одобренного списания восстановит задолженность.</p>}
          {mode === 'void' && writeOff.status === 'active' && <p>Отменить действующую заявку на списание?</p>}
          {(mode === 'reject' || mode === 'void') && <textarea data-testid="writeoff-transition-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} placeholder="Причина" className="mt-2 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2" />}
          {error && <p className="mt-2 font-medium text-rose-600">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button data-testid="writeoff-transition-confirm" onClick={() => void submit()} disabled={loading} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Подтвердить</button>
            <button onClick={close} disabled={loading} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
}
