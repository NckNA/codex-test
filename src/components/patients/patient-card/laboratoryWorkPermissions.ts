export type LaboratoryWorkUserRole = string | undefined | null;

export interface LaboratoryWorkRoleCapabilities {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canComplete: boolean;
  canReopen: boolean;
}

const NONE: LaboratoryWorkRoleCapabilities = {
  canView: false,
  canCreate: false,
  canEdit: false,
  canComplete: false,
  canReopen: false,
};

export function getLaboratoryWorkRoleCapabilities(role: LaboratoryWorkUserRole): LaboratoryWorkRoleCapabilities {
  switch (role) {
    case 'clinic_owner':
    case 'clinic_admin':
      return { canView: true, canCreate: true, canEdit: true, canComplete: true, canReopen: true };
    case 'doctor':
    case 'registrar':
      return { canView: true, canCreate: true, canEdit: true, canComplete: true, canReopen: false };
    default:
      return NONE;
  }
}
