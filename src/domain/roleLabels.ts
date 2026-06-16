export type RoleDisplayContext = 'clinic' | 'platform' | 'unknown';

const UNASSIGNED_ROLE_LABEL = 'Роль не назначена';
const UNKNOWN_ROLE_LABEL = 'Неизвестная роль';

const clinicRoleLabels: Record<string, string> = {
  clinic_owner: 'Владелец клиники',
  clinic_admin: 'Администратор клиники',
  doctor: 'Врач',
  receptionist: 'Регистратор',
  registrar: 'Регистратор',
  cashier: 'Кассир',
};

const platformRoleLabels: Record<string, string> = {
  platform_owner: 'Владелец платформы',
  platform_admin: 'Администратор платформы',
  platform_support: 'Поддержка платформы',
  support: 'Поддержка платформы',
};

const normalizeRole = (role?: string | null): string | null => {
  const normalized = role?.trim();
  return normalized ? normalized : null;
};

export function getClinicRoleLabel(role?: string | null): string {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    return UNASSIGNED_ROLE_LABEL;
  }

  return clinicRoleLabels[normalizedRole] ?? UNKNOWN_ROLE_LABEL;
}

export function getPlatformRoleLabel(role?: string | null): string {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    return UNASSIGNED_ROLE_LABEL;
  }

  return platformRoleLabels[normalizedRole] ?? UNKNOWN_ROLE_LABEL;
}

export function getRoleLabel(role?: string | null, context: RoleDisplayContext = 'unknown'): string {
  if (context === 'clinic') {
    return getClinicRoleLabel(role);
  }

  if (context === 'platform') {
    return getPlatformRoleLabel(role);
  }

  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    return UNASSIGNED_ROLE_LABEL;
  }

  return clinicRoleLabels[normalizedRole] ?? platformRoleLabels[normalizedRole] ?? UNKNOWN_ROLE_LABEL;
}
