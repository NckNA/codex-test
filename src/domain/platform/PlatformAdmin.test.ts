import { describe, expect, it } from 'vitest';
import { canManagePlatform, mapPlatformAdminStatus, safePlatformAdminDto } from './PlatformAdmin';

describe('PlatformAdmin', () => {
  it('recognizes only active platform superadmin', () => {
    expect(canManagePlatform(mapPlatformAdminStatus({ isPlatformSuperadmin: true, status: 'active' }))).toBe(true);
    expect(canManagePlatform(mapPlatformAdminStatus({ isPlatformSuperadmin: true, status: 'disabled' }))).toBe(false);
    expect(canManagePlatform(mapPlatformAdminStatus({ status: 'active' }))).toBe(false);
  });

  it('maps snake case and rejects unknown status', () => {
    expect(mapPlatformAdminStatus({ is_platform_superadmin: true, status: 'active', user_id: 'u1' })).toEqual({
      isPlatformSuperadmin: true,
      status: 'active',
      userId: 'u1',
      displayName: undefined,
    });
    expect(mapPlatformAdminStatus({ status: 'owner' }).status).toBe('none');
  });

  it('safe DTO excludes arbitrary clinical payloads', () => {
    const source = Object.assign(
      { userId: 'u1', status: 'active' as const, displayName: 'Admin' },
      { patients: ['secret'], payments: [100] },
    );
    const value = safePlatformAdminDto(source);
    expect(value).not.toHaveProperty('patients');
    expect(value).not.toHaveProperty('payments');
  });
});
