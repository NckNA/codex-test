export type CashierUserRole = 'clinic_owner' | 'clinic_admin' | 'cashier' | 'doctor' | 'registrar' | string | undefined | null;

export interface CashierRoleCapabilities {
  canAccessCashier: boolean;
  canSearchPatient: boolean;
  canRecordPayment: boolean;
  canAllocatePayment: boolean;
  canIssueDraftInvoice: boolean;
  canViewVoidControls: boolean;
}

export function getCashierRoleCapabilities(role: CashierUserRole): CashierRoleCapabilities {
  switch (role) {
    case 'clinic_owner':
    case 'clinic_admin':
    case 'cashier':
      return {
        canAccessCashier: true,
        canSearchPatient: true,
        canRecordPayment: true,
        canAllocatePayment: true,
        canIssueDraftInvoice: true,
        canViewVoidControls: false,
      };
    default:
      return {
        canAccessCashier: false,
        canSearchPatient: false,
        canRecordPayment: false,
        canAllocatePayment: false,
        canIssueDraftInvoice: false,
        canViewVoidControls: false,
      };
  }
}
