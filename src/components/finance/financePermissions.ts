export type FinanceUserRole = 'clinic_owner' | 'clinic_admin' | 'cashier' | 'doctor' | 'registrar' | string | undefined | null;

export interface FinanceRoleCapabilities {
  canView: boolean;
  canCreateInvoice: boolean;
  canAddInvoiceItem: boolean;
  canIssueInvoice: boolean;
  canRecordPayment: boolean;
  canAllocatePayment: boolean;
  canVoid: boolean;
}

export function getFinanceRoleCapabilities(role: FinanceUserRole): FinanceRoleCapabilities {
  switch (role) {
    case 'clinic_owner':
    case 'clinic_admin':
      return {
        canView: true,
        canCreateInvoice: true,
        canAddInvoiceItem: true,
        canIssueInvoice: true,
        canRecordPayment: true,
        canAllocatePayment: true,
        canVoid: true,
      };
    case 'cashier':
      return {
        canView: true,
        canCreateInvoice: true,
        canAddInvoiceItem: true,
        canIssueInvoice: true,
        canRecordPayment: true,
        canAllocatePayment: true,
        canVoid: false,
      };
    case 'doctor':
    case 'registrar':
      return {
        canView: true,
        canCreateInvoice: false,
        canAddInvoiceItem: false,
        canIssueInvoice: false,
        canRecordPayment: false,
        canAllocatePayment: false,
        canVoid: false,
      };
    default:
      return {
        canView: false,
        canCreateInvoice: false,
        canAddInvoiceItem: false,
        canIssueInvoice: false,
        canRecordPayment: false,
        canAllocatePayment: false,
        canVoid: false,
      };
  }
}
