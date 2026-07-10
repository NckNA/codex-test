import { CashierPaymentPanel } from '../components/cashier/CashierPaymentPanel';
import { useTenant } from '../contexts/TenantContext';

export function CashierPaymentPage() {
  const { activeTenant } = useTenant();
  return (
    <div className="space-y-6">
      <CashierPaymentPanel tenantId={activeTenant?.tenantId} role={activeTenant?.role} />
    </div>
  );
}
