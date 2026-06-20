export type CompletedServiceUserRole = 'clinic_owner' | 'clinic_admin' | 'doctor' | 'registrar' | 'cashier' | string | undefined | null;

export interface CompletedServiceRoleCapabilities {
  canView: boolean;
  canRecord: boolean;
  canVoid: boolean;
}

export function getCompletedServiceRoleCapabilities(role: CompletedServiceUserRole): CompletedServiceRoleCapabilities {
  switch (role) {
    case 'clinic_owner':
    case 'clinic_admin':
    case 'doctor':
      return { canView: true, canRecord: true, canVoid: true };
    case 'registrar':
      return { canView: true, canRecord: false, canVoid: false };
    case 'cashier':
      return { canView: false, canRecord: false, canVoid: false };
    default:
      return { canView: false, canRecord: false, canVoid: false };
  }
}
