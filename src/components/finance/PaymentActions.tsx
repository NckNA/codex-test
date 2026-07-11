import { useState } from 'react';
import type { Payment } from '../../data/repositories/FinanceRepository';
import type { FinanceActionName } from '../../data/hooks/useFinanceActions';
import { paymentMethodLabels } from './financeLabels';
import { getFinanceRoleCapabilities, type FinanceUserRole } from './financePermissions';

interface PaymentActionsProps {
  payments: Payment[];
  role: FinanceUserRole;
  actionLoading: FinanceActionName | null;
  onVoidPayment: (paymentId: string, reason: string) => Promise<void>;
}

export function PaymentActions({ payments, role, actionLoading, onVoidPayment }: PaymentActionsProps) {
  const capabilities = getFinanceRoleCapabilities(role);
  const [voidPaymentId, setVoidPaymentId] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const isBusy = actionLoading !== null;

  const handleVoid = async () => {
    setFormError(null);
    if (!voidPaymentId) {
      setFormError('Платёж не выбран.');
      return;
    }
    if (!voidReason.trim()) {
      setFormError('Причина обязательна.');
      return;
    }
    try {
      await onVoidPayment(voidPaymentId, voidReason);
      setVoidPaymentId('');
      setVoidReason('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Не удалось выполнить финансовую операцию.');
    }
  };

  if (!capabilities.canVoid || payments.length === 0) return null;

  return (
    <div className="mt-5 space-y-4">
      <div data-testid="finance-void-payment-box" className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
        <h4 className="text-sm font-semibold text-rose-800">Аннулировать оплату</h4>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <select data-testid="finance-void-payment-select" value={voidPaymentId} onChange={(event) => setVoidPaymentId(event.target.value)} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm">
            <option value="">Выберите оплату</option>
            {payments.filter((payment) => !['voided', 'archived'].includes(payment.status)).map((payment) => <option key={payment.id} value={payment.id}>{paymentMethodLabels[payment.paymentMethod]} · {payment.amount} {payment.currency}</option>)}
          </select>
          <input data-testid="finance-void-payment-reason" value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder="Причина аннулирования" className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm" />
        </div>
        {formError && <p data-testid="finance-void-payment-error" className="mt-3 text-sm font-medium text-rose-600">{formError}</p>}
        <button type="button" data-testid="finance-void-payment-submit" disabled={isBusy || !voidPaymentId || !voidReason.trim()} onClick={() => { void handleVoid(); }} className="mt-3 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">Аннулировать оплату</button>
      </div>
    </div>
  );
}
