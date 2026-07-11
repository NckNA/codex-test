import type { FinanceUserRole } from './financePermissions';

export interface FundReservationCapabilities {
  canViewSummary: boolean;
  canViewReservations: boolean;
  canCreate: boolean;
  canRelease: boolean;
  canUse: boolean;
}

export function getFundReservationCapabilities(role: FinanceUserRole): FundReservationCapabilities {
  switch (role) {
    case 'clinic_owner':
    case 'clinic_admin':
      return {
        canViewSummary: true,
        canViewReservations: true,
        canCreate: true,
        canRelease: true,
        canUse: true,
      };
    case 'cashier':
      return {
        canViewSummary: true,
        canViewReservations: true,
        canCreate: true,
        canRelease: false,
        canUse: true,
      };
    case 'doctor':
    case 'registrar':
      return {
        canViewSummary: true,
        canViewReservations: false,
        canCreate: false,
        canRelease: false,
        canUse: false,
      };
    default:
      return {
        canViewSummary: false,
        canViewReservations: false,
        canCreate: false,
        canRelease: false,
        canUse: false,
      };
  }
}
