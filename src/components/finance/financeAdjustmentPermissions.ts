import type { FinanceUserRole } from './financePermissions';

export interface RefundCapabilities {
  canView: boolean;
  canRequest: boolean;
  canApprove: boolean;
  canComplete: boolean;
  canReject: boolean;
  canVoid: boolean;
}

export interface WriteOffCapabilities {
  canView: boolean;
  canRequest: boolean;
  canApprove: boolean;
  canReject: boolean;
  canVoid: boolean;
}

const VIEW_ROLES = new Set(['clinic_owner', 'clinic_admin', 'cashier', 'doctor', 'registrar']);

export function getRefundCapabilities(role: FinanceUserRole): RefundCapabilities {
  const canView = VIEW_ROLES.has(role ?? '');
  const isAdmin = role === 'clinic_owner' || role === 'clinic_admin';
  const isCashier = role === 'cashier';
  return {
    canView,
    canRequest: isAdmin || isCashier,
    canApprove: isAdmin,
    canComplete: isAdmin || isCashier,
    canReject: isAdmin,
    canVoid: isAdmin,
  };
}

export function getWriteOffCapabilities(role: FinanceUserRole): WriteOffCapabilities {
  const canView = VIEW_ROLES.has(role ?? '');
  const isAdmin = role === 'clinic_owner' || role === 'clinic_admin';
  return {
    canView,
    canRequest: isAdmin,
    canApprove: isAdmin,
    canReject: isAdmin,
    canVoid: isAdmin,
  };
}
