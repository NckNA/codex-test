export type EncounterUserRole = 'clinic_owner' | 'clinic_admin' | 'doctor' | 'registrar' | 'cashier' | string | undefined | null;

export interface EncounterRoleCapabilities {
  canView: boolean;
  canCreate: boolean;
  canStart: boolean;
  canComplete: boolean;
}

export function getEncounterRoleCapabilities(role: EncounterUserRole): EncounterRoleCapabilities {
  switch (role) {
    case 'clinic_owner':
    case 'clinic_admin':
    case 'doctor':
      return { canView: true, canCreate: true, canStart: true, canComplete: true };
    case 'registrar':
    case 'cashier':
      return { canView: true, canCreate: false, canStart: false, canComplete: false };
    default:
      return { canView: false, canCreate: false, canStart: false, canComplete: false };
  }
}
