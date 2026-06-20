export type VisitUserRole = 'clinic_owner' | 'clinic_admin' | 'doctor' | 'registrar' | 'cashier' | string | undefined | null;

export interface VisitRoleCapabilities {
  canCheckIn: boolean;
  canStart: boolean;
  canComplete: boolean;
  canCancel: boolean;
}

export function getVisitRoleCapabilities(role: VisitUserRole): VisitRoleCapabilities {
  switch (role) {
    case 'clinic_owner':
    case 'clinic_admin':
      return { canCheckIn: true, canStart: true, canComplete: true, canCancel: true };
    case 'doctor':
      return { canCheckIn: true, canStart: true, canComplete: true, canCancel: true };
    case 'registrar':
      return { canCheckIn: true, canStart: true, canComplete: false, canCancel: true };
    default:
      return { canCheckIn: false, canStart: false, canComplete: false, canCancel: false };
  }
}
