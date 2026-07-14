export type PlatformAdministratorStatus = 'active' | 'disabled';

export interface PlatformAdministrator {
  userId: string;
  status: PlatformAdministratorStatus;
  displayName?: string;
  createdAt?: string;
  updatedAt?: string;
  disabledAt?: string;
}

export interface PlatformAdminStatusResult {
  isPlatformSuperadmin: boolean;
  status: PlatformAdministratorStatus | 'none';
  userId?: string;
  displayName?: string;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? value as Record<string, unknown> : {};

export function mapPlatformAdminStatus(value: unknown): PlatformAdminStatusResult {
  const row = asRecord(value);
  const status = row.status === 'active' || row.status === 'disabled' ? row.status : 'none';
  return {
    isPlatformSuperadmin: Boolean(row.isPlatformSuperadmin ?? row.is_platform_superadmin) && status === 'active',
    status,
    userId: row.userId || row.user_id ? String(row.userId ?? row.user_id) : undefined,
    displayName: row.displayName || row.display_name ? String(row.displayName ?? row.display_name) : undefined,
  };
}

export function canManagePlatform(admin: PlatformAdminStatusResult | null | undefined): boolean {
  return Boolean(admin?.isPlatformSuperadmin && admin.status === 'active');
}

export function safePlatformAdminDto(admin: PlatformAdministrator): PlatformAdministrator {
  return {
    userId: admin.userId,
    status: admin.status,
    displayName: admin.displayName,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
    disabledAt: admin.disabledAt,
  };
}
